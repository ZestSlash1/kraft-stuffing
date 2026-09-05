// IMAP → Supabase sync for the mail read layer. SERVER-ONLY.
//
// Pulls recent messages for an account into mail_messages so /api/mail/list and
// /api/mail/thread can serve reads DB-only. Called by the sync worker (cron +
// on-demand). IMAP is opened here (and when sending) — never on the read path.
//
// Per account, for each folder we:
//   1. Fetch envelopes/flags for the newest MAX uids, upsert HEADERS (bodies untouched).
//   2. Back-fill bodies for a bounded number of recent rows still missing one.
//   3. Push the \Seen flag to IMAP for rows marked read locally but not yet pushed.
//   4. Push the \Flagged (star) state to IMAP for rows changed locally but not pushed.
// Each step is isolated so one failure doesn't abort the rest of the account.
//
// A "folder" here is a { key, path } pair: `key` is the coarse mirror column value
// ('INBOX' | 'Sent' | 'Junk' | 'Archive') the read API filters by, `path` is the real
// IMAP mailbox path for this account (varies by provider — resolved via special-use,
// see mailFolders.js). INBOX/Sent use their literal name for both; Junk/Archive are
// resolved per account and skipped entirely when the account has neither.
import { simpleParser } from "mailparser";
import { openImap } from "./mailAccount.js";
import { syncFolders, resolveSpecialFolder } from "./mailFolders.js";
import { moveMessages } from "./mailMove.js";

// Does a sender match any active junk rule? sender_email is exact (lowercased);
// sender_domain matches the part after '@'. Returns true on the first match.
function matchesRule(rules, fromAddress) {
  const addr = (fromAddress || "").trim().toLowerCase();
  if (!addr) return false;
  const domain = addr.includes("@") ? addr.slice(addr.indexOf("@") + 1) : "";
  for (const r of rules) {
    if (r.match_type === "sender_email" && r.match_value === addr) return true;
    if (r.match_type === "sender_domain" && domain && r.match_value === domain) return true;
  }
  return false;
}

const MAX = 50; // newest N messages mirrored per folder (matches the old list window)
const BODY_BATCH = 20; // bodies back-filled per folder per run (bounds duration/bandwidth)

function envAddr(a) {
  return a ? { name: a.name || "", address: a.address || "" } : null;
}
function envList(arr) {
  return (arr || []).map((a) => ({ name: a.name || "", address: a.address || "" }));
}

// Step 1 — mirror headers for the newest window. Never writes body columns, so a
// previously back-filled body survives. Reconciles the \Seen/\Flagged state without
// clobbering a local change that hasn't been pushed to IMAP yet.
async function syncHeaders(client, db, account, dbKey, imapPath, autoJunk = null) {
  const lock = await client.getMailboxLock(imapPath);
  let fetched = [];
  try {
    const total = client.mailbox.exists;
    if (total > 0) {
      const start = Math.max(1, total - MAX + 1);
      for await (const msg of client.fetch(`${start}:*`, {
        uid: true,
        flags: true,
        envelope: true,
        internalDate: true,
      })) {
        const from = msg.envelope?.from?.[0];
        fetched.push({
          uid: msg.uid,
          message_id: msg.envelope?.messageId || null,
          subject: msg.envelope?.subject || "(no subject)",
          from_name: from?.name || "",
          from_address: from?.address || "",
          to_recipients: envList(msg.envelope?.to),
          cc_recipients: envList(msg.envelope?.cc),
          received_at: msg.envelope?.date || msg.internalDate || null,
          imapSeen: msg.flags?.has ? msg.flags.has("\\Seen") : false,
          imapFlagged: msg.flags?.has ? msg.flags.has("\\Flagged") : false,
        });
      }
    }
  } finally {
    lock.release();
  }
  if (fetched.length === 0) return;

  // Existing rows in this window → decide insert vs. seen/flag-only update.
  const uids = fetched.map((m) => m.uid);
  const { data: existing } = await db
    .from("mail_messages")
    .select("uid, seen, seen_synced, flagged, flagged_synced")
    .eq("account_id", account.id)
    .eq("folder", dbKey)
    .in("uid", uids);
  const known = new Map((existing || []).map((r) => [Number(r.uid), r]));

  const inserts = [];
  const seenUpdates = []; // { uid, seen }
  const flagUpdates = []; // { uid, flagged }
  const toJunk = []; // UIDs of new messages a filter rule diverts to Junk
  for (const m of fetched) {
    const row = known.get(m.uid);
    if (!row) {
      // Auto-junk: a new message from a filtered sender is moved to Junk in this same
      // pass and NEVER inserted into the mirror, so it never appears in the Inbox.
      if (autoJunk?.junkPath && matchesRule(autoJunk.rules, m.from_address)) {
        toJunk.push(m.uid);
        continue;
      }
      inserts.push({
        account_id: account.id,
        user_id: account.user_id,
        folder: dbKey,
        uid: m.uid,
        message_id: m.message_id,
        subject: m.subject,
        from_name: m.from_name,
        from_address: m.from_address,
        to_recipients: m.to_recipients,
        cc_recipients: m.cc_recipients,
        received_at: m.received_at,
        seen: m.imapSeen,
        seen_synced: true,
        flagged: m.imapFlagged,
        flagged_synced: true,
        html: null,
      });
      continue;
    }
    // Local read/star pending push → keep it; the push step reconciles IMAP instead
    // of this reading from it (only reconcile from IMAP when nothing's pending).
    if (row.seen_synced && row.seen !== m.imapSeen) seenUpdates.push({ uid: m.uid, seen: m.imapSeen });
    if (row.flagged_synced && row.flagged !== m.imapFlagged) flagUpdates.push({ uid: m.uid, flagged: m.imapFlagged });
  }

  if (inserts.length) {
    await db.from("mail_messages").upsert(inserts, { onConflict: "account_id,folder,uid" });
  }
  for (const u of seenUpdates) {
    await db
      .from("mail_messages")
      .update({ seen: u.seen, seen_synced: true })
      .eq("account_id", account.id)
      .eq("folder", dbKey)
      .eq("uid", u.uid);
  }
  for (const u of flagUpdates) {
    await db
      .from("mail_messages")
      .update({ flagged: u.flagged, flagged_synced: true })
      .eq("account_id", account.id)
      .eq("folder", dbKey)
      .eq("uid", u.uid);
  }

  // Divert filtered senders to Junk on IMAP (mirror rows were never inserted). Best-
  // effort — a move failure must not fail the sync pass; the message just stays put and
  // will be retried next run.
  if (toJunk.length && autoJunk?.junkPath) {
    try {
      await moveMessages(account, imapPath, autoJunk.junkPath, toJunk, client);
    } catch {
      /* leave the messages in place; next sync retries */
    }
  }
}

// Step 2 — back-fill bodies for recent rows still missing one (html IS null).
async function backfillBodies(client, db, account, dbKey, imapPath) {
  const { data: rows } = await db
    .from("mail_messages")
    .select("uid")
    .eq("account_id", account.id)
    .eq("folder", dbKey)
    .is("html", null)
    .order("received_at", { ascending: false })
    .limit(BODY_BATCH);
  if (!rows?.length) return;

  const lock = await client.getMailboxLock(imapPath);
  try {
    for (const { uid } of rows) {
      try {
        const msg = await client.fetchOne(String(uid), { uid: true, source: true }, { uid: true });
        if (!msg) continue;
        const parsed = await simpleParser(msg.source);
        await db
          .from("mail_messages")
          .update({
            html: parsed.html || "",
            body_text: parsed.text || "",
            to_recipients: parsed.to?.value ? envList(parsed.to.value) : undefined,
            cc_recipients: parsed.cc?.value ? envList(parsed.cc.value) : undefined,
            from_name: parsed.from?.value?.[0]?.name ?? undefined,
            from_address: parsed.from?.value?.[0]?.address ?? undefined,
            attachments: (parsed.attachments || []).map((a) => ({
              filename: a.filename || "attachment",
              contentType: a.contentType || "",
              size: a.size || 0,
            })),
          })
          .eq("account_id", account.id)
          .eq("folder", dbKey)
          .eq("uid", uid);
      } catch {
        /* one bad message must not stall the batch */
      }
    }
  } finally {
    lock.release();
  }
}

// Step 3 — push locally-read messages' \Seen flag back to IMAP, then mark synced.
async function pushSeen(client, db, account, dbKey, imapPath) {
  const { data: rows } = await db
    .from("mail_messages")
    .select("uid")
    .eq("account_id", account.id)
    .eq("folder", dbKey)
    .eq("seen", true)
    .eq("seen_synced", false);
  if (!rows?.length) return;
  const uids = rows.map((r) => Number(r.uid));
  const lock = await client.getMailboxLock(imapPath);
  try {
    await client.messageFlagsAdd(uids, ["\\Seen"], { uid: true });
  } finally {
    lock.release();
  }
  await db
    .from("mail_messages")
    .update({ seen_synced: true })
    .eq("account_id", account.id)
    .eq("folder", dbKey)
    .in("uid", uids);
}

// Step 4 — push locally-starred/unstarred messages' \Flagged state back to IMAP.
// Split into add/remove batches since STORE only takes one direction at a time.
async function pushFlagged(client, db, account, dbKey, imapPath) {
  const { data: rows } = await db
    .from("mail_messages")
    .select("uid, flagged")
    .eq("account_id", account.id)
    .eq("folder", dbKey)
    .eq("flagged_synced", false);
  if (!rows?.length) return;
  const toFlag = rows.filter((r) => r.flagged).map((r) => Number(r.uid));
  const toUnflag = rows.filter((r) => !r.flagged).map((r) => Number(r.uid));
  const lock = await client.getMailboxLock(imapPath);
  try {
    if (toFlag.length) await client.messageFlagsAdd(toFlag, ["\\Flagged"], { uid: true });
    if (toUnflag.length) await client.messageFlagsRemove(toUnflag, ["\\Flagged"], { uid: true });
  } finally {
    lock.release();
  }
  await db
    .from("mail_messages")
    .update({ flagged_synced: true })
    .eq("account_id", account.id)
    .eq("folder", dbKey)
    .in("uid", rows.map((r) => Number(r.uid)));
}

// Sync one account across all folders. Opens a single IMAP connection and always
// closes it. `account` must carry a decrypted `password` (+ user_id). Returns nothing;
// throws on a connection-level failure so the caller can classify/mark status.
export async function syncAccount(db, account) {
  const client = await openImap(account);
  try {
    // Refresh the mailbox structure first so trash/junk/archive targets + the Move-to
    // picker stay current, and so auto-junk + the Junk/Archive mirror below can resolve
    // their paths. Best-effort.
    try {
      await syncFolders(db, account, client);
    } catch {
      /* a LIST failure must not abort message sync */
    }

    // Resolve Junk/Archive once — both the mirror targets below and auto-junk reuse
    // these. An account with neither (many simple IMAP setups) just skips that folder.
    const junkPath = await resolveSpecialFolder(db, account, "junk").catch(() => null);
    const archivePath = await resolveSpecialFolder(db, account, "archive").catch(() => null);

    let autoJunk = null;
    try {
      const { data: rules } = await db
        .from("mail_filter_rules")
        .select("match_type, match_value")
        .eq("account_id", account.id);
      if (rules?.length && junkPath) autoJunk = { rules, junkPath };
    } catch {
      /* no rules / resolution failure → skip auto-junk this pass */
    }

    const targets = [
      { key: "INBOX", path: "INBOX" },
      { key: "Sent", path: "Sent" },
    ];
    if (junkPath) targets.push({ key: "Junk", path: junkPath });
    if (archivePath) targets.push({ key: "Archive", path: archivePath });

    for (const { key, path } of targets) {
      try {
        await syncHeaders(client, db, account, key, path, key === "INBOX" ? autoJunk : null);
        await backfillBodies(client, db, account, key, path);
        await pushSeen(client, db, account, key, path);
        await pushFlagged(client, db, account, key, path);
      } catch {
        /* a missing/locked folder (e.g. no Sent) must not fail the whole account */
      }
    }
  } finally {
    await client.logout().catch(() => {});
  }
}

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
// Each step is isolated so one failure doesn't abort the rest of the account.
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
const FOLDERS = ["INBOX", "Sent"];

function envAddr(a) {
  return a ? { name: a.name || "", address: a.address || "" } : null;
}
function envList(arr) {
  return (arr || []).map((a) => ({ name: a.name || "", address: a.address || "" }));
}

// Step 1 — mirror headers for the newest window. Never writes body columns, so a
// previously back-filled body survives. Reconciles the \Seen flag without clobbering
// a local read that hasn't been pushed to IMAP yet (seen && !seen_synced).
async function syncHeaders(client, db, account, folder, autoJunk = null) {
  const lock = await client.getMailboxLock(folder);
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
        });
      }
    }
  } finally {
    lock.release();
  }
  if (fetched.length === 0) return;

  // Existing rows in this window → decide insert vs. seen-only update.
  const uids = fetched.map((m) => m.uid);
  const { data: existing } = await db
    .from("mail_messages")
    .select("uid, seen, seen_synced")
    .eq("account_id", account.id)
    .eq("folder", folder)
    .in("uid", uids);
  const known = new Map((existing || []).map((r) => [Number(r.uid), r]));

  const inserts = [];
  const seenUpdates = []; // { uid, seen, seen_synced }
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
        folder,
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
        html: null,
      });
      continue;
    }
    // Local read pending push → keep it; the seen-push step reconciles IMAP.
    if (row.seen && !row.seen_synced) continue;
    if (row.seen !== m.imapSeen) seenUpdates.push({ uid: m.uid, seen: m.imapSeen });
  }

  if (inserts.length) {
    await db.from("mail_messages").upsert(inserts, { onConflict: "account_id,folder,uid" });
  }
  for (const u of seenUpdates) {
    await db
      .from("mail_messages")
      .update({ seen: u.seen, seen_synced: true })
      .eq("account_id", account.id)
      .eq("folder", folder)
      .eq("uid", u.uid);
  }

  // Divert filtered senders to Junk on IMAP (mirror rows were never inserted). Best-
  // effort — a move failure must not fail the sync pass; the message just stays put and
  // will be retried next run.
  if (toJunk.length && autoJunk?.junkPath) {
    try {
      await moveMessages(account, folder, autoJunk.junkPath, toJunk, client);
    } catch {
      /* leave the messages in place; next sync retries */
    }
  }
}

// Step 2 — back-fill bodies for recent rows still missing one (html IS null).
async function backfillBodies(client, db, account, folder) {
  const { data: rows } = await db
    .from("mail_messages")
    .select("uid")
    .eq("account_id", account.id)
    .eq("folder", folder)
    .is("html", null)
    .order("received_at", { ascending: false })
    .limit(BODY_BATCH);
  if (!rows?.length) return;

  const lock = await client.getMailboxLock(folder);
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
          .eq("folder", folder)
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
async function pushSeen(client, db, account, folder) {
  const { data: rows } = await db
    .from("mail_messages")
    .select("uid")
    .eq("account_id", account.id)
    .eq("folder", folder)
    .eq("seen", true)
    .eq("seen_synced", false);
  if (!rows?.length) return;
  const uids = rows.map((r) => Number(r.uid));
  const lock = await client.getMailboxLock(folder);
  try {
    await client.messageFlagsAdd(uids, ["\\Seen"], { uid: true });
  } finally {
    lock.release();
  }
  await db
    .from("mail_messages")
    .update({ seen_synced: true })
    .eq("account_id", account.id)
    .eq("folder", folder)
    .in("uid", uids);
}

// Sync one account across all folders. Opens a single IMAP connection and always
// closes it. `account` must carry a decrypted `password` (+ user_id). Returns nothing;
// throws on a connection-level failure so the caller can classify/mark status.
export async function syncAccount(db, account) {
  const client = await openImap(account);
  try {
    // Refresh the mailbox structure first so trash/junk targets + the Move-to picker
    // stay current, and so auto-junk can resolve the junk path below. Best-effort.
    try {
      await syncFolders(db, account, client);
    } catch {
      /* a LIST failure must not abort message sync */
    }

    // Load this account's junk rules + resolved junk path once, for INBOX auto-junk.
    let autoJunk = null;
    try {
      const { data: rules } = await db
        .from("mail_filter_rules")
        .select("match_type, match_value")
        .eq("account_id", account.id);
      if (rules?.length) {
        const junkPath = await resolveSpecialFolder(db, account, "junk");
        if (junkPath) autoJunk = { rules, junkPath };
      }
    } catch {
      /* no rules / resolution failure → skip auto-junk this pass */
    }

    for (const folder of FOLDERS) {
      try {
        await syncHeaders(client, db, account, folder, folder === "INBOX" ? autoJunk : null);
        await backfillBodies(client, db, account, folder);
        await pushSeen(client, db, account, folder);
      } catch {
        /* a missing/locked folder (e.g. no Sent) must not fail the whole account */
      }
    }
  } finally {
    await client.logout().catch(() => {});
  }
}

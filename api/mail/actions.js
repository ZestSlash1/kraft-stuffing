// /api/mail/actions?op=<op> — single entry point for every message action + its
// supporting reads. Consolidated into ONE serverless function to stay under Vercel's
// Hobby-plan 12-function cap (each file under api/ is a separate function).
//
//   POST ?op=move        { account_id, message_uids, source_folder, target_folder }
//   POST ?op=delete      { account_id, message_uids, source_folder }
//   POST ?op=archive     { account_id, message_uids, source_folder }
//   POST ?op=junk        { account_id, message_uids, source_folder }
//   POST ?op=not-junk    { account_id, rule_id?|match_value?, message_uids?, source_folder? }
//   POST ?op=star        { account_id, message_uids, source_folder, flagged }  → DB-only,
//                          instant; the sync worker pushes \Flagged to IMAP (mirrors \Seen)
//   GET  ?op=folders&accountId=X            → account mailbox list (Move-to picker / Settings)
//   POST ?op=folders&accountId=X            → force a fresh IMAP LIST
//   GET  ?op=filter-rules&accountId=X       → active junk rules
//   DELETE ?op=filter-rules&accountId=X&id=Y → remove one rule
//   GET  ?op=recipients&accountId=X         → recent to/cc/from addresses (compose autocomplete)
//   GET  ?op=templates&accountId=X          → this account's saved mail_templates
//   POST ?op=templates   { account_id, name, subject?, body_html }        → create
//   PUT  ?op=templates&id=X { name?, subject?, body_html? }               → update
//   DELETE ?op=templates&id=X                                             → delete
//   GET  ?op=canned-responses&category=X    → org-wide canned response library
//   POST ?op=canned-responses   { name, category?, subject?, body }       → create
//   PUT  ?op=canned-responses&id=X { name?, category?, subject?, body?, is_void? } → update/void
//   GET  ?op=reminders&due=1                → this user's due (pending, remind_at<=now) reminders
//   GET  ?op=reminders&messageId=X           → this message's active pending reminder, if any
//   POST ?op=reminders   { message_id, mode, remind_at, note? }           → create/upsert (snooze+re-snooze)
//   PUT  ?op=reminders&id=X { status: 'done'|'dismissed' }                → resolve
//   POST ?op=schedule-send { account_id, to, cc?, bcc?, subject, body_html,
//                            attachments?, reply_to_uid?, send_at }       → queue mail_scheduled_sends
//   GET/POST ?op=process-scheduled → worker: send every due pending row (cron or
//                                    client best-effort flush, same shape as
//                                    /api/notify/dispatch's on-emit trigger)
//   GET  ?op=scheduled-sends&accountId=X    → Outbox list (pending + recent sent/failed)
//   POST ?op=cancel-scheduled { id }        → cancel a pending scheduled send
//
// IMAP is the source of truth; every mutating op performs the real IMAP move and
// updates the mail_messages mirror so the DB read layer reflects it instantly.
import { requireUser, httpError, withErrors, adminClient, readJsonBody } from "../_lib/auth.js";
import { getAccountById, resolveAccountMeta, makeTransport } from "../_lib/mailAccount.js";
import { requireSpecialFolder, listFolders, syncFolders } from "../_lib/mailFolders.js";
import { performMove, readUids } from "../_lib/mailActions.js";
import { deletePop3Message } from "../_lib/mailPop3.js";
import { resolveAttachments } from "./send.js";

// Move/Archive/Junk/filter-rules/folder-mapping are IMAP-only — POP3 has no server
// folders or persistent flags for any of them to operate on. Called right after the
// account is resolved in every op that needs an IMAP mailbox.
function requireImap(account) {
  if (account.incoming_protocol === "pop3") throw httpError(400, "not_available_pop3");
}

// IMAP handshakes (+ scheduled-send batches) can be slow — match the other mail
// functions' raised budget.
export const config = { maxDuration: 45 };

// ── op: move ────────────────────────────────────────────────────────────────
async function opMove(req, res, user) {
  const body = readJsonBody(req);
  const accountId = (body?.account_id || "").toString();
  if (!accountId) throw httpError(400, "account_id is required");
  const target = (body?.target_folder || "").toString().trim();
  if (!target) throw httpError(400, "target_folder is required");
  const sourceFolder = (body?.source_folder || "INBOX").toString();
  const uids = readUids(body);

  const db = adminClient();
  const account = await getAccountById(user.id, accountId); // ownership-checked + decrypted
  requireImap(account);
  const { newUidByOld, moved } = await performMove(db, account, sourceFolder, target, uids);
  res.status(200).json({ ok: true, moved, target, newUidByOld });
}

// ── op: delete (→ Trash for IMAP; permanent server delete for POP3 — no Trash concept) ──
async function opDelete(req, res, user) {
  const body = readJsonBody(req);
  const accountId = (body?.account_id || "").toString();
  if (!accountId) throw httpError(400, "account_id is required");
  const sourceFolder = (body?.source_folder || "INBOX").toString();

  const db = adminClient();
  const account = await getAccountById(user.id, accountId);

  if (account.incoming_protocol === "pop3") {
    // POP3 UIDLs are opaque strings (often not numeric) — readUids' Number() cast
    // (built for IMAP UIDs) would corrupt them, so read the raw values here instead.
    const raw = body?.message_uids ?? body?.uids ?? [];
    const uids = (Array.isArray(raw) ? raw : [raw]).map((u) => u.toString());
    if (!uids.length) throw httpError(400, "message_uids is required");
    for (const uid of uids) await deletePop3Message(account, uid);
    return res.status(200).json({ ok: true, moved: uids.length, target: null, permanent: true });
  }

  const uids = readUids(body);
  const trash = await requireSpecialFolder(db, account, "trash");
  const { newUidByOld, moved } = await performMove(db, account, sourceFolder, trash, uids);
  res.status(200).json({ ok: true, moved, target: trash, newUidByOld });
}

// ── op: archive (→ Archive) ────────────────────────────────────────────────────
async function opArchive(req, res, user) {
  const body = readJsonBody(req);
  const accountId = (body?.account_id || "").toString();
  if (!accountId) throw httpError(400, "account_id is required");
  const sourceFolder = (body?.source_folder || "INBOX").toString();
  const uids = readUids(body);

  const db = adminClient();
  const account = await getAccountById(user.id, accountId);
  requireImap(account);
  const archive = await requireSpecialFolder(db, account, "archive");
  const { newUidByOld, moved } = await performMove(db, account, sourceFolder, archive, uids);
  res.status(200).json({ ok: true, moved, target: archive, newUidByOld });
}

// ── op: star (toggle \Flagged — DB-only, IMAP push happens on next sync) ──────
async function opStar(req, res, user) {
  const body = readJsonBody(req);
  const accountId = (body?.account_id || "").toString();
  if (!accountId) throw httpError(400, "account_id is required");
  const sourceFolder = (body?.source_folder || "INBOX").toString();
  const uids = readUids(body);
  const flagged = !!body?.flagged;

  const db = adminClient();
  const account = await resolveAccountMeta(user.id, accountId); // ownership check
  requireImap(account); // POP3 has no mail_messages mirror to flag
  const { error } = await db
    .from("mail_messages")
    .update({ flagged, flagged_synced: false })
    .eq("account_id", accountId)
    .eq("user_id", user.id)
    .eq("folder", sourceFolder)
    .in("uid", uids);
  if (error) throw httpError(500, "Could not update star");
  res.status(200).json({ ok: true, flagged, uids });
}

// ── op: junk (→ Junk + standing rule) ─────────────────────────────────────────
async function opJunk(req, res, user) {
  const body = readJsonBody(req);
  const accountId = (body?.account_id || "").toString();
  if (!accountId) throw httpError(400, "account_id is required");
  const sourceFolder = (body?.source_folder || "INBOX").toString();
  const uids = readUids(body);

  const db = adminClient();
  const account = await getAccountById(user.id, accountId);
  requireImap(account);
  const junk = await requireSpecialFolder(db, account, "junk");

  // Senders (for the rule) read BEFORE the move removes these mirror rows.
  const { data: rows } = await db
    .from("mail_messages")
    .select("uid, from_address, id")
    .eq("account_id", account.id)
    .eq("folder", sourceFolder)
    .in("uid", uids);
  const senders = new Map();
  for (const r of rows || []) {
    const email = (r.from_address || "").trim().toLowerCase();
    if (email && !senders.has(email)) senders.set(email, r.id);
  }

  const { moved } = await performMove(db, account, sourceFolder, junk, uids);

  const ruleRows = [...senders.entries()].map(([email, msgId]) => ({
    account_id: account.id,
    user_id: user.id,
    match_type: "sender_email",
    match_value: email,
    action: "move_to_junk",
    target_folder_path: junk,
    created_from_message_id: msgId,
  }));
  let rules = [];
  if (ruleRows.length) {
    const { data } = await db
      .from("mail_filter_rules")
      .upsert(ruleRows, { onConflict: "account_id,match_type,match_value", ignoreDuplicates: false })
      .select("id, match_type, match_value, target_folder_path");
    rules = data || [];
  }
  res.status(200).json({ ok: true, moved, target: junk, rules });
}

// ── op: not-junk (remove rule, optionally move back to Inbox) ──────────────────
async function opNotJunk(req, res, user) {
  const body = readJsonBody(req);
  const accountId = (body?.account_id || "").toString();
  if (!accountId) throw httpError(400, "account_id is required");

  const db = adminClient();
  const account = await getAccountById(user.id, accountId);
  requireImap(account);

  const ruleId = (body?.rule_id || "").toString();
  const matchValue = (body?.match_value || "").toString().trim().toLowerCase();
  let del = db.from("mail_filter_rules").delete().eq("account_id", account.id).eq("user_id", user.id);
  if (ruleId) del = del.eq("id", ruleId);
  else if (matchValue) del = del.eq("match_value", matchValue);
  else throw httpError(400, "rule_id or match_value is required");
  const { error: delErr } = await del;
  if (delErr) throw httpError(500, "Could not remove filter rule");

  let moved = 0;
  const rawUids = body?.message_uids;
  const uids = (Array.isArray(rawUids) ? rawUids : []).map((u) => Number(u)).filter(Number.isFinite);
  const sourceFolder = (body?.source_folder || "").toString();
  if (uids.length && sourceFolder) ({ moved } = await performMove(db, account, sourceFolder, "INBOX", uids));
  res.status(200).json({ ok: true, moved });
}

// ── op: folders (list / refresh) ──────────────────────────────────────────────
async function opFolders(req, res, user) {
  const accountId = (req.query.accountId || "").toString();
  if (!accountId) throw httpError(400, "accountId is required");
  if (req.method === "POST") {
    const db = adminClient();
    const account = await getAccountById(user.id, accountId); // decrypted + owned
    requireImap(account);
    await syncFolders(db, account);
    return res.status(200).json({ ok: true, folders: await listFolders(user.id, accountId) });
  }
  if (req.method !== "GET") throw httpError(405, "Method not allowed");
  res.status(200).json({ folders: await listFolders(user.id, accountId) });
}

// ── op: filter-rules (list / delete) ──────────────────────────────────────────
async function opFilterRules(req, res, user) {
  const accountId = (req.query.accountId || "").toString();
  if (!accountId) throw httpError(400, "accountId is required");
  const db = adminClient();
  const account = await resolveAccountMeta(user.id, accountId); // ownership check (no decrypt)

  if (req.method === "GET") {
    const { data, error } = await db
      .from("mail_filter_rules")
      .select("id, match_type, match_value, action, target_folder_path, created_at")
      .eq("account_id", account.id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) throw httpError(500, "Could not load filter rules");
    return res.status(200).json({ rules: data || [] });
  }
  if (req.method === "DELETE") {
    const id = (req.query.id || "").toString();
    if (!id) throw httpError(400, "id is required");
    const { error } = await db
      .from("mail_filter_rules")
      .delete()
      .eq("id", id)
      .eq("account_id", account.id)
      .eq("user_id", user.id);
    if (error) throw httpError(500, "Could not delete filter rule");
    return res.status(200).json({ ok: true });
  }
  throw httpError(405, "Method not allowed");
}

// ── op: recipients (compose To/Cc/Bcc autocomplete) ──────────────────────────
// No dedicated contacts table exists yet, so this mines the DB-mirrored mail
// history for this account: everyone the user has sent to or received from
// recently. Distinct by address, newest first, small and fast (index-backed).
async function opRecipients(req, res, user) {
  const accountId = (req.query.accountId || "").toString();
  if (!accountId) throw httpError(400, "accountId is required");
  const db = adminClient();
  await resolveAccountMeta(user.id, accountId); // ownership check

  const { data, error } = await db
    .from("mail_messages")
    .select("from_name, from_address, to_recipients, cc_recipients")
    .eq("account_id", accountId)
    .eq("user_id", user.id)
    .order("received_at", { ascending: false })
    .limit(200);
  if (error) throw httpError(500, "Could not load recipients");

  const seen = new Map();
  const add = (name, address) => {
    const addr = (address || "").trim().toLowerCase();
    if (!addr || !addr.includes("@") || seen.has(addr)) return;
    seen.set(addr, { name: name || "", address: addr });
  };
  for (const row of data || []) {
    add(row.from_name, row.from_address);
    for (const r of Array.isArray(row.to_recipients) ? row.to_recipients : []) add(r.name, r.address);
    for (const r of Array.isArray(row.cc_recipients) ? row.cc_recipients : []) add(r.name, r.address);
    if (seen.size >= 40) break;
  }
  res.status(200).json({ recipients: [...seen.values()] });
}

// ── op: canned-responses (org-wide reusable reply library — mail_canned_responses,
// distinct from mail_templates' per-account compose drafts) ──────────────────
async function opCannedResponses(req, res, user) {
  const db = adminClient();

  if (req.method === "GET") {
    let q = db
      .from("mail_canned_responses")
      .select("id, name, category, subject, body, created_at, updated_at")
      .eq("is_void", false)
      .order("category", { ascending: true })
      .order("name", { ascending: true });
    const category = (req.query.category || "").toString();
    if (category) q = q.eq("category", category);
    const { data, error } = await q;
    if (error) throw httpError(500, "Could not load canned responses");
    return res.status(200).json({ responses: data || [] });
  }

  if (req.method === "POST") {
    const body = readJsonBody(req);
    const name = (body.name || "").toString().trim();
    if (!name) throw httpError(400, "name is required");
    if (!body.body) throw httpError(400, "body is required");
    const { data, error } = await db
      .from("mail_canned_responses")
      .insert({
        name,
        category: (body.category || "General").toString(),
        subject: body.subject || null,
        body: body.body,
        created_by: user.id,
      })
      .select("id, name, category, subject, body, created_at, updated_at")
      .single();
    if (error) throw httpError(500, "Could not save canned response");
    return res.status(200).json({ response: data });
  }

  if (req.method === "PUT") {
    const id = (req.query.id || "").toString();
    if (!id) throw httpError(400, "id is required");
    const body = readJsonBody(req);
    const patch = { updated_at: new Date().toISOString() };
    if (body.name !== undefined) patch.name = body.name;
    if (body.category !== undefined) patch.category = body.category;
    if (body.subject !== undefined) patch.subject = body.subject;
    if (body.body !== undefined) patch.body = body.body;
    if (body.is_void !== undefined) patch.is_void = !!body.is_void;
    const { data, error } = await db
      .from("mail_canned_responses")
      .update(patch)
      .eq("id", id)
      .select("id, name, category, subject, body, is_void, created_at, updated_at")
      .single();
    if (error) throw httpError(500, "Could not update canned response");
    return res.status(200).json({ response: data });
  }

  throw httpError(405, "Method not allowed");
}

// ── op: reminders (follow-up reminders / snooze — mail_reminders) ────────────
// A message has at most one ACTIVE (pending, non-void) reminder — POST upserts by
// message_id instead of always inserting, which also covers "re-snooze" (same row,
// new remind_at) since a due-but-not-yet-actioned reminder is still status='pending'.
async function opReminders(req, res, user) {
  const db = adminClient();

  if (req.method === "GET") {
    if (req.query.due) {
      const { data, error } = await db
        .from("mail_reminders")
        .select("id, mode, remind_at, note, status, message_id, mail_messages(subject, from_name, from_address, account_id, folder, uid)")
        .eq("created_by", user.id)
        .eq("status", "pending")
        .eq("is_void", false)
        .lte("remind_at", new Date().toISOString())
        .order("remind_at", { ascending: true })
        .limit(50);
      if (error) throw httpError(500, "Could not load due reminders");
      return res.status(200).json({ reminders: data || [] });
    }
    const messageId = (req.query.messageId || "").toString();
    if (messageId) {
      const { data, error } = await db
        .from("mail_reminders")
        .select("id, mode, remind_at, note, status")
        .eq("created_by", user.id)
        .eq("message_id", messageId)
        .eq("status", "pending")
        .eq("is_void", false)
        .maybeSingle();
      if (error) throw httpError(500, "Could not load reminder");
      return res.status(200).json({ reminder: data || null });
    }
    // No filter: every active reminder for this user, minimal shape — the inbox list
    // cross-references this by message_id to hide snoozed-not-yet-due threads and to
    // badge rows with a pending reminder/snooze.
    const { data, error } = await db
      .from("mail_reminders")
      .select("id, message_id, mode, remind_at, status")
      .eq("created_by", user.id)
      .eq("status", "pending")
      .eq("is_void", false)
      .limit(500);
    if (error) throw httpError(500, "Could not load reminders");
    return res.status(200).json({ reminders: data || [] });
  }

  if (req.method === "POST") {
    const body = readJsonBody(req);
    const messageId = (body.message_id || "").toString();
    const remindAt = (body.remind_at || "").toString();
    const mode = (body.mode || "reminder").toString();
    if (!messageId) throw httpError(400, "message_id is required");
    if (!remindAt || Number.isNaN(Date.parse(remindAt))) throw httpError(400, "remind_at must be a valid date/time");
    if (!["reminder", "snooze"].includes(mode)) throw httpError(400, "Invalid mode");

    const { data: existing } = await db
      .from("mail_reminders")
      .select("id")
      .eq("created_by", user.id)
      .eq("message_id", messageId)
      .eq("status", "pending")
      .eq("is_void", false)
      .maybeSingle();

    const patch = { mode, remind_at: remindAt, note: body.note || null, status: "pending", updated_at: new Date().toISOString() };
    const { data, error } = existing
      ? await db.from("mail_reminders").update(patch).eq("id", existing.id).select("id, mode, remind_at, note, status").single()
      : await db.from("mail_reminders").insert({ message_id: messageId, created_by: user.id, ...patch }).select("id, mode, remind_at, note, status").single();
    if (error) throw httpError(500, "Could not save reminder");
    return res.status(200).json({ reminder: data });
  }

  if (req.method === "PUT") {
    const id = (req.query.id || "").toString();
    if (!id) throw httpError(400, "id is required");
    const body = readJsonBody(req);
    if (!["done", "dismissed"].includes(body.status)) throw httpError(400, "status must be 'done' or 'dismissed'");
    const { data, error } = await db
      .from("mail_reminders")
      .update({ status: body.status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("created_by", user.id)
      .select("id, status")
      .single();
    if (error) throw httpError(500, "Could not update reminder");
    return res.status(200).json({ reminder: data });
  }

  throw httpError(405, "Method not allowed");
}

// ── op: templates (list / create / update / delete) ──────────────────────────
async function opTemplates(req, res, user) {
  const db = adminClient();

  if (req.method === "GET") {
    const accountId = (req.query.accountId || "").toString();
    if (!accountId) throw httpError(400, "accountId is required");
    const kind = (req.query.kind || "compose").toString();
    await resolveAccountMeta(user.id, accountId);
    const { data, error } = await db
      .from("mail_templates")
      .select("id, account_id, name, subject, body_html, kind, created_at")
      .eq("account_id", accountId)
      .eq("user_id", user.id)
      .eq("kind", kind)
      .order("created_at", { ascending: false });
    if (error) throw httpError(500, "Could not load templates");
    return res.status(200).json({ templates: data || [] });
  }

  if (req.method === "POST") {
    const body = readJsonBody(req);
    const accountId = (body.account_id || "").toString();
    const name = (body.name || "").toString().trim();
    const kind = (body.kind || "compose").toString();
    if (!accountId) throw httpError(400, "account_id is required");
    if (!name) throw httpError(400, "name is required");
    if (!body.body_html) throw httpError(400, "body_html is required");
    if (!["compose", "signature"].includes(kind)) throw httpError(400, "Invalid kind");
    await resolveAccountMeta(user.id, accountId);
    const { data, error } = await db
      .from("mail_templates")
      .insert({ account_id: accountId, user_id: user.id, name, subject: body.subject || null, body_html: body.body_html, kind })
      .select("id, account_id, name, subject, body_html, kind, created_at")
      .single();
    if (error) throw httpError(500, "Could not save template");
    return res.status(200).json({ template: data });
  }

  if (req.method === "PUT") {
    const id = (req.query.id || "").toString();
    if (!id) throw httpError(400, "id is required");
    const body = readJsonBody(req);
    const patch = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.subject !== undefined) patch.subject = body.subject;
    if (body.body_html !== undefined) patch.body_html = body.body_html;
    if (!Object.keys(patch).length) throw httpError(400, "Nothing to update");
    const { data, error } = await db
      .from("mail_templates")
      .update(patch)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id, account_id, name, subject, body_html, created_at")
      .single();
    if (error) throw httpError(500, "Could not update template");
    return res.status(200).json({ template: data });
  }

  if (req.method === "DELETE") {
    const id = (req.query.id || "").toString();
    if (!id) throw httpError(400, "id is required");
    const { error } = await db.from("mail_templates").delete().eq("id", id).eq("user_id", user.id);
    if (error) throw httpError(500, "Could not delete template");
    return res.status(200).json({ ok: true });
  }

  throw httpError(405, "Method not allowed");
}

// ── op: schedule-send (queue instead of sending immediately) ─────────────────
async function opScheduleSend(req, res, user) {
  if (req.method !== "POST") throw httpError(405, "Method not allowed");
  const body = readJsonBody(req);
  const accountId = (body.account_id || "").toString();
  const sendAt = (body.send_at || "").toString();
  if (!accountId) throw httpError(400, "account_id is required");
  if (!body.to?.length) throw httpError(400, "to is required");
  if (!sendAt || Number.isNaN(Date.parse(sendAt))) throw httpError(400, "send_at must be a valid date/time");
  await resolveAccountMeta(user.id, accountId);

  const db = adminClient();
  const { data, error } = await db
    .from("mail_scheduled_sends")
    .insert({
      account_id: accountId,
      user_id: user.id,
      to_addresses: body.to,
      cc_addresses: body.cc || null,
      bcc_addresses: body.bcc || null,
      subject: body.subject || null,
      body_html: body.body_html || "",
      attachment_refs: body.attachments || null,
      reply_to_uid: body.reply_to_uid || null,
      send_at: sendAt,
    })
    .select("id, send_at, status")
    .single();
  if (error) throw httpError(500, "Could not schedule send");
  res.status(200).json({ ok: true, scheduled: data });
}

// ── op: scheduled-sends (Outbox list) ─────────────────────────────────────────
async function opScheduledSends(req, res, user) {
  if (req.method !== "GET") throw httpError(405, "Method not allowed");
  const accountId = (req.query.accountId || "").toString();
  if (!accountId) throw httpError(400, "accountId is required");
  await resolveAccountMeta(user.id, accountId);
  const db = adminClient();
  const { data, error } = await db
    .from("mail_scheduled_sends")
    .select("id, to_addresses, cc_addresses, subject, send_at, status, error, created_at")
    .eq("account_id", accountId)
    .eq("user_id", user.id)
    .order("send_at", { ascending: true })
    .limit(100);
  if (error) throw httpError(500, "Could not load scheduled sends");
  res.status(200).json({ scheduled: data || [] });
}

// ── op: cancel-scheduled (pending → canceled) ─────────────────────────────────
async function opCancelScheduled(req, res, user) {
  if (req.method !== "POST") throw httpError(405, "Method not allowed");
  const body = readJsonBody(req);
  const id = (body?.id || "").toString();
  if (!id) throw httpError(400, "id is required");
  const db = adminClient();
  const { data, error } = await db
    .from("mail_scheduled_sends")
    .update({ status: "canceled" })
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (error) throw httpError(500, "Could not cancel scheduled send");
  if (!data) throw httpError(404, "Scheduled send not found or already sent");
  res.status(200).json({ ok: true });
}

// ── op: process-scheduled (worker — sends every due pending row) ─────────────
// Same auth shape as /api/notify/dispatch and /api/mail/sync: the daily Vercel
// cron (x-vercel-cron), a CRON_SECRET holder, or any logged-in user (the client
// flushes right after scheduling — the daily cron is only a retry safety net,
// since Hobby-tier crons can't run more often than once a day).
async function authorizedWorker(req) {
  if (req.headers["x-vercel-cron"]) return true;
  const secret = process.env.CRON_SECRET;
  const header = req.headers.authorization || "";
  if (secret && header === `Bearer ${secret}`) return true;
  try {
    await requireUser(req);
    return true;
  } catch {
    return false;
  }
}

const SCHEDULED_BATCH = 25;

async function opProcessScheduled(req, res) {
  if (!(await authorizedWorker(req))) throw httpError(401, "Unauthorized");
  const db = adminClient();

  const { data: due, error } = await db
    .from("mail_scheduled_sends")
    .select("*")
    .eq("status", "pending")
    .lte("send_at", new Date().toISOString())
    .order("send_at", { ascending: true })
    .limit(SCHEDULED_BATCH);
  if (error) throw httpError(500, "Could not load scheduled sends");
  if (!due || !due.length) return res.status(200).json({ ok: true, processed: 0 });

  // Group by account so each account's decrypted transport is built once.
  const byAccount = new Map();
  for (const row of due) {
    if (!byAccount.has(row.account_id)) byAccount.set(row.account_id, []);
    byAccount.get(row.account_id).push(row);
  }

  let sent = 0;
  let failed = 0;
  for (const [accountId, rows] of byAccount) {
    const { data: acct } = await db.from("mail_accounts").select("*").eq("id", accountId).maybeSingle();
    if (!acct) {
      for (const row of rows) {
        await db.from("mail_scheduled_sends").update({ status: "failed", error: "Account not found" }).eq("id", row.id);
        failed++;
      }
      continue;
    }
    const account = await getAccountById(acct.user_id, accountId); // decrypts password
    const transport = makeTransport(account);
    const signature = account.signature_html || "";
    for (const row of rows) {
      try {
        let body = row.body_html || "";
        if (signature && !body.includes(signature)) body = `${body}<br><br>${signature}`;
        await transport.sendMail({
          from: account.email_address,
          to: row.to_addresses,
          cc: row.cc_addresses || undefined,
          bcc: row.bcc_addresses || undefined,
          subject: row.subject,
          html: body,
          inReplyTo: row.reply_to_uid ? `<${row.reply_to_uid}>` : undefined,
          attachments: await resolveAttachments(row.attachment_refs),
        });
        await db.from("mail_scheduled_sends").update({ status: "sent", error: null }).eq("id", row.id);
        sent++;
      } catch (err) {
        await db
          .from("mail_scheduled_sends")
          .update({ status: "failed", error: (err?.message || "send failed").slice(0, 300) })
          .eq("id", row.id);
        failed++;
      }
    }
  }

  res.status(200).json({ ok: true, processed: due.length, sent, failed });
}

const MUTATIONS = { move: opMove, delete: opDelete, archive: opArchive, junk: opJunk, "not-junk": opNotJunk, star: opStar };

export default withErrors(async (req, res) => {
  const op = (req.query.op || "").toString();

  // process-scheduled has its own auth (cron/secret/user) — resolved before the
  // blanket requireUser() below, since cron runs have no logged-in caller.
  if (op === "process-scheduled") return opProcessScheduled(req, res);

  const user = await requireUser(req);

  if (op === "folders") return opFolders(req, res, user);
  if (op === "filter-rules") return opFilterRules(req, res, user);
  if (op === "recipients") return opRecipients(req, res, user);
  if (op === "templates") return opTemplates(req, res, user);
  if (op === "canned-responses") return opCannedResponses(req, res, user);
  if (op === "reminders") return opReminders(req, res, user);
  if (op === "schedule-send") return opScheduleSend(req, res, user);
  if (op === "scheduled-sends") return opScheduledSends(req, res, user);
  if (op === "cancel-scheduled") return opCancelScheduled(req, res, user);

  const handler = MUTATIONS[op];
  if (!handler) throw httpError(400, "Unknown or missing op");
  if (req.method !== "POST") throw httpError(405, "Method not allowed");
  return handler(req, res, user);
});

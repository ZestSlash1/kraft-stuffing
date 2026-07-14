// /api/mail/actions?op=<op> — single entry point for every message action + its
// supporting reads. Consolidated into ONE serverless function to stay under Vercel's
// Hobby-plan 12-function cap (each file under api/ is a separate function).
//
//   POST ?op=move        { account_id, message_uids, source_folder, target_folder }
//   POST ?op=delete      { account_id, message_uids, source_folder }
//   POST ?op=junk        { account_id, message_uids, source_folder }
//   POST ?op=not-junk    { account_id, rule_id?|match_value?, message_uids?, source_folder? }
//   GET  ?op=folders&accountId=X            → account mailbox list (Move-to picker / Settings)
//   POST ?op=folders&accountId=X            → force a fresh IMAP LIST
//   GET  ?op=filter-rules&accountId=X       → active junk rules
//   DELETE ?op=filter-rules&accountId=X&id=Y → remove one rule
//
// IMAP is the source of truth; every mutating op performs the real IMAP move and
// updates the mail_messages mirror so the DB read layer reflects it instantly.
import { requireUser, httpError, withErrors, adminClient, readJsonBody } from "../_lib/auth.js";
import { getAccountById, resolveAccountMeta } from "../_lib/mailAccount.js";
import { requireSpecialFolder, listFolders, syncFolders } from "../_lib/mailFolders.js";
import { performMove, readUids } from "../_lib/mailActions.js";

// IMAP handshakes can be slow — match the other mail functions' raised budget.
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
  const { newUidByOld, moved } = await performMove(db, account, sourceFolder, target, uids);
  res.status(200).json({ ok: true, moved, target, newUidByOld });
}

// ── op: delete (→ Trash) ──────────────────────────────────────────────────────
async function opDelete(req, res, user) {
  const body = readJsonBody(req);
  const accountId = (body?.account_id || "").toString();
  if (!accountId) throw httpError(400, "account_id is required");
  const sourceFolder = (body?.source_folder || "INBOX").toString();
  const uids = readUids(body);

  const db = adminClient();
  const account = await getAccountById(user.id, accountId);
  const trash = await requireSpecialFolder(db, account, "trash");
  const { newUidByOld, moved } = await performMove(db, account, sourceFolder, trash, uids);
  res.status(200).json({ ok: true, moved, target: trash, newUidByOld });
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

const MUTATIONS = { move: opMove, delete: opDelete, junk: opJunk, "not-junk": opNotJunk };

export default withErrors(async (req, res) => {
  const user = await requireUser(req);
  const op = (req.query.op || "").toString();

  if (op === "folders") return opFolders(req, res, user);
  if (op === "filter-rules") return opFilterRules(req, res, user);

  const handler = MUTATIONS[op];
  if (!handler) throw httpError(400, "Unknown or missing op");
  if (req.method !== "POST") throw httpError(405, "Method not allowed");
  return handler(req, res, user);
});

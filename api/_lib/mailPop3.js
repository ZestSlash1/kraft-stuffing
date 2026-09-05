// POP3 client for accounts with incoming_protocol = 'pop3'. SERVER-ONLY.
//
// POP3 has no server-side folders and no persistent flags — there is nothing for a
// mail_messages mirror to reconcile against, so (unlike IMAP) POP3 accounts are never
// synced into that table. list.js/thread.js fetch live for these accounts instead,
// same shape as the pre-sync-mirror IMAP path this codebase used before mailSync.js.
//
// node-pop3 has no STLS (STARTTLS) support, so POP3 accounts are restricted to
// imap_security 'ssl' (implicit TLS, typically port 995) or 'none' (plaintext, port
// 110) — validated in connect.js/settings.js, not here.
import Pop3Command from "node-pop3";
import { simpleParser } from "mailparser";

function client(account) {
  return new Pop3Command({
    user: account.email_address,
    password: account.password,
    host: account.imap_host,
    port: account.imap_port,
    tls: account.imap_security === "ssl",
    timeout: 20000,
  });
}

// Verify credentials + connectivity. Throws on any failure.
export async function testPop3Connect(account) {
  const pop3 = client(account);
  await pop3.connect();
  await pop3.QUIT().catch(() => {});
}

// Newest `limit` messages, headers only. UIDL entries are returned oldest-first by
// most servers; we take the tail and reverse so the newest message is first, matching
// the IMAP list ordering the inbox expects. `uid` is the POP3 UIDL string — stable
// across sessions for "leave mail on server" setups, which is the only mode this
// phase supports (no local download-and-remove tracking).
export async function listPop3Messages(account, limit = 50) {
  const pop3 = client(account);
  await pop3.connect();
  try {
    const uidl = await pop3.UIDL();
    const recent = uidl.slice(-limit).reverse();
    const out = [];
    for (const [msgNum, uid] of recent) {
      const top = await pop3.TOP(msgNum, 0);
      const parsed = await simpleParser(top);
      out.push({
        uid,
        subject: parsed.subject || "(no subject)",
        from: parsed.from?.value?.[0]
          ? { name: parsed.from.value[0].name || "", address: parsed.from.value[0].address || "" }
          : null,
        date: parsed.date || null,
        // No persistent \Seen equivalent over POP3 — every listed message reads as seen.
        seen: true,
        flagged: false,
        attachments: [],
      });
    }
    return out;
  } finally {
    await pop3.QUIT().catch(() => {});
  }
}

// Full message body by its UIDL-reported uid.
export async function fetchPop3Message(account, uid) {
  const pop3 = client(account);
  await pop3.connect();
  try {
    const uidl = await pop3.UIDL();
    const row = uidl.find(([, u]) => u === uid);
    if (!row) throw new Error("Message not found");
    const raw = await pop3.RETR(row[0]);
    return simpleParser(raw);
  } finally {
    await pop3.QUIT().catch(() => {});
  }
}

// Permanently remove a message from the server (POP3 has no Trash — DELE only marks
// for deletion, committed on QUIT).
export async function deletePop3Message(account, uid) {
  const pop3 = client(account);
  await pop3.connect();
  try {
    const uidl = await pop3.UIDL();
    const row = uidl.find(([, u]) => u === uid);
    if (!row) throw new Error("Message not found");
    await pop3.command("DELE", row[0]);
  } finally {
    await pop3.QUIT().catch(() => {});
  }
}

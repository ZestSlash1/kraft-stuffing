// Helpers to load a caller's mail account and build IMAP/SMTP clients. SERVER-ONLY.
import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import { adminClient, httpError } from "./auth.js";
import { decrypt } from "./mailCrypto.js";

// Fetch the caller's mail_accounts row (scoped to their user_id) and decrypt the
// password into memory. Throws 404 if they haven't connected a mailbox yet.
export async function getAccount(userId) {
  const supabase = adminClient();
  const { data, error } = await supabase
    .from("mail_accounts")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw httpError(500, "Could not load mail account");
  if (!data) throw httpError(404, "No mailbox connected");
  return { ...data, password: decrypt(data.password_encrypted) };
}

export async function openImap(account) {
  const client = new ImapFlow({
    host: account.imap_host,
    port: account.imap_port,
    secure: true,
    auth: { user: account.email_address, pass: account.password },
    logger: false, // never log — would expose credentials
  });
  await client.connect();
  return client;
}

export function makeTransport(account) {
  return nodemailer.createTransport({
    host: account.smtp_host,
    port: account.smtp_port,
    secure: true, // 465 = implicit TLS
    auth: { user: account.email_address, pass: account.password },
  });
}

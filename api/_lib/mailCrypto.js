// AES-256-GCM helper for mailbox passwords. SERVER-ONLY — imported exclusively by
// serverless functions under /api. Never import this from anything under /src, or
// the key + crypto would be bundled into the client. Key is MAIL_ENCRYPTION_KEY:
// a 64-char hex string (= 32 bytes). Stored format: iv:authTag:ciphertext (all hex).

import crypto from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12; // 96-bit nonce, recommended for GCM

function getKey() {
  const hex = process.env.MAIL_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "MAIL_ENCRYPTION_KEY must be a 64-char hex string (32 bytes). Generate with: openssl rand -hex 32"
    );
  }
  return Buffer.from(hex, "hex");
}

export function encrypt(plaintext) {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), ciphertext.toString("hex")].join(":");
}

export function decrypt(packed) {
  const key = getKey();
  const [ivHex, tagHex, dataHex] = String(packed).split(":");
  if (!ivHex || !tagHex || !dataHex) throw new Error("Malformed encrypted payload");
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";

/**
 * Field-level encryption for T3 identifiers (PAN, bank account number), section 43/44.
 * AES-256-GCM with FIELD_ENCRYPTION_KEY (falls back to DOCUMENT_ENCRYPTION_KEY). Production: move keys to a KMS.
 * PAN also gets a keyed hash (HMAC) so duplicates can be matched without decrypting anything.
 */
function baseKey(): Buffer {
  const raw = process.env.FIELD_ENCRYPTION_KEY || process.env.DOCUMENT_ENCRYPTION_KEY;
  if (raw) {
    const k = Buffer.from(raw, "base64");
    if (k.length !== 32) throw new Error("FIELD_ENCRYPTION_KEY must be 32 bytes, base64-encoded");
    return k;
  }
  if (process.env.NODE_ENV === "production") throw new Error("FIELD_ENCRYPTION_KEY is not set");
  return createHash("sha256").update("loansforindia-dev-only-field-key").digest();
}
const subKey = (label: string) => createHmac("sha256", baseKey()).update(label).digest();

export function encryptField(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", subKey("enc"), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString("base64");
}

export function decryptField(stored: string): string {
  const buf = Buffer.from(stored, "base64");
  const d = createDecipheriv("aes-256-gcm", subKey("enc"), buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString("utf8");
}

/** Keyed hash for matching (PAN duplicates). Same input, same hash; useless without the key. */
export const keyedHash = (value: string) => createHmac("sha256", subKey("hash")).update(value.trim().toUpperCase()).digest("hex");

import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Encrypted private file storage on the server's disk (development / single server).
 * Each file: AES-256-GCM, random 12-byte IV, stored as [iv | authTag | ciphertext]
 * under a random name. Nothing in /public, nothing guessable.
 * Production: swap for a private, encrypted cloud bucket (India region) with the same interface.
 */
const ROOT = path.resolve(process.env.STORAGE_DIR ?? "./storage", "documents");

function key(): Buffer {
  const raw = process.env.DOCUMENT_ENCRYPTION_KEY;
  if (raw) {
    const k = Buffer.from(raw, "base64");
    if (k.length !== 32) throw new Error("DOCUMENT_ENCRYPTION_KEY must be 32 bytes, base64-encoded");
    return k;
  }
  if (process.env.NODE_ENV === "production") throw new Error("DOCUMENT_ENCRYPTION_KEY is not set");
  // Development only: a fixed key so local uploads survive restarts. Never use in production.
  return createHash("sha256").update("loansforindia-dev-only-key").digest();
}

export async function saveEncrypted(data: Buffer): Promise<string> {
  await mkdir(ROOT, { recursive: true });
  const storageKey = randomBytes(24).toString("hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(data), cipher.final()]);
  await writeFile(path.join(ROOT, `${storageKey}.bin`), Buffer.concat([iv, cipher.getAuthTag(), enc]), { mode: 0o600 });
  return storageKey;
}

export async function readDecrypted(storageKey: string): Promise<Buffer> {
  if (!/^[a-f0-9]{48}$/.test(storageKey)) throw new Error("Bad storage key");
  const buf = await readFile(path.join(ROOT, `${storageKey}.bin`));
  const decipher = createDecipheriv("aes-256-gcm", key(), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]);
}

export async function deleteStored(storageKey: string): Promise<void> {
  if (!/^[a-f0-9]{48}$/.test(storageKey)) return;
  await unlink(path.join(ROOT, `${storageKey}.bin`)).catch(() => {});
}

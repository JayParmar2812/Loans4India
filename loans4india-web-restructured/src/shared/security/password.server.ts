import "server-only";
import { argon2, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/**
 * Staff password hashing: Argon2id with the OWASP baseline (19 MiB, 2 passes, 1 lane).
 * Stored as "argon2id$m=19456,t=2,p=1$<salt b64>$<hash b64>".
 * Accounts created before this kept scrypt "salt:hash" (hex); they still verify and are re-hashed at the next sign-in.
 */
const PARAMS = { memory: 19456, passes: 2, parallelism: 1, tagLength: 32 } as const;
const argon2Async = promisify(argon2);
const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const MIN_PASSWORD = 12;

async function derive(pw: string, salt: Buffer, p: { memory: number; passes: number; parallelism: number; tagLength: number }) {
  return argon2Async("argon2id", { message: pw, nonce: salt, ...p });
}

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await derive(pw, salt, PARAMS);
  return `argon2id$m=${PARAMS.memory},t=${PARAMS.passes},p=${PARAMS.parallelism}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  try {
    if (stored.startsWith("argon2id$")) {
      const [, params, saltB64, hashB64] = stored.split("$");
      const m = /^m=(\d+),t=(\d+),p=(\d+)$/.exec(params ?? "");
      if (!m || !saltB64 || !hashB64) return false;
      const want = Buffer.from(hashB64, "base64");
      const got = await derive(pw, Buffer.from(saltB64, "base64"), { memory: +m[1], passes: +m[2], parallelism: +m[3], tagLength: want.length });
      return want.length === got.length && timingSafeEqual(want, got);
    }
    const [salt, hash] = stored.split(":");
    if (!salt || !hash) return false;
    const want = Buffer.from(hash, "hex");
    const got = await scryptAsync(pw, Buffer.from(salt, "hex"), want.length);
    return want.length === got.length && timingSafeEqual(want, got);
  } catch {
    return false;
  }
}

/** True when a stored hash should be replaced at the next successful sign-in. */
export const needsRehash = (stored: string) => !stored.startsWith(`argon2id$m=${PARAMS.memory},t=${PARAMS.passes},p=${PARAMS.parallelism}$`);

/** Basic strength rules for staff passwords (length matters most; block the obvious). */
export function passwordProblem(pw: string, username: string): string | null {
  if (pw.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  if (pw.length > 200) return "That password is too long.";
  if (pw.toLowerCase().includes(username.toLowerCase())) return "The password can't contain the username.";
  if (/^(.)\1+$/.test(pw) || ["password", "change-me-now", "loans4india", "loansforindia", "123456789012"].some((w) => pw.toLowerCase().includes(w))) {
    return "That password is too easy to guess.";
  }
  return null;
}

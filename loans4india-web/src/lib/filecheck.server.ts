import "server-only";
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { MAX_FILE_BYTES } from "./documents";

export type Detected = { mime: "application/pdf" | "image/jpeg" | "image/png"; ext: "pdf" | "jpg" | "png" };

/** Identify the real file type from its first bytes. The browser's claim is ignored. */
export function detectType(buf: Buffer): Detected | null {
  if (buf.length >= 5 && buf.subarray(0, 5).toString("latin1") === "%PDF-") return { mime: "application/pdf", ext: "pdf" };
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: "image/png", ext: "png" };
  return null;
}

/** Password-protected PDFs carry an /Encrypt entry in the trailer. */
export function isEncryptedPdf(buf: Buffer): boolean {
  const tail = buf.subarray(Math.max(0, buf.length - 4096)).toString("latin1");
  return /\/Encrypt\s/.test(tail) || /\/Encrypt\s+\d+\s+\d+\s+R/.test(buf.subarray(0, 4096).toString("latin1"));
}

export function checkFile(buf: Buffer): { ok: true; type: Detected } | { ok: false; error: string } {
  if (buf.length === 0) return { ok: false, error: "This file is empty." };
  if (buf.length > MAX_FILE_BYTES) return { ok: false, error: "This file is bigger than 10 MB. Please upload a smaller copy." };
  const type = detectType(buf);
  if (!type) return { ok: false, error: "Only PDF, JPG or PNG files are accepted." };
  if (type.ext === "pdf" && isEncryptedPdf(buf)) {
    return {
      ok: false,
      error: "This PDF is password-protected. Download it again without a password (or open it and use Print → Save as PDF), then upload.",
    };
  }
  return { ok: true, type };
}

/**
 * Malware scan. Uses ClamAV when CLAMSCAN_PATH is set (clamscan or clamdscan).
 * In development without ClamAV the scan is skipped and recorded as SKIPPED_DEV.
 * In production a missing scanner refuses the upload.
 */
export async function scanFile(buf: Buffer): Promise<"CLEAN" | "SKIPPED_DEV" | "INFECTED" | "UNAVAILABLE"> {
  const bin = process.env.CLAMSCAN_PATH;
  if (!bin) return process.env.NODE_ENV === "production" ? "UNAVAILABLE" : "SKIPPED_DEV";
  const tmp = path.join(os.tmpdir(), `lfi-scan-${randomBytes(8).toString("hex")}`);
  await writeFile(tmp, buf, { mode: 0o600 });
  try {
    const code = await new Promise<number>((resolve) => {
      execFile(bin, ["--no-summary", tmp], { timeout: 60_000 }, (err) => resolve(err ? (typeof err.code === "number" ? err.code : 2) : 0));
    });
    return code === 0 ? "CLEAN" : code === 1 ? "INFECTED" : "UNAVAILABLE";
  } finally {
    await unlink(tmp).catch(() => {});
  }
}

/** Keep a harmless display name: letters, digits, dot, dash, underscore, space. */
export function cleanName(name: string, ext: string): string {
  const base = (name || "document").replace(/\.[^.]+$/, "").replace(/[^\w .-]+/g, "").trim().slice(0, 60) || "document";
  return `${base}.${ext}`;
}

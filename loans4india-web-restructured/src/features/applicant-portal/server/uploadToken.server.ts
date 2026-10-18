import "server-only";
import { createHash, randomBytes } from "node:crypto";

// The applicant follows their application through this link until OTP sign-in exists, so it lasts beyond the bank stage.
export const UPLOAD_TOKEN_DAYS = 30;

export function newUploadToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token), expiresAt: new Date(Date.now() + UPLOAD_TOKEN_DAYS * 864e5) };
}

export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

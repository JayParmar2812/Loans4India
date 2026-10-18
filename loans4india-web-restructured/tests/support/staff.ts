import { prisma } from "@/shared/db/db";
import { hashPassword } from "@/shared/security/password.server";
import { encryptField } from "@/shared/security/fieldCrypto.server";
import { newTotpSecret, totpAt } from "@/shared/security/totp";
import { newOpaqueToken } from "@/shared/security/request.server";
import { requestContext } from "./context";
import type { Role } from "@/features/staff/domain/rbac";

export const STAFF_PASSWORD = "tulip-kettle-orbit-91";

/** A staff account with MFA already enrolled. Returns its TOTP secret. */
export async function createStaff(username: string, role: Role, banks: string[] = []) {
  const secret = newTotpSecret();
  await prisma.staffAccount.create({
    data: { username, name: username, role, banks: JSON.stringify(banks), passwordHash: await hashPassword(STAFF_PASSWORD), mfaSecretEnc: encryptField(secret), mfaEnabledAt: new Date(), createdBy: "test" },
  });
  return secret;
}

/** Put a signed-in (MFA passed) session for this person into the current browser, without the UI. */
export async function actAs(username: string) {
  const { token, hash } = newOpaqueToken();
  await prisma.staffSession.create({ data: { tokenHash: hash, username, mfaPassed: true, expiresAt: new Date(Date.now() + 3600e3) } });
  requestContext.cookies = new Map([["l4i_staff", token]]);
}

export const currentCode = (secret: string) => totpAt(secret, Date.now() / 1000);

export function form(fields: Record<string, string | string[] | File>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (Array.isArray(v)) v.forEach((x) => fd.append(k, x));
    else fd.set(k, v);
  }
  return fd;
}

/** Run a server action that ends in redirect(); return where it went. */
export async function redirectOf(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (e) {
    const to = (e as { redirectTo?: string }).redirectTo;
    if (to) return to;
    throw e;
  }
}

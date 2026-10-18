"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/shared/db/db";
import { hashPassword, needsRehash, verifyPassword } from "@/shared/security/password.server";
import { clientIp, rateLimited, userAgentOf } from "@/shared/security/request.server";
import { decryptField } from "@/shared/security/fieldCrypto.server";
import { verifyTotp } from "@/shared/security/totp";
import { endStaffSession, readStaffSession, revokeStaffSessions, startStaffSession } from "@/features/staff/server/staffSession.server";
import { safeNext } from "@/features/staff/domain/safeNext";

export type AuthState = { error?: string } | null;

/** Wrong password this many times in a row locks the account for LOCK_MINUTES. */
const MAX_FAILS = 5;
const LOCK_MINUTES = 15;
// Verified against when the username doesn't exist, so a missing account takes as long as a wrong password.
let dummyHash: Promise<string> | null = null;
const GENERIC = "Wrong username or password, or this login is locked for a while. Try again later or ask the master admin.";

async function audit(type: string, target: string, detail: Record<string, unknown> = {}) {
  await prisma.adminEvent.create({ data: { type, actor: `staff:${target}`, target, detail: JSON.stringify(detail) } });
}

export async function signIn(_prev: AuthState, fd: FormData): Promise<AuthState> {
  const h = await headers();
  const ip = clientIp(h);
  const username = String(fd.get("username") ?? "").trim().toLowerCase().slice(0, 40);
  const password = String(fd.get("password") ?? "").slice(0, 200);
  const next = safeNext(String(fd.get("next") ?? ""));
  if (!username || !password) return { error: "Enter your username and password." };
  if (rateLimited(`staff-login-ip:${ip}`, 30, 15 * 60_000) || rateLimited(`staff-login-user:${username}`, 10, 15 * 60_000)) {
    return { error: "Too many sign-in attempts. Wait 15 minutes and try again." };
  }

  const acc = await prisma.staffAccount.findUnique({ where: { username } });
  if (!acc || !acc.active) {
    dummyHash ??= hashPassword("not-a-real-password-0000");
    await verifyPassword(password, await dummyHash);
    return { error: GENERIC };
  }
  if (acc.lockedUntil && acc.lockedUntil > new Date()) return { error: GENERIC };

  if (!(await verifyPassword(password, acc.passwordHash))) {
    const fails = acc.failedLogins + 1;
    const lock = fails >= MAX_FAILS;
    await prisma.staffAccount.update({
      where: { username },
      data: lock ? { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) } : { failedLogins: fails },
    });
    await audit(lock ? "STAFF_LOCKED" : "STAFF_SIGN_IN_FAILED", username, { ip });
    return { error: GENERIC };
  }

  await prisma.staffAccount.update({
    where: { username },
    data: { failedLogins: 0, lockedUntil: null, ...(needsRehash(acc.passwordHash) ? { passwordHash: await hashPassword(password) } : {}) },
  });
  await startStaffSession(username, { ip, userAgent: userAgentOf(h) });
  redirect(`/admin/mfa${next !== "/admin" ? `?next=${encodeURIComponent(next)}` : ""}`);
}

/** Second step: the TOTP code. First-time sign-in confirms the new authenticator with the same form. */
export async function verifyMfa(_prev: AuthState, fd: FormData): Promise<AuthState> {
  const s = await readStaffSession();
  if (s.kind === "ok") redirect("/admin");
  if (s.kind !== "mfa") redirect("/admin/login");
  const code = String(fd.get("code") ?? "").replace(/\s/g, "");
  const next = safeNext(String(fd.get("next") ?? ""));
  if (rateLimited(`staff-mfa:${s.sessionId}`, 5, 10 * 60_000)) {
    await prisma.staffSession.update({ where: { id: s.sessionId }, data: { revokedAt: new Date() } });
    await audit("STAFF_MFA_FAILED", s.username, { note: "too many wrong codes; session ended" });
    redirect("/admin/login?error=mfa");
  }
  const acc = await prisma.staffAccount.findUniqueOrThrow({ where: { username: s.username } });
  if (!acc.mfaSecretEnc) return { error: "Set up your authenticator first. Reload this page." };
  const step = verifyTotp(decryptField(acc.mfaSecretEnc), code);
  if (step === null || (acc.mfaLastStep !== null && step <= acc.mfaLastStep)) {
    await audit("STAFF_MFA_FAILED", s.username);
    return { error: "That code didn't work. Check the time on your phone and use the newest code." };
  }
  const enrolling = !acc.mfaEnabledAt;
  await prisma.$transaction(async (tx) => {
    await tx.staffAccount.update({ where: { username: s.username }, data: { mfaLastStep: step, lastLoginAt: new Date(), ...(enrolling ? { mfaEnabledAt: new Date() } : {}) } });
    await tx.staffSession.update({ where: { id: s.sessionId }, data: { mfaPassed: true, lastSeenAt: new Date() } });
    // Enrolling a new authenticator ends every other session of this person.
    if (enrolling) await tx.staffSession.updateMany({ where: { username: s.username, id: { not: s.sessionId }, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.adminEvent.create({ data: { type: enrolling ? "STAFF_MFA_ENROLLED" : "STAFF_SIGNED_IN", actor: `staff:${s.username}`, target: s.username, detail: "{}" } });
  });
  redirect(next);
}

export async function signOut() {
  const s = await readStaffSession();
  if (s.kind === "ok") await audit("STAFF_SIGNED_OUT", s.user.username);
  await endStaffSession();
  redirect("/admin/login");
}

/** Sign out everywhere else (e.g. after using a shared computer). */
export async function signOutOtherSessions() {
  const s = await readStaffSession();
  if (s.kind !== "ok") redirect("/admin/login");
  await revokeStaffSessions(s.user.username);
  await audit("STAFF_SESSIONS_REVOKED", s.user.username, { note: "signed out everywhere" });
  await endStaffSession();
  redirect("/admin/login");
}

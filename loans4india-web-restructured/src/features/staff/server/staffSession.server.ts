import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/shared/db/db";
import { isRole, type StaffUser } from "@/features/staff/domain/rbac";
import { newOpaqueToken, sha256 } from "@/shared/security/request.server";

type Tx = Prisma.TransactionClient;

/**
 * Staff sessions (Platform Flow v4, sections 27 and 44).
 * A random token in an HttpOnly, SameSite=Strict cookie; only its hash is stored. A session counts only after the TOTP step.
 * 15 minutes idle or 12 hours in total ends it. Changing a person's password, role, MFA or access revokes their sessions.
 */
export const IDLE_MINUTES = 15;
export const ABSOLUTE_HOURS = 12;
const TOUCH_EVERY_MS = 60_000;

const secureCookies = () => process.env.NODE_ENV === "production";
/** "__Host-" pins the cookie to this exact host over HTTPS; browsers refuse it over plain http, so dev uses a plain name. */
export const staffCookieName = () => (secureCookies() ? "__Host-l4i_staff" : "l4i_staff");

export async function startStaffSession(username: string, meta: { ip: string; userAgent: string | null }) {
  const { token, hash } = newOpaqueToken();
  const expiresAt = new Date(Date.now() + ABSOLUTE_HOURS * 3600e3);
  await prisma.staffSession.create({ data: { tokenHash: hash, username, ip: meta.ip, userAgent: meta.userAgent, expiresAt } });
  (await cookies()).set(staffCookieName(), token, {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: "strict",
    path: "/",
    maxAge: ABSOLUTE_HOURS * 3600,
  });
}

export async function endStaffSession() {
  const jar = await cookies();
  const token = jar.get(staffCookieName())?.value;
  if (token) await prisma.staffSession.updateMany({ where: { tokenHash: sha256(token), revokedAt: null }, data: { revokedAt: new Date() } });
  jar.delete(staffCookieName());
}

/** Revoke every session of one person (password, role, MFA or access change; leaver). */
export async function revokeStaffSessions(username: string, db: Tx | typeof prisma = prisma) {
  await db.staffSession.updateMany({ where: { username, revokedAt: null }, data: { revokedAt: new Date() } });
}

export type SessionState =
  | { kind: "none" }
  | { kind: "mfa"; sessionId: string; username: string; enrolled: boolean }
  | { kind: "ok"; sessionId: string; user: StaffUser };

const parseBanks = (s: string): string[] => {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
};

/** The session behind this request's cookie, checked against the database every time (never trusted from the browser). */
export const readStaffSession = cache(async (): Promise<SessionState> => {
  const token = (await cookies()).get(staffCookieName())?.value;
  if (!token || token.length > 100) return { kind: "none" };
  const s = await prisma.staffSession.findUnique({ where: { tokenHash: sha256(token) } });
  const now = Date.now();
  if (!s || s.revokedAt || s.expiresAt.getTime() <= now) return { kind: "none" };
  if (now - s.lastSeenAt.getTime() > IDLE_MINUTES * 60_000) {
    await prisma.staffSession.update({ where: { id: s.id }, data: { revokedAt: new Date() } });
    return { kind: "none" };
  }
  const acc = await prisma.staffAccount.findUnique({ where: { username: s.username } });
  if (!acc || !acc.active || !isRole(acc.role)) return { kind: "none" };
  if (now - s.lastSeenAt.getTime() > TOUCH_EVERY_MS) await prisma.staffSession.update({ where: { id: s.id }, data: { lastSeenAt: new Date() } });
  if (!s.mfaPassed) return { kind: "mfa", sessionId: s.id, username: acc.username, enrolled: Boolean(acc.mfaEnabledAt) };
  return { kind: "ok", sessionId: s.id, user: { username: acc.username, role: acc.role, name: acc.name, banks: parseBanks(acc.banks) } };
});

/** The signed-in staff member (MFA done), or null. */
export async function sessionStaff(): Promise<StaffUser | null> {
  const s = await readStaffSession();
  return s.kind === "ok" ? s.user : null;
}

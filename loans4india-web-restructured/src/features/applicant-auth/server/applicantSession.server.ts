import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { prisma } from "@/shared/db/db";
import { newOpaqueToken, sha256 } from "@/shared/security/request.server";

/**
 * Applicant sign-in after OTP (Platform Flow v4, section 4): proves the mobile, nothing else.
 * The session sees only applications on that mobile. 15 minutes idle (proposed default) or 4 hours in total ends it.
 * SameSite=Lax so a sign-in link opened from an SMS still carries the cookie.
 */
export const APPLICANT_IDLE_MINUTES = 15;
const ABSOLUTE_HOURS = 4;
const TOUCH_EVERY_MS = 60_000;

const secure = () => process.env.NODE_ENV === "production";
export const applicantCookieName = () => (secure() ? "__Host-l4i_applicant" : "l4i_applicant");

export async function startApplicantSession(mobile: string) {
  const { token, hash } = newOpaqueToken();
  await prisma.applicantSession.create({ data: { tokenHash: hash, mobile, expiresAt: new Date(Date.now() + ABSOLUTE_HOURS * 3600e3) } });
  (await cookies()).set(applicantCookieName(), token, { httpOnly: true, secure: secure(), sameSite: "lax", path: "/", maxAge: ABSOLUTE_HOURS * 3600 });
}

export async function endApplicantSession() {
  const jar = await cookies();
  const token = jar.get(applicantCookieName())?.value;
  if (token) await prisma.applicantSession.updateMany({ where: { tokenHash: sha256(token), revokedAt: null }, data: { revokedAt: new Date() } });
  jar.delete(applicantCookieName());
}

/** The verified mobile behind this request, or null. Checked against the database on every call. */
export const applicantMobile = cache(async (): Promise<string | null> => {
  const token = (await cookies()).get(applicantCookieName())?.value;
  if (!token || token.length > 100) return null;
  const s = await prisma.applicantSession.findUnique({ where: { tokenHash: sha256(token) } });
  const now = Date.now();
  if (!s || s.revokedAt || s.expiresAt.getTime() <= now) return null;
  if (now - s.lastSeenAt.getTime() > APPLICANT_IDLE_MINUTES * 60_000) {
    await prisma.applicantSession.update({ where: { id: s.id }, data: { revokedAt: new Date() } });
    return null;
  }
  if (now - s.lastSeenAt.getTime() > TOUCH_EVERY_MS) await prisma.applicantSession.update({ where: { id: s.id }, data: { lastSeenAt: new Date() } });
  return s.mobile;
});

import "server-only";
import { randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "@/shared/db/db";
import { keyedHash } from "@/shared/security/fieldCrypto.server";
import { brand } from "@/shared/config/brand";
import { maskMobileTail, smsProvider } from "@/shared/messaging/sms.server";

/**
 * Applicant OTP (Platform Flow v4, section 4). Proposed defaults from v4:
 * code valid 5 minutes; 5 wrong tries lock that code; 3 sends per mobile per 10 minutes; per-IP throttle.
 * Only a keyed hash of each code is stored. Responses never reveal whether a mobile already has an application.
 */
export const OTP = { ttlMs: 5 * 60_000, maxTries: 5, sendsPerMobile: 3, sendsPerIp: 10, windowMs: 10 * 60_000, resendAfterMs: 30_000 } as const;

const codeHash = (challengeId: string, code: string) => keyedHash(`otp|${challengeId}|${code}`);

export type OtpResult = { ok: true } | { ok: false; status: number; error: string };

export async function requestOtp(mobile: string, ip: string): Promise<OtpResult> {
  const since = new Date(Date.now() - OTP.windowMs);
  const [byMobile, byIp, last] = await Promise.all([
    prisma.otpChallenge.count({ where: { mobile, createdAt: { gte: since } } }),
    ip !== "unknown" ? prisma.otpChallenge.count({ where: { ip, createdAt: { gte: since } } }) : Promise.resolve(0),
    prisma.otpChallenge.findFirst({ where: { mobile }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
  ]);
  if (byMobile >= OTP.sendsPerMobile || byIp >= OTP.sendsPerIp) {
    return { ok: false, status: 429, error: "Too many codes requested. Please wait 10 minutes and try again." };
  }
  if (last && Date.now() - last.createdAt.getTime() < OTP.resendAfterMs) {
    return { ok: false, status: 429, error: "Please wait 30 seconds before asking for another code." };
  }
  const provider = smsProvider();
  if (!provider) return { ok: false, status: 503, error: "We can't send verification codes right now. Please try again later." };

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const challenge = await prisma.otpChallenge.create({ data: { mobile, codeHash: "pending", expiresAt: new Date(Date.now() + OTP.ttlMs), ip } });
  await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { codeHash: codeHash(challenge.id, code) } });
  const text = `${code} is your ${brand.name} verification code. It expires in 5 minutes. Never share it with anyone, including our staff.`;
  const sent = await provider.send(mobile, text, { template: "OTP", dltTemplateId: process.env.DLT_TEMPLATE_OTP });
  // The delivery log never holds the code itself.
  await prisma.messageLog.create({
    data: {
      template: "OTP", channel: "SMS", recipient: maskMobileTail(mobile), body: "[verification code]", provider: sent.provider,
      status: sent.ok ? "SENT" : "FAILED", providerRef: sent.ok ? sent.ref : null, error: sent.ok ? null : sent.error,
    },
  });
  if (!sent.ok) return { ok: false, status: 503, error: "We couldn't send the code. Please try again in a minute." };
  return { ok: true };
}

/** Check a code. Success consumes it, so it can't be used twice. */
export async function checkOtp(mobile: string, code: string): Promise<OtpResult> {
  if (!/^\d{6}$/.test(code)) return { ok: false, status: 422, error: "Enter the 6-digit code." };
  const ch = await prisma.otpChallenge.findFirst({ where: { mobile, consumedAt: null }, orderBy: { createdAt: "desc" } });
  if (!ch || ch.expiresAt < new Date()) return { ok: false, status: 410, error: "This code has expired. Ask for a new one." };
  // Count the try first (atomically), so parallel guesses can't exceed the limit.
  const counted = await prisma.otpChallenge.updateMany({ where: { id: ch.id, attempts: { lt: OTP.maxTries }, consumedAt: null }, data: { attempts: { increment: 1 } } });
  if (counted.count === 0) return { ok: false, status: 429, error: "Too many wrong codes. Ask for a new one." };
  const want = Buffer.from(ch.codeHash, "hex");
  const got = Buffer.from(codeHash(ch.id, code), "hex");
  if (want.length !== got.length || !timingSafeEqual(want, got)) {
    const left = OTP.maxTries - (ch.attempts + 1);
    return { ok: false, status: 422, error: left > 0 ? `That code is not right. ${left} ${left === 1 ? "try" : "tries"} left.` : "Too many wrong codes. Ask for a new one." };
  }
  const used = await prisma.otpChallenge.updateMany({ where: { id: ch.id, consumedAt: null }, data: { consumedAt: new Date() } });
  if (used.count === 0) return { ok: false, status: 410, error: "This code was already used. Ask for a new one." };
  return { ok: true };
}

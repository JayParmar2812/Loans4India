import { expect } from "vitest";
import { devOutbox } from "@/shared/messaging/sms.server";
import { POST as sendOtp } from "@/app/api/otp/send/route";
import { POST as verifyOtp } from "@/app/api/otp/verify/route";
import { POST as createApplication } from "@/app/api/applications/route";
import { getLiveFlow } from "@/features/applicant-flow/server/applicantFlow.server";
import { consentNotice } from "@/features/consent/domain/consent";
import { req } from "./context";

/** The newest OTP the console SMS provider "sent" to this mobile. */
export function lastOtp(mobile: string): string {
  const m = [...devOutbox].reverse().find((x) => x.to === mobile && x.template === "OTP");
  if (!m) throw new Error(`no OTP sent to ${mobile}`);
  return m.text.slice(0, 6);
}

/** Request and enter an OTP in the current browser. */
export async function signInApplicant(mobile: string) {
  const s = await sendOtp(req("/api/otp/send", { json: { mobile } }) as never);
  expect(s.status).toBe(200);
  const v = await verifyOtp(req("/api/otp/verify", { json: { mobile, code: lastOtp(mobile) } }) as never);
  expect(v.status).toBe(200);
}

/** Start a personal-loan application as the signed-in applicant. */
export async function startApplication(mobile: string, product = "PERSONAL_LOAN", loanAmount = 300000) {
  const { flow } = await getLiveFlow();
  const notice = consentNotice(product, flow);
  const res = await createApplication(
    req("/api/applications", { json: { product, loanAmount, mobile, consentRequired: true, consentMarketing: false, bankListVersion: notice.bankListVersion } }) as never,
  );
  return { res, body: (await res.json()) as { ok: boolean; status?: string; reference?: string; error?: string } };
}

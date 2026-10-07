import "server-only";
import { createHash } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { requiredNoticeText, REQUIRED_PURPOSES, type ConsentNotice, type ConsentPurpose } from "./consent";

type Tx = Prisma.TransactionClient;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

/** Append consent records exactly as shown: one row per purpose, with text, hash, notice and bank-list versions. */
export async function recordConsent(
  tx: Tx,
  applicationId: string,
  n: ConsentNotice,
  choice: { required: boolean; marketing: boolean },
  evidence: { ip: string | null; userAgent: string | null },
) {
  const reqText = requiredNoticeText(n);
  const rows: { purpose: ConsentPurpose; granted: boolean; text: string }[] = [
    ...REQUIRED_PURPOSES.map((p) => ({ purpose: p, granted: choice.required, text: reqText })),
    { purpose: "MARKETING", granted: choice.marketing, text: n.marketingText },
  ];
  await tx.consentRecord.createMany({
    data: rows.map((r) => ({
      applicationId,
      purpose: r.purpose,
      granted: r.granted,
      noticeVersion: n.version,
      noticeText: r.text,
      noticeHash: sha(r.text),
      bankListVersion: n.bankListVersion,
      banksNamed: r.purpose === "SHARE_WITH_PARTNER_LENDERS" ? JSON.stringify(n.bankIds) : null,
      ipAddress: evidence.ip,
      userAgent: evidence.userAgent,
    })),
  });
  return n;
}

/** Revocation: a new row per required purpose with granted = false (records are never edited). */
export async function recordRevocation(tx: Tx, applicationId: string, evidence: { ip: string | null; userAgent: string | null }) {
  const text = "Applicant withdrew consent.";
  await tx.consentRecord.createMany({
    data: [...REQUIRED_PURPOSES, "MARKETING"].map((p) => ({
      applicationId, purpose: p, granted: false, noticeVersion: "REVOCATION", noticeText: text, noticeHash: sha(text), ipAddress: evidence.ip, userAgent: evidence.userAgent,
    })),
  });
}

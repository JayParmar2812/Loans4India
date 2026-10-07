import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "./db";
import { hashToken } from "./uploadToken.server";
import { readDecrypted } from "./storage.server";
import { buildZip } from "./zip.server";
import { appFlow, checklistFor, slotTitle } from "@/config/applicantFlow";
import { detailValues } from "./details.server";
import { decryptField } from "./fieldCrypto.server";
import { bankFileName, mapFields, packageValues } from "./bankFlow";
import { consentState } from "./consentState";
import { bankById, BANK_SHARE_LINKS_ENABLED } from "@/config/banks";
import { brand } from "@/config/brand";
import { EMPLOYMENT_LABELS } from "./validation";
import { formatINR } from "./format";

const slug = (s: string) => s.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "bank";

const EXT: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };
const ist = (d: Date) => d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

/** Accepted documents of an application, in checklist order. Only accepted versions ever go to a bank. */
export async function acceptedDocuments(applicationId: string) {
  const app = await prisma.loanApplication.findUniqueOrThrow({
    where: { id: applicationId },
    include: { documents: { where: { status: "ACCEPTED" }, orderBy: { createdAt: "asc" } }, consents: { orderBy: { createdAt: "asc" } } },
  });
  const order = checklistFor(appFlow(app), app.employmentType).map((s) => s.id as string);
  const rank = (slot: string) => (order.includes(slot) ? order.indexOf(slot) : 99);
  const docs = [...app.documents].sort((a, b) => rank(a.slot) - rank(b.slot) || +a.createdAt - +b.createdAt);
  return { app, docs };
}

/**
 * The package manifest (section 16): template version, mapped field values, document versions and a content hash,
 * so we can prove later exactly what was prepared. PAN appears masked here; the operator's download carries it in full.
 */
export async function buildManifest(applicationId: string, bankId: string) {
  const bank = bankById(bankId);
  if (!bank) throw new Error("Unknown bank");
  const { app, docs } = await acceptedDocuments(applicationId);
  const values = detailValues(app);
  const mapped = mapFields(bank.template, packageValues(app, values, app.panMasked));
  const counter = new Map<string, number>();
  const documents = docs.map((d) => {
    const n = (counter.get(d.slot) ?? 0) + 1;
    counter.set(d.slot, n);
    return { id: d.id, slot: d.slot, sha256: d.sha256, fileName: bankFileName(bank.template, d.slot, app.reference, n, EXT[d.mimeType] ?? "bin") };
  });
  const snapshot = await prisma.applicationSnapshot.findFirst({ where: { applicationId }, orderBy: { version: "desc" }, select: { version: true, contentHash: true } });
  const consent = consentState(app.consents);
  const manifest = {
    reference: app.reference,
    bankId: bank.id,
    bankName: bank.name,
    templateVersion: bank.template.version,
    fields: mapped,
    documents,
    snapshot: snapshot ? { version: snapshot.version, contentHash: snapshot.contentHash } : null,
    consent: { bankListVersion: consent.bankListVersion, noticeVersion: consent.noticeVersion, grantedAt: consent.grantedAt?.toISOString() ?? null },
  };
  const json = JSON.stringify(manifest);
  return { manifest, json, hash: createHash("sha256").update(json).digest("hex"), mapped, documents };
}

/**
 * The operator's download for portal entry (section 18): entry sheet with every bank field (PAN in full, for typing),
 * the accepted documents renamed to the bank's convention, and the frozen manifest.
 */
export async function buildOperatorPackage(applicationId: string, attemptId: string, preparedFor: string) {
  const attempt = await prisma.bankAttempt.findUniqueOrThrow({ where: { id: attemptId } });
  const bank = bankById(attempt.bankId);
  if (!bank || !attempt.manifest) throw new Error("Package not frozen");
  const manifest = JSON.parse(attempt.manifest) as Awaited<ReturnType<typeof buildManifest>>["manifest"];
  const { app, docs } = await acceptedDocuments(applicationId);
  const pan = app.panEnc ? decryptField(app.panEnc) : null;
  const mapped = mapFields(bank.template, packageValues(app, detailValues(app), pan));
  const byId = new Map(docs.map((d) => [d.id, d]));
  const entries: { name: string; data: Buffer }[] = [];
  for (const m of manifest.documents) {
    const d = byId.get(m.id);
    if (!d) throw new Error("A frozen document is no longer accepted");
    entries.push({ name: `${app.reference}/${m.fileName}`, data: await readDecrypted(d.storageKey) });
  }
  const sheet = [
    `PORTAL ENTRY SHEET — ${app.reference} — ${bank.name}`,
    `For ${bank.name} submission only. Prepared for ${preparedFor} on ${ist(new Date())} (IST).`,
    `Template ${manifest.templateVersion} · package hash ${attempt.packageHash?.slice(0, 16)}`,
    "",
    "FIELDS (type exactly as shown)",
    ...mapped.map((f) => `  ${f.bankField.padEnd(34)} ${f.value ?? "—"}`),
    "",
    "DOCUMENTS",
    ...manifest.documents.map((d) => `  ${d.fileName}  (${slotTitle(appFlow(app), d.slot)})`),
    "",
    "RULES",
    "  Enter on the bank's own DSA portal with your personal login. Never store this file on a personal device.",
    "  Delete this folder after the bank reference is recorded.",
    `  ${brand.name} is a loan sourcing service (DSA), not a lender. The bank does KYC and makes the credit decision.`,
  ].join("\r\n");
  entries.unshift({ name: `${app.reference}/00-Portal-entry-sheet.txt`, data: Buffer.from(sheet, "utf8") });
  entries.push({ name: `${app.reference}/manifest.json`, data: Buffer.from(JSON.stringify(manifest, null, 2), "utf8") });
  return { zip: buildZip(entries), fileName: `${app.reference}-${bank.id}.zip`, count: manifest.documents.length };
}

/** Find a live bank share link (older "Send to bank" feature), or null. Off while BANK_SHARE_LINKS_ENABLED is false. */
export async function shareForToken(token: string) {
  if (!BANK_SHARE_LINKS_ENABLED) return null;
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null;
  const share = await prisma.bankShare.findUnique({
    where: { linkTokenHash: hashToken(token) },
    include: { application: { select: { reference: true, fullName: true, product: true, loanAmount: true, stage: true } } },
  });
  if (!share || share.revokedAt || !share.linkExpiresAt || share.linkExpiresAt < new Date()) return null;
  if (share.downloadCount >= share.maxDownloads || share.application.stage === "CLOSED") return null;
  return share;
}

/**
 * Build the ZIP a bank receives: a cover sheet with the application details,
 * then each accepted document renamed so the bank can tell what it is.
 */
export async function buildBankPackage(applicationId: string, documentIds: string[], bankName: string, preparedBy: string) {
  const { app, docs: all } = await acceptedDocuments(applicationId);
  const docs = all.filter((d) => documentIds.includes(d.id));
  const counter = new Map<string, number>();
  const entries: { name: string; data: Buffer }[] = [];
  const listed: string[] = [];
  let i = 1;
  for (const d of docs) {
    const n = (counter.get(d.slot) ?? 0) + 1;
    counter.set(d.slot, n);
    const name = `${String(i++).padStart(2, "0")}-${slug(slotTitle(appFlow(app), d.slot))}-${n}.${EXT[d.mimeType] ?? "bin"}`;
    entries.push({ name: `${app.reference}/${name}`, data: await readDecrypted(d.storageKey) });
    listed.push(`  ${name}  (${slotTitle(appFlow(app), d.slot)}, verified ${d.reviewedAt ? ist(d.reviewedAt) : "—"})`);
  }
  const share = [...app.consents].filter((c) => c.purpose === "SHARE_WITH_PARTNER_LENDERS").pop();
  const cover = [
    `LOAN APPLICATION PACKAGE — ${app.reference}`,
    `Prepared for: ${bankName}`,
    `Prepared by: ${preparedBy} on ${ist(new Date())} (IST)`,
    "",
    "APPLICANT",
    `  Name:              ${app.fullName ?? "—"}`,
    `  Mobile:            +91 ${app.mobile}`,
    `  Email:             ${app.email ?? "—"}`,
    `  City / PIN:        ${app.city ?? "—"} / ${app.pincode ?? "—"}`,
    "",
    "LOAN REQUEST",
    `  Product:           ${appFlow(app).loanType.label}`,
    `  Amount:            ${formatINR(app.loanAmount)}`,
    `  Tenure:            ${app.tenureMonths ? `${app.tenureMonths} months` : "—"}`,
    `  Purpose:           ${app.purpose ?? "—"}`,
    "",
    "INCOME",
    `  Employment:        ${EMPLOYMENT_LABELS[app.employmentType as keyof typeof EMPLOYMENT_LABELS] ?? app.employmentType ?? "—"}`,
    `  Employer/business: ${app.employerName ?? "—"}`,
    `  Monthly income:    ${app.monthlyIncome ? formatINR(app.monthlyIncome) : "—"}`,
    `  Existing EMIs:     ${formatINR(app.existingEmi)}`,
    "",
    `DOCUMENTS (${docs.length} files, each checked by our team before sharing)`,
    ...listed,
    "",
    "CONSENT",
    `  Applicant agreed to share this application with lenders on ${share ? ist(share.createdAt) : "—"} (notice ${share?.noticeVersion ?? "—"}).`,
    `  Declaration that details and documents are true: ${app.declarationAt ? ist(app.declarationAt) : "—"}.`,
    "",
    "NOTES FOR THE LENDER",
    "  Aadhaar copies are masked as provided by the applicant. Please complete KYC as per your own policy.",
    `  ${brand.name} is a loan sourcing service (DSA), not a lender. The credit decision is yours.`,
    "  Use these documents only to process this loan application.",
  ].join("\r\n");
  entries.unshift({ name: `${app.reference}/00-Cover-sheet.txt`, data: Buffer.from(cover, "utf8") });
  return { zip: buildZip(entries), fileName: `${app.reference}-${slug(bankName)}.zip`, count: docs.length };
}

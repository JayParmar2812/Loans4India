import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/shared/db/db";
import { resetRateLimits } from "@/shared/security/request.server";
import { runDormancy, runMessages, runPurge } from "@/features/compliance/server/jobs.server";
import { saveEncrypted } from "@/shared/storage/storage.server";
import { newBrowser } from "../support/context";
import { signInApplicant, startApplication } from "../support/flows";

const DAY = 864e5;
const ago = (d: number) => new Date(Date.now() - d * DAY);

async function app(mobile: string) {
  newBrowser();
  await signInApplicant(mobile);
  const { body } = await startApplication(mobile);
  return prisma.loanApplication.findUniqueOrThrow({ where: { reference: body.reference! } });
}

beforeEach(() => resetRateLimits());

describe("dormancy (v4 §26)", () => {
  it("reminds once after 7 idle days and closes as DORMANT after 30", async () => {
    const a = await app("9876600001");
    await prisma.loanApplication.update({ where: { id: a.id }, data: { lastApplicantAt: ago(8) } });
    expect((await runDormancy()).reminded).toBeGreaterThanOrEqual(1);
    await runDormancy();
    expect(await prisma.applicationEvent.count({ where: { applicationId: a.id, type: "REMINDER_QUEUED" } })).toBe(1);
    expect(await prisma.messageLog.count({ where: { applicationId: a.id, template: "REMINDER" } })).toBe(1);

    await prisma.loanApplication.update({ where: { id: a.id }, data: { lastApplicantAt: ago(31) } });
    await runDormancy();
    const after = await prisma.loanApplication.findUniqueOrThrow({ where: { id: a.id } });
    expect(after.stage).toBe("CLOSED");
    expect(after.closedReason).toBe("DORMANT");
  });

  it("never closes an application that is with a bank", async () => {
    const a = await app("9876600002");
    await prisma.loanApplication.update({ where: { id: a.id }, data: { stage: "SUBMITTED_TO_BANK", lastApplicantAt: ago(90) } });
    await runDormancy();
    expect((await prisma.loanApplication.findUniqueOrThrow({ where: { id: a.id } })).stage).toBe("SUBMITTED_TO_BANK");
  });
});

describe("retention purge (v4 §26, §43)", () => {
  it("deletes documents at close+90d and personal fields at close+180d, keeping consent and a no-PII log", async () => {
    const a = await app("9876600003");
    const key = await saveEncrypted(Buffer.from("%PDF-1.4 synthetic"));
    await prisma.applicationDocument.create({ data: { applicationId: a.id, slot: "PAN", originalName: "pan.pdf", mimeType: "application/pdf", sizeBytes: 18, sha256: "x", storageKey: key, scanResult: "SKIPPED_DEV" } });
    await prisma.loanApplication.update({ where: { id: a.id }, data: { stage: "CLOSED", closedReason: "WITHDRAWN", closedAt: ago(100), fullName: "Synthetic Person", email: "s@example.test" } });

    await runPurge();
    let doc = await prisma.applicationDocument.findFirstOrThrow({ where: { applicationId: a.id } });
    expect(doc.status).toBe("PURGED");
    let row = await prisma.loanApplication.findUniqueOrThrow({ where: { id: a.id } });
    expect(row.fullName).toBe("Synthetic Person"); // profile not due yet
    const { readDecrypted } = await import("@/shared/storage/storage.server");
    await expect(readDecrypted(key)).rejects.toThrow();

    await prisma.loanApplication.update({ where: { id: a.id }, data: { closedAt: ago(200) } });
    await runPurge();
    row = await prisma.loanApplication.findUniqueOrThrow({ where: { id: a.id } });
    expect(row.purgedAt).not.toBeNull();
    expect(row.fullName).toBeNull();
    expect(row.email).toBeNull();
    expect(row.mobile).toBe("0000000000");
    expect(await prisma.consentRecord.count({ where: { applicationId: a.id } })).toBeGreaterThan(0); // proof of consent stays
    const logs = await prisma.purgeLog.findMany({ where: { applicationId: a.id } });
    expect(logs.length).toBe(2);
    expect(JSON.stringify(logs)).not.toContain("Synthetic Person");
    doc = await prisma.applicationDocument.findFirstOrThrow({ where: { applicationId: a.id } });
    expect(doc.originalName).toBe("purged");
  });

  it("a legal hold stops the purge", async () => {
    const a = await app("9876600004");
    await prisma.loanApplication.update({ where: { id: a.id }, data: { stage: "CLOSED", closedReason: "WITHDRAWN", closedAt: ago(400), fullName: "Held Person", legalHold: true, legalHoldReason: "dispute" } });
    await runPurge();
    expect((await prisma.loanApplication.findUniqueOrThrow({ where: { id: a.id } })).fullName).toBe("Held Person");
  });
});

describe("message dispatch (v4 §42)", () => {
  it("holds messages in quiet hours and sends them in the day through the provider", async () => {
    const a = await app("9876600005");
    await prisma.$transaction(async (tx) => {
      const { queueMessage } = await import("@/features/applications/server/applicant.server");
      await queueMessage(tx, a.id, "RECEIVED", { reference: a.reference });
    });
    const night = new Date("2026-10-18T17:30:00Z"); // 23:00 IST
    expect((await runMessages(night)).held).toBeGreaterThanOrEqual(1);
    expect(await prisma.messageLog.count({ where: { applicationId: a.id, status: "QUEUED" } })).toBe(1);
    const day = new Date("2026-10-18T06:30:00Z"); // 12:00 IST
    const r = await runMessages(day);
    expect(r.sent).toBeGreaterThanOrEqual(1);
    const m = await prisma.messageLog.findFirstOrThrow({ where: { applicationId: a.id } });
    expect(m.status).toBe("SENT");
    expect(m.provider).toBe("console");
    expect(m.body).not.toMatch(/\d{10}/); // no mobile number or identifiers in the text
  });
});

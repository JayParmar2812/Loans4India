import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/shared/db/db";
import { resetRateLimits } from "@/shared/security/request.server";
import { updateTicket } from "@/features/support/actions/support.actions";
import { legalHold } from "@/features/compliance/actions/compliance.actions";
import { POST as preferences } from "@/app/api/documents/[token]/preferences/route";
import { consentState } from "@/features/consent/domain/consentState";
import { newBrowser, params, req, saveBrowser, useBrowser } from "../support/context";
import { actAs, createStaff, form } from "../support/staff";
import { signInApplicant, startApplication } from "../support/flows";

beforeEach(() => {
  resetRateLimits();
  newBrowser();
});

async function ticket(type: string, verified: boolean) {
  return prisma.supportTicket.create({ data: { reference: `TKT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`, type, name: "Test", mobile: "9876800001", message: "Please help with my data.", verified, dueAt: new Date(Date.now() + 7 * 864e5) } });
}

describe("support and data rights (v4 §36, §41)", () => {
  it("Support can't resolve a data-rights request; Compliance can, and only for a verified requester", async () => {
    await createStaff("sup1", "SUPPORT");
    await createStaff("cmp1", "COMPLIANCE");
    const t = await ticket("DATA_ERASURE", true);
    await actAs("sup1");
    expect((await updateTicket(null, form({ id: t.id, decision: "take" })))?.ok).toBe(true);
    const r1 = await updateTicket(null, form({ id: t.id, decision: "resolve", outcome: "ERASED", note: "Done" }));
    expect(r1?.message).toMatch(/Compliance/);
    await actAs("cmp1");
    expect((await updateTicket(null, form({ id: t.id, decision: "resolve", outcome: "ERASED", note: "Erased, told the requester" })))?.ok).toBe(true);
    const unverified = await ticket("DATA_ACCESS", false);
    expect((await updateTicket(null, form({ id: unverified.id, decision: "resolve", outcome: "DATA_PROVIDED", note: "x" })))?.message).toMatch(/verified/);
    expect(await prisma.supportTicketEvent.count({ where: { ticketId: t.id } })).toBe(2);
  });

  it("a resolution always needs an outcome and what the person was told", async () => {
    await createStaff("sup2", "SUPPORT");
    const t = await ticket("QUERY", false);
    await actAs("sup2");
    expect((await updateTicket(null, form({ id: t.id, decision: "resolve", outcome: "ANSWERED" })))?.ok).toBe(false);
    expect((await updateTicket(null, form({ id: t.id, decision: "resolve", outcome: "ANSWERED", note: "Explained the status" })))?.ok).toBe(true);
  });

  it("roles without support access are refused", async () => {
    await createStaff("exec5", "OPS_EXECUTIVE");
    const t = await ticket("QUERY", false);
    await actAs("exec5");
    expect((await updateTicket(null, form({ id: t.id, decision: "take" })))?.ok).toBe(false);
  });
});

describe("legal hold (v4 §26, §34)", () => {
  it("is set with a reason and lifted only by someone else", async () => {
    await createStaff("cmpA", "COMPLIANCE");
    await createStaff("cmpB", "COMPLIANCE");
    newBrowser();
    await signInApplicant("9876800010");
    const { body } = await startApplication("9876800010");
    await actAs("cmpA");
    expect((await legalHold(null, form({ reference: body.reference!, decision: "set" })))?.ok).toBe(false); // no reason
    expect((await legalHold(null, form({ reference: body.reference!, decision: "set", reason: "Customer dispute" })))?.ok).toBe(true);
    expect((await legalHold(null, form({ reference: body.reference!, decision: "lift" })))?.message).toMatch(/Someone other/);
    await actAs("cmpB");
    expect((await legalHold(null, form({ reference: body.reference!, decision: "lift", reason: "Resolved" })))?.ok).toBe(true);
    expect((await prisma.loanApplication.findUniqueOrThrow({ where: { reference: body.reference! } })).legalHold).toBe(false);
  });
});

describe("marketing preference (v4 §42)", () => {
  it("one tap appends to the consent ledger; another applicant can't change it", async () => {
    await signInApplicant("9876800020");
    const { body } = await startApplication("9876800020");
    const ref = body.reference!;
    const owner = saveBrowser();
    let r = await preferences(req(`/api/documents/${ref}/preferences`, { json: { marketing: true } }) as never, params({ token: ref }));
    expect(r.status).toBe(200);
    const app = await prisma.loanApplication.findUniqueOrThrow({ where: { reference: ref }, include: { consents: true } });
    expect(consentState(app.consents).marketing).toBe(true);
    expect(consentState(app.consents).valid).toBe(true); // service consent untouched

    newBrowser("198.51.100.9");
    await signInApplicant("9876800021");
    r = await preferences(req(`/api/documents/${ref}/preferences`, { json: { marketing: false } }) as never, params({ token: ref }));
    expect(r.status).toBe(404);
    useBrowser(owner);
    const after = await prisma.consentRecord.findMany({ where: { applicationId: app.id } });
    expect(consentState(after).marketing).toBe(true);
  });
});

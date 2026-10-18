import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/shared/db/db";
import { resetRateLimits } from "@/shared/security/request.server";
import { PATCH as saveDetailsRoute } from "@/app/api/documents/[token]/details/route";
import { GET as getState, POST as upload } from "@/app/api/documents/[token]/route";
import { POST as submit } from "@/app/api/documents/[token]/submit/route";
import { assignOwner, gateDecision, passReview, reviewDocument, selectBank, sendToGate, raiseTask } from "@/features/case-management/actions/case.actions";
import { newBrowser, params, req, saveBrowser, useBrowser } from "../support/context";
import { actAs, createStaff, form } from "../support/staff";
import { signInApplicant, startApplication } from "../support/flows";

beforeEach(() => resetRateLimits());

const DETAILS = {
  fullName: "Synthetic Asha Rao", dob: "1992-04-15", gender: "FEMALE", email: "asha@example.test", addressLine: "12 Test Street, Sample Nagar",
  city: "Pune", pincode: "411001", residenceType: "RENTED", employmentType: "SALARIED", employerName: "Example Tech Pvt Ltd", designation: "Analyst",
  workYears: 4, monthlyIncome: 65000, salaryMode: "BANK_TRANSFER", existingEmi: 0, primaryBankName: "Example Bank", tenureMonths: 36, purpose: "MEDICAL", pan: "ZZZZZ1234Z",
};
const pdf = (label: string) => new File([Buffer.from(`%PDF-1.4\n% ${label}\n%%EOF\n`)], `${label}.pdf`, { type: "application/pdf" });

/**
 * Platform Flow v4 MVP1 definition of done: sections 1-17 end to end with a synthetic applicant, through the real
 * API routes and server actions, ending at READY_FOR_BANK with a frozen package and a second-person gate approval.
 */
describe("MVP1 journey: OTP → consent → details → documents → submit → review → bank → gate → Ready for Bank", () => {
  it("works end to end and enforces every hand-off rule", async () => {
    // ---- Applicant ----
    newBrowser("203.0.113.50");
    await signInApplicant("9876900001");
    const { body } = await startApplication("9876900001");
    const ref = body.reference!;
    const p = params({ token: ref });

    const saved = await saveDetailsRoute(req(`/api/documents/${ref}/details`, { method: "PATCH", json: { fields: DETAILS } }) as never, p);
    const savedBody = await saved.json();
    expect(savedBody.errors).toEqual({});

    // Submit is refused while documents are missing (server-side completeness, v4 §9).
    expect((await submit(req(`/api/documents/${ref}/submit`, { json: { declaration: true } }) as never, p)).status).toBe(422);

    const state = (await (await getState(req(`/api/documents/${ref}`) as never, p)).json()).state;
    const required = (state.slots as { id: string; required: boolean }[]).filter((s) => s.required);
    expect(required.length).toBeGreaterThan(0);
    for (const s of required) {
      const fd = new FormData();
      fd.set("slot", s.id);
      fd.set("file", pdf(s.id));
      expect((await upload(req(`/api/documents/${ref}`, { body: fd }) as never, p)).status).toBe(201);
    }
    // A fake file type is refused by its bytes, whatever its name says.
    const fake = new FormData();
    fake.set("slot", required[0].id);
    fake.set("file", new File([Buffer.from("MZ\x90\x00 not a pdf")], "statement.pdf", { type: "application/pdf" }));
    expect((await upload(req(`/api/documents/${ref}`, { body: fake }) as never, p)).status).toBe(422);

    expect((await submit(req(`/api/documents/${ref}/submit`, { json: { declaration: true } }) as never, p)).status).toBe(200);
    // Idempotent: a second tap changes nothing.
    expect((await submit(req(`/api/documents/${ref}/submit`, { json: { declaration: true } }) as never, p)).status).toBe(200);
    const app = await prisma.loanApplication.findUniqueOrThrow({ where: { reference: ref } });
    expect(app.stage).toBe("VERIFICATION_REVIEW");
    expect(await prisma.applicationSnapshot.count({ where: { applicationId: app.id } })).toBe(1);
    const applicant = saveBrowser();

    // ---- Back office ----
    await createStaff("mgr1", "OPS_MANAGER");
    await createStaff("mgr2", "OPS_MANAGER");
    await createStaff("exec1", "OPS_EXECUTIVE");
    await createStaff("exec2", "OPS_EXECUTIVE");

    await actAs("exec1");
    expect((await assignOwner(null, form({ id: app.id, owner: "exec1" })))?.ok).toBe(false); // executives can't assign
    await actAs("mgr1");
    expect((await assignOwner(null, form({ id: app.id, owner: "exec1" })))?.ok).toBe(true);

    // Another executive can't touch a case they don't own (object-level scope).
    await actAs("exec2");
    const docs = await prisma.applicationDocument.findMany({ where: { applicationId: app.id, status: "UPLOADED" } });
    expect((await reviewDocument(null, form({ docId: docs[0].id, decision: "ACCEPTED" })))?.ok).toBe(false);

    // Owner asks for a better copy of one document: Action needed, only that slot reopens for the applicant.
    await actAs("exec1");
    expect((await raiseTask(null, form({ id: app.id, slots: [required[0].id], message: "Please upload a clearer copy of this document.", reasonCode: "BLURRY" })))?.ok).toBe(true);
    expect((await prisma.loanApplication.findUniqueOrThrow({ where: { id: app.id } })).stage).toBe("ACTION_NEEDED");
    useBrowser(applicant);
    const other = required.find((s) => s.id !== required[0].id);
    if (other) {
      const fd = new FormData();
      fd.set("slot", other.id);
      fd.set("file", pdf(`${other.id}-extra`));
      expect((await upload(req(`/api/documents/${ref}`, { body: fd }) as never, p)).status).toBe(409); // locked slot
    }
    const again = new FormData();
    again.set("slot", required[0].id);
    again.set("file", pdf(`${required[0].id}-clearer`));
    expect((await upload(req(`/api/documents/${ref}`, { body: again }) as never, p)).status).toBe(201);
    expect((await submit(req(`/api/documents/${ref}/submit`, { json: { declaration: true } }) as never, p)).status).toBe(200);
    expect(await prisma.applicationSnapshot.count({ where: { applicationId: app.id } })).toBe(2);

    await actAs("exec1");
    for (const d of await prisma.applicationDocument.findMany({ where: { applicationId: app.id, status: "UPLOADED" } })) {
      expect((await reviewDocument(null, form({ docId: d.id, decision: "ACCEPTED" })))?.ok).toBe(true);
    }
    // Every file is now reviewed, nothing is open: review can pass.
    expect((await passReview(null, form({ id: app.id })))?.ok).toBe(true);
    expect((await selectBank(null, form({ id: app.id, bankId: "demo-bank-a", basis: "SOURCING_FIT" })))?.ok).toBe(true);
    expect((await prisma.loanApplication.findUniqueOrThrow({ where: { id: app.id } })).stage).toBe("APPLICATION_PREPARATION");
    expect((await sendToGate(null, form({ id: app.id })))?.ok).toBe(true);

    // Gate: executives can't approve; the preparer can't approve even with the right role (four-eyes, v4 §17).
    expect((await gateDecision(null, form({ id: app.id, decision: "APPROVE" })))?.ok).toBe(false);
    await prisma.bankAttempt.updateMany({ where: { applicationId: app.id }, data: { preparedBy: "staff:mgr2" } }); // simulate a manager preparer
    await actAs("mgr2");
    const self = await gateDecision(null, form({ id: app.id, decision: "APPROVE" }));
    expect(self?.message).toMatch(/check 8/);
    await actAs("mgr1");
    expect((await gateDecision(null, form({ id: app.id, decision: "APPROVE" })))?.ok).toBe(true);

    const done = await prisma.loanApplication.findUniqueOrThrow({ where: { id: app.id }, include: { attempts: true } });
    expect(done.stage).toBe("READY_FOR_BANK");
    expect(done.attempts[0].state).toBe("READY_TO_SUBMIT");
    expect(done.attempts[0].packageHash).toMatch(/^[a-f0-9]{64}$/);
    expect(done.attempts[0].approvedBy).toBe("staff:mgr1");

    // Every state change was audited; the applicant still sees plain words, not internal codes or the bank name.
    expect(await prisma.applicationEvent.count({ where: { applicationId: app.id, type: "STAGE_CHANGED" } })).toBeGreaterThanOrEqual(4);
    useBrowser(applicant);
    const finalState = (await (await getState(req(`/api/documents/${ref}`) as never, p)).json()).state;
    expect(finalState.tracker.title).toMatch(/Under review/i);
    expect(JSON.stringify(finalState)).not.toMatch(/Demo Bank A/);
  });
});

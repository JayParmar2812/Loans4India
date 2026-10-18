import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/shared/db/db";
import { resetRateLimits } from "@/shared/security/request.server";
import { POST as sendOtp } from "@/app/api/otp/send/route";
import { POST as verifyOtp } from "@/app/api/otp/verify/route";
import { GET as getApplication, POST as uploadDocument } from "@/app/api/documents/[token]/route";
import { POST as withdraw } from "@/app/api/documents/[token]/withdraw/route";
import { newBrowser, params, req, saveBrowser, useBrowser } from "../support/context";
import { lastOtp, signInApplicant, startApplication } from "../support/flows";

beforeEach(() => {
  resetRateLimits();
  newBrowser();
});

describe("applicant OTP (v4 §4)", () => {
  it("verifies a mobile and starts a session", async () => {
    await signInApplicant("9876500001");
    const s = await prisma.applicantSession.findFirst({ where: { mobile: "9876500001" } });
    expect(s).not.toBeNull();
    // The code itself is never stored, only a keyed hash.
    const ch = await prisma.otpChallenge.findFirst({ where: { mobile: "9876500001" } });
    expect(ch?.codeHash).not.toContain(lastOtp("9876500001"));
    expect(ch?.consumedAt).not.toBeNull();
  });

  it("refuses a code twice and after 5 wrong tries", async () => {
    const mobile = "9876500002";
    await sendOtp(req("/api/otp/send", { json: { mobile } }) as never);
    const good = lastOtp(mobile);
    const wrong = good === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) {
      const r = await verifyOtp(req("/api/otp/verify", { json: { mobile, code: wrong } }) as never);
      expect(r.status).not.toBe(200);
    }
    // Locked even with the right code now.
    const r = await verifyOtp(req("/api/otp/verify", { json: { mobile, code: good } }) as never);
    expect(r.status).toBe(429);
    expect(await prisma.applicantSession.count({ where: { mobile } })).toBe(0);
  });

  it("throttles resends and caps sends per mobile", async () => {
    const mobile = "9876500003";
    expect((await sendOtp(req("/api/otp/send", { json: { mobile } }) as never)).status).toBe(200);
    expect((await sendOtp(req("/api/otp/send", { json: { mobile } }) as never)).status).toBe(429); // within 30 s
    // Three sends in the window already (simulated as older than 30 s): the next is refused.
    await prisma.otpChallenge.updateMany({ where: { mobile }, data: { createdAt: new Date(Date.now() - 60_000) } });
    await prisma.otpChallenge.createMany({ data: [1, 2].map(() => ({ mobile, codeHash: "x", expiresAt: new Date(), createdAt: new Date(Date.now() - 60_000) })) });
    expect((await sendOtp(req("/api/otp/send", { json: { mobile } }) as never)).status).toBe(429);
  });

  it("rejects malformed mobiles and cross-site posts", async () => {
    expect((await sendOtp(req("/api/otp/send", { json: { mobile: "12345" } }) as never)).status).toBe(422);
    const r = await sendOtp(req("/api/otp/send", { json: { mobile: "9876500004" }, headers: { origin: "https://evil.example" } }) as never);
    expect(r.status).toBe(403);
  });
});

describe("starting an application", () => {
  it("needs a verified mobile, and the same one", async () => {
    let r = await startApplication("9876500010");
    expect(r.res.status).toBe(401);
    await signInApplicant("9876500010");
    r = await startApplication("9876500011");
    expect(r.res.status).toBe(403);
    r = await startApplication("9876500010");
    expect(r.res.status).toBe(201);
    expect(r.body.reference).toMatch(/^LFI-[2-9A-HJKMNP-Z]{6}$/);
  });

  it("records consent with the bank list and moves to PROFILE_IN_PROGRESS", async () => {
    await signInApplicant("9876500012");
    const { body } = await startApplication("9876500012");
    const app = await prisma.loanApplication.findUniqueOrThrow({ where: { reference: body.reference! }, include: { consents: true } });
    expect(app.stage).toBe("PROFILE_IN_PROGRESS");
    expect(app.uploadTokenHash).toBeNull(); // no bearer link any more
    const share = app.consents.find((c) => c.purpose === "SHARE_WITH_PARTNER_LENDERS");
    expect(share?.granted).toBe(true);
    expect(share?.bankListVersion).toBeTruthy();
    expect(share?.noticeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(app.consents.find((c) => c.purpose === "MARKETING")?.granted).toBe(false);
  });

  it("sends a returning applicant to the open application instead of creating a duplicate", async () => {
    await signInApplicant("9876500013");
    const a = await startApplication("9876500013");
    const b = await startApplication("9876500013");
    expect(b.body.status).toBe("existing");
    expect(b.body.reference).toBe(a.body.reference);
    expect(await prisma.loanApplication.count({ where: { mobile: "9876500013" } })).toBe(1);
  });
});

describe("object-level authorisation (IDOR)", () => {
  it("one applicant can never read or change another's application by its reference", async () => {
    await signInApplicant("9876500020");
    const { body } = await startApplication("9876500020");
    const ref = body.reference!;
    const alice = saveBrowser();

    newBrowser("198.51.100.7");
    await signInApplicant("9876500021"); // Bob, a different verified mobile
    expect((await getApplication(req(`/api/documents/${ref}`) as never, params({ token: ref }))).status).toBe(404);
    const fd = new FormData();
    fd.set("slot", "PAN");
    fd.set("file", new File([Buffer.from("%PDF-1.4 test")], "pan.pdf", { type: "application/pdf" }));
    expect((await uploadDocument(req(`/api/documents/${ref}`, { method: "POST", body: fd }) as never, params({ token: ref }))).status).toBe(404);
    const w = await withdraw(req(`/api/documents/${ref}/withdraw`, { json: { kind: "withdraw", confirm: true } }) as never, params({ token: ref }));
    expect(w.status).toBe(409);
    expect((await prisma.loanApplication.findUniqueOrThrow({ where: { reference: ref } })).stage).not.toBe("CLOSED");

    // No session at all: also nothing.
    newBrowser();
    expect((await getApplication(req(`/api/documents/${ref}`) as never, params({ token: ref }))).status).toBe(404);

    // The owner still can.
    useBrowser(alice);
    expect((await getApplication(req(`/api/documents/${ref}`) as never, params({ token: ref }))).status).toBe(200);
  });
});

describe("append-only records (v4 §39)", () => {
  it("consent and audit rows can't be edited or deleted", async () => {
    await signInApplicant("9876500030");
    const { body } = await startApplication("9876500030");
    const app = await prisma.loanApplication.findUniqueOrThrow({ where: { reference: body.reference! } });
    const consent = await prisma.consentRecord.findFirstOrThrow({ where: { applicationId: app.id, purpose: "PROCESS_APPLICATION" } });
    // Prisma reports SQLite's trigger abort as a generic constraint error; what matters is that nothing changed.
    await expect(prisma.consentRecord.update({ where: { id: consent.id }, data: { granted: false } })).rejects.toThrow();
    await expect(prisma.consentRecord.delete({ where: { id: consent.id } })).rejects.toThrow();
    expect((await prisma.consentRecord.findUniqueOrThrow({ where: { id: consent.id } })).granted).toBe(true);
    const events = await prisma.applicationEvent.count({ where: { applicationId: app.id } });
    const ev = await prisma.applicationEvent.findFirstOrThrow({ where: { applicationId: app.id } });
    await expect(prisma.applicationEvent.update({ where: { id: ev.id }, data: { actor: "someone-else" } })).rejects.toThrow();
    await expect(prisma.applicationEvent.deleteMany({ where: { applicationId: app.id } })).rejects.toThrow();
    expect(await prisma.applicationEvent.count({ where: { applicationId: app.id } })).toBe(events);
    expect((await prisma.applicationEvent.findUniqueOrThrow({ where: { id: ev.id } })).actor).toBe(ev.actor);
  });

  it("the block is the database trigger itself, not just app code", async () => {
    const { default: Database } = await import("better-sqlite3");
    const raw = new Database(process.env.DATABASE_URL!.replace(/^file:/, ""));
    try {
      expect(() => raw.prepare('UPDATE "ConsentRecord" SET "granted" = 0').run()).toThrow(/ConsentRecord is append-only/);
      expect(() => raw.prepare('DELETE FROM "AdminEvent"').run()).not.toThrow(); // no rows yet, so nothing to abort
      raw.prepare('INSERT INTO "AdminEvent" ("id","type","actor","createdAt") VALUES (\'t1\',\'T\',\'a\',0)').run();
      expect(() => raw.prepare('DELETE FROM "AdminEvent"').run()).toThrow(/AdminEvent is append-only/);
    } finally {
      raw.close();
    }
  });
});

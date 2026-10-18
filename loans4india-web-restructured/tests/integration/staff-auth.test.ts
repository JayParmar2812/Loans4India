import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/shared/db/db";
import { resetRateLimits } from "@/shared/security/request.server";
import { signIn, verifyMfa } from "@/features/staff/actions/auth.actions";
import { readStaffSession, revokeStaffSessions, sessionStaff } from "@/features/staff/server/staffSession.server";
import { updateStaff } from "@/features/staff/actions/staff.actions";
import { gateDecision, assignOwner } from "@/features/case-management/actions/case.actions";
import { newBrowser, requestContext } from "../support/context";
import { actAs, createStaff, currentCode, form, redirectOf, STAFF_PASSWORD } from "../support/staff";

beforeEach(() => {
  resetRateLimits();
  newBrowser();
});

describe("staff sign-in", () => {
  it("password then TOTP; nothing works between the two steps", async () => {
    const secret = await createStaff("asha", "OPS_MANAGER");
    const to = await redirectOf(signIn(null, form({ username: "asha", password: STAFF_PASSWORD, next: "/admin/applications/x" })));
    expect(to).toBe("/admin/mfa?next=%2Fadmin%2Fapplications%2Fx");
    expect(requestContext.cookies.get("l4i_staff")).toBeTruthy();
    expect(await sessionStaff()).toBeNull(); // password alone is not a session
    expect((await readStaffSession()).kind).toBe("mfa");

    const after = await redirectOf(verifyMfa(null, form({ code: currentCode(secret), next: "/admin/applications/x" })));
    expect(after).toBe("/admin/applications/x");
    expect((await sessionStaff())?.username).toBe("asha");
    expect(await prisma.adminEvent.count({ where: { type: "STAFF_SIGNED_IN", target: "asha" } })).toBe(1);
  });

  it("never accepts the same TOTP code twice", async () => {
    const secret = await createStaff("ravi", "OPS_EXECUTIVE");
    await redirectOf(signIn(null, form({ username: "ravi", password: STAFF_PASSWORD })));
    const code = currentCode(secret);
    await redirectOf(verifyMfa(null, form({ code })));
    newBrowser();
    await redirectOf(signIn(null, form({ username: "ravi", password: STAFF_PASSWORD })));
    const r = await verifyMfa(null, form({ code }));
    expect(r?.error).toMatch(/didn't work/);
  });

  it("gives the same answer for a wrong password and an unknown user, and locks after 5 failures", async () => {
    await createStaff("meera", "COMPLIANCE");
    const unknown = await signIn(null, form({ username: "nobody", password: "whatever-whatever" }));
    const wrong = await signIn(null, form({ username: "meera", password: "wrong-password-123" }));
    expect(unknown?.error).toBe(wrong?.error);
    for (let i = 0; i < 4; i++) await signIn(null, form({ username: "meera", password: "wrong-password-123" }));
    const acc = await prisma.staffAccount.findUniqueOrThrow({ where: { username: "meera" } });
    expect(acc.lockedUntil && acc.lockedUntil > new Date()).toBe(true);
    // Right password while locked: still refused, same message.
    const locked = await signIn(null, form({ username: "meera", password: STAFF_PASSWORD }));
    expect(locked?.error).toBe(wrong?.error);
    expect(await prisma.adminEvent.count({ where: { type: "STAFF_LOCKED", target: "meera" } })).toBe(1);
  });

  it("ends sessions after 15 minutes idle, on revocation, and for disabled accounts", async () => {
    await createStaff("kiran", "OPS_EXECUTIVE");
    await actAs("kiran");
    expect(await sessionStaff()).not.toBeNull();
    await prisma.staffSession.updateMany({ where: { username: "kiran" }, data: { lastSeenAt: new Date(Date.now() - 16 * 60_000) } });
    expect(await sessionStaff()).toBeNull();

    await actAs("kiran");
    await revokeStaffSessions("kiran");
    expect(await sessionStaff()).toBeNull();

    await actAs("kiran");
    await prisma.staffAccount.update({ where: { username: "kiran" }, data: { active: false } });
    expect(await sessionStaff()).toBeNull();
  });

  it("a role change by the master admin ends the person's sessions at once", async () => {
    await createStaff("root", "SUPER_ADMIN");
    await createStaff("dev", "OPS_EXECUTIVE");
    await actAs("dev");
    const devCookies = new Map(requestContext.cookies);
    await actAs("root");
    const r = await updateStaff(null, form({ username: "dev", name: "dev", role: "OPS_MANAGER" }));
    expect(r?.ok).toBe(true);
    requestContext.cookies = devCookies;
    expect(await sessionStaff()).toBeNull();
  });
});

describe("server-side permission checks on actions", () => {
  it("refuses actions a role doesn't have, whatever the browser sends", async () => {
    await createStaff("exec1", "OPS_EXECUTIVE");
    await actAs("exec1");
    const r = await gateDecision(null, form({ id: "anything", decision: "APPROVE" }));
    expect(r).toEqual({ ok: false, message: "You don't have permission for this." });
    const a = await assignOwner(null, form({ id: "anything", owner: "exec1" }));
    expect(a?.ok).toBe(false);
  });

  it("refuses everything without a session", async () => {
    newBrowser();
    const r = await gateDecision(null, form({ id: "anything", decision: "APPROVE" }));
    expect(r?.ok).toBe(false);
  });
});

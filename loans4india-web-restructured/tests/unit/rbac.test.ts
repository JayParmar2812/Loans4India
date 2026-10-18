import { describe, expect, it } from "vitest";
import { can, canSeeCase, ROLES, type Permission, type Role } from "@/features/staff/domain/rbac";

const u = (role: Role, username = "u1", banks: string[] = []) => ({ username, role, name: username, banks });

/** Each role's "Cannot" list from Platform Flow v4, sections 28-37 (MVP1 definition of done: proven by tests). */
const CANNOT: Partial<Record<Role, Permission[]>> = {
  OPS_MANAGER: ["staff.manage", "site.manage", "portal.submit", "audit.view"],
  OPS_EXECUTIVE: ["gate.approve", "application.view_all", "application.assign", "portal.submit", "application.close", "staff.manage", "export.counts"],
  DOCUMENT_REVIEWER: ["bank.select", "gate.approve", "application.close", "pii.reveal"],
  DSA_OPERATOR: ["package.send_to_gate", "gate.approve", "document.review", "application.view_all", "pii.reveal"],
  BANK_MANAGER: ["gate.approve", "portal.submit", "document.review", "pii.reveal"],
  FINANCE: ["application.view_all", "application.view_own", "document.review", "pii.reveal", "support.view"],
  COMPLIANCE: ["task.raise", "document.review", "bank.select", "gate.approve", "portal.submit", "staff.manage", "content.edit"],
  FRAUD_RISK: ["gate.approve", "document.review", "pii.reveal"],
  SUPPORT: ["application.view_all", "application.view_own", "document.review", "pii.reveal", "export.counts"],
  CONTENT_EDITOR: ["content.publish", "application.view_all", "site.manage", "pii.reveal"],
};

describe("RBAC cannot-lists", () => {
  for (const [role, perms] of Object.entries(CANNOT) as [Role, Permission[]][]) {
    it(`${ROLES[role]} cannot ${perms.join(", ")}`, () => {
      for (const p of perms) expect(can(u(role), p), `${role} → ${p}`).toBe(false);
    });
  }
  it("nobody is anonymous", () => {
    expect(can(null, "application.view_own")).toBe(false);
  });
  it("Compliance approves public content; the editor drafts it", () => {
    expect(can(u("COMPLIANCE"), "content.publish")).toBe(true);
    expect(can(u("CONTENT_EDITOR"), "content.edit")).toBe(true);
  });
});

describe("case scope (object-level authorisation)", () => {
  const mine = { ownerId: "u1", stage: "VERIFICATION_REVIEW" };
  const theirs = { ownerId: "u2", stage: "VERIFICATION_REVIEW" };
  it("executives see their own and unassigned cases only", () => {
    expect(canSeeCase(u("OPS_EXECUTIVE"), mine)).toBe(true);
    expect(canSeeCase(u("OPS_EXECUTIVE"), { ownerId: null, stage: "VERIFICATION_REVIEW" })).toBe(true);
    expect(canSeeCase(u("OPS_EXECUTIVE"), theirs)).toBe(false);
  });
  it("operators see only banks they hold a portal login for, and only at the bank stages", () => {
    const op = u("DSA_OPERATOR", "op", ["bank-a"]);
    expect(canSeeCase(op, { ownerId: "x", stage: "READY_FOR_BANK" }, ["bank-a"])).toBe(true);
    expect(canSeeCase(op, { ownerId: "x", stage: "READY_FOR_BANK" }, ["bank-b"])).toBe(false);
    expect(canSeeCase(op, { ownerId: "x", stage: "VERIFICATION_REVIEW" }, ["bank-a"])).toBe(false);
  });
  it("support and finance see no cases", () => {
    expect(canSeeCase(u("SUPPORT"), theirs)).toBe(false);
    expect(canSeeCase(u("FINANCE"), theirs)).toBe(false);
  });
});

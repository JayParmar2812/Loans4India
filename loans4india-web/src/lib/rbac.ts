/**
 * Roles and permissions (Platform Flow v4, sections 27-37).
 * Every server action checks a permission here AND the application's state; hiding a button is never the only control.
 * All ten roles exist so nothing needs redesigning later; MVP1 uses Super Admin (the master admin), Ops Manager,
 * Loan Ops Executive (who also reviews documents) and Compliance & Audit. The DSA Operator is
 * switched on now because portal entry is done by hand from day one.
 */

export const ROLES = {
  SUPER_ADMIN: "Super Admin",
  OPS_MANAGER: "Ops Manager",
  OPS_EXECUTIVE: "Loan Ops Executive",
  DOCUMENT_REVIEWER: "Document Reviewer",
  DSA_OPERATOR: "Authorised DSA Operator",
  BANK_MANAGER: "Bank/Partner Manager",
  FINANCE: "Finance",
  COMPLIANCE: "Compliance & Audit",
  FRAUD_RISK: "Fraud & Risk",
  SUPPORT: "Customer Support",
} as const;
export type Role = keyof typeof ROLES;
export const isRole = (r: string): r is Role => r in ROLES;

export type Permission =
  | "application.view_all"
  | "application.view_own"
  | "application.assign"
  | "document.review"
  | "task.raise"
  | "review.pass"
  | "consent.request"
  | "bank.select"
  | "package.send_to_gate"
  | "gate.approve"
  | "portal.submit"
  | "bank_status.record"
  | "bank_status.check"
  | "decision.reroute"
  | "application.close"
  | "application.propose_close"
  | "hold.set"
  | "flag.resolve"
  | "pii.reveal"
  | "note.add"
  | "export.counts"
  | "audit.view"
  | "staff.manage"
  | "site.manage";

/** Every permission, in one list, so the master admin always has all of them, including ones added later. */
const ALL = [
  "application.view_all", "application.view_own", "application.assign", "document.review", "task.raise", "review.pass",
  "consent.request", "bank.select", "package.send_to_gate", "gate.approve", "portal.submit", "bank_status.record",
  "bank_status.check", "decision.reroute", "application.close", "application.propose_close", "hold.set", "flag.resolve",
  "pii.reveal", "note.add", "export.counts", "audit.view", "staff.manage", "site.manage",
] as const satisfies readonly Permission[];
// Fails to compile if a permission is added above but not to ALL.
const _allCovered: Exclude<Permission, (typeof ALL)[number]> extends never ? true : false = true;
void _allCovered;
export const ALL_PERMISSIONS: Permission[] = [...ALL];

const P: Record<Role, Permission[]> = {
  // Master admin (JP, 5 Oct 2026): every action of every other role, on every case and every bank.
  // The two-person checks (gate approver, bank-status checker, operator vs preparer) still apply per case.
  SUPER_ADMIN: ALL_PERMISSIONS,
  OPS_MANAGER: [
    "application.view_all", "application.assign", "document.review", "task.raise", "review.pass", "consent.request", "bank.select",
    "package.send_to_gate", "gate.approve", "bank_status.record", "bank_status.check", "decision.reroute", "application.close",
    "hold.set", "flag.resolve", "pii.reveal", "note.add", "export.counts",
  ],
  OPS_EXECUTIVE: [
    "application.view_own", "document.review", "task.raise", "review.pass", "consent.request", "bank.select", "package.send_to_gate",
    "bank_status.record", "application.propose_close", "pii.reveal", "note.add",
  ],
  DOCUMENT_REVIEWER: ["application.view_own", "document.review", "task.raise", "note.add"],
  DSA_OPERATOR: ["portal.submit", "bank_status.record", "note.add"],
  BANK_MANAGER: ["bank_status.record", "bank_status.check", "note.add"],
  FINANCE: [],
  COMPLIANCE: ["application.view_all", "hold.set", "flag.resolve", "pii.reveal", "export.counts", "audit.view"],
  FRAUD_RISK: ["application.view_all", "hold.set", "flag.resolve"],
  SUPPORT: [],
};

export type StaffUser = { username: string; role: Role; name: string; banks: string[] };

export const can = (u: StaffUser | null, p: Permission) => Boolean(u && P[u.role].includes(p));

export const isMasterAdmin = (u: StaffUser | null) => u?.role === "SUPER_ADMIN";

/** Does this person hold a portal login for this bank? The master admin covers every bank. */
export const holdsPortal = (u: StaffUser | null, bankId: string) => Boolean(u && (isMasterAdmin(u) || u.banks.includes(bankId)));

/** Can this person see this case at all? Executives see their own cases and the unassigned queue. */
export function canSeeCase(u: StaffUser | null, app: { ownerId: string | null; stage: string }, attemptBankIds: string[] = []): boolean {
  if (!u) return false;
  if (can(u, "application.view_all")) return true;
  if (can(u, "application.view_own") && (app.ownerId === u.username || app.ownerId === null)) return true;
  // Operators see cases waiting for (or already entered on) a bank they hold a portal login for.
  if (u.role === "DSA_OPERATOR" && ["READY_FOR_BANK", "SUBMITTED_TO_BANK"].includes(app.stage) && attemptBankIds.some((b) => u.banks.includes(b))) return true;
  if (u.role === "BANK_MANAGER" && app.stage === "SUBMITTED_TO_BANK") return true;
  return false;
}

/** Case-level actions an executive may take only on cases they own. */
export const isOwnerOrManager = (u: StaffUser | null, app: { ownerId: string | null }) =>
  Boolean(u && (u.role === "OPS_MANAGER" || isMasterAdmin(u) || app.ownerId === u.username));

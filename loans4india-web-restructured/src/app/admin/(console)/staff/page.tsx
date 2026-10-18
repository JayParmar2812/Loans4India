import { notFound } from "next/navigation";
import { BANKS } from "@/features/bank-submission/config/banks";
import { ActionForm } from "@/features/case-management/components/ActionForm";
import { can, ROLES } from "@/features/staff/domain/rbac";
import { currentStaff } from "@/features/staff/server/staff.server";
import { MIN_PASSWORD, staffDirectory } from "@/features/staff/server/staffAuth";
import { prisma } from "@/shared/db/db";
import { createStaff, updateStaff } from "@/features/staff/actions/staff.actions";

export const metadata = { title: "Staff" };

const roleOptions = Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>);

function BankBoxes({ selected = [] }: { selected?: string[] }) {
  return (
    <fieldset className="text-sm">
      <legend className="field-label">Portal logins held (DSA Operators)</legend>
      <div className="flex flex-wrap gap-3">
        {BANKS.map((b) => (
          <label key={b.id} className="flex items-center gap-1.5">
            <input type="checkbox" name="banks" value={b.id} defaultChecked={selected.includes(b.id)} /> {b.name}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** The master admin's staff screen: add people, change roles and bank logins, reset passwords, disable logins. */
export default async function StaffPage() {
  const user = await currentStaff();
  if (!user || !can(user, "staff.manage")) notFound();
  const people = await staffDirectory({ includeDisabled: true });
  const owned = await prisma.loanApplication.groupBy({ by: ["ownerId"], where: { stage: { not: "CLOSED" } }, _count: { _all: true } });
  const openCases = (u: string) => owned.find((o) => o.ownerId === u)?._count._all ?? 0;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-surface p-5 space-y-3">
        <h2 className="font-semibold text-lg">Add a staff member</h2>
        <ActionForm action={createStaff} buttons={[{ label: "Add" }]} className="grid gap-3 sm:grid-cols-2">
          <label><span className="field-label">Username</span><input name="username" className="field-input" autoComplete="off" required /></label>
          <label><span className="field-label">Name</span><input name="name" className="field-input" required /></label>
          <label><span className="field-label">Role</span><select name="role" className="field-input" defaultValue="OPS_EXECUTIVE">{roleOptions}</select></label>
          <label><span className="field-label">Temporary password (at least {MIN_PASSWORD} characters)</span><input name="password" type="password" className="field-input" autoComplete="new-password" required /></label>
          <div className="sm:col-span-2"><BankBoxes /></div>
        </ActionForm>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-lg">Staff ({people.length})</h2>
        {people.map((p) => (
          <div key={p.username} className={`rounded-2xl border border-line bg-surface p-5 space-y-3 ${p.active ? "" : "opacity-70"}`}>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <b>{p.name}</b>
              <span className="font-mono text-sm">{p.username}</span>
              <span className="text-xs rounded-full bg-violet-soft text-violet-deep px-2 py-0.5">{ROLES[p.role]}</span>
              {!p.active && <span className="text-xs rounded-full bg-red-50 text-red-700 px-2 py-0.5">disabled</span>}
              {p.username === user.username && <span className="text-xs text-muted">you</span>}
              <span className="text-xs text-muted">{openCases(p.username)} open cases</span>
              <span className={`text-xs rounded-full px-2 py-0.5 ${p.mfaEnabled ? "bg-mint-soft text-mint-ink" : "bg-amber-100 text-amber-900"}`}>{p.mfaEnabled ? "MFA on" : "MFA not set up yet"}</span>
              {p.locked && <span className="text-xs rounded-full bg-red-50 text-red-700 px-2 py-0.5">locked after failed sign-ins</span>}
              <span className="text-xs text-muted">{p.lastLoginAt ? `last sign-in ${p.lastLoginAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}` : "never signed in"}</span>
            </div>
            {(
              <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
                <ActionForm action={updateStaff} hidden={{ username: p.username }} buttons={[{ label: "Save" }]} className="grid gap-3 sm:grid-cols-2">
                  <label><span className="field-label">Name</span><input name="name" className="field-input" defaultValue={p.name} required /></label>
                  <label><span className="field-label">Role</span><select name="role" className="field-input" defaultValue={p.role}>{roleOptions}</select></label>
                  <div className="sm:col-span-2"><BankBoxes selected={p.banks} /></div>
                </ActionForm>
                <div className="space-y-3">
                  <ActionForm action={updateStaff} hidden={{ username: p.username }} buttons={[{ label: "Set new password", value: "password", tone: "ghost" }]}>
                    <input name="password" type="password" className="field-input" placeholder="New password" autoComplete="new-password" aria-label={`New password for ${p.name}`} />
                  </ActionForm>
                  {p.username !== user.username && p.mfaEnabled && (
                    <ActionForm
                      action={updateStaff}
                      hidden={{ username: p.username }}
                      confirm={`Reset ${p.name}'s authenticator? They will set up a new one at their next sign-in.`}
                      buttons={[{ label: "Reset authenticator", value: "mfa", tone: "ghost" }]}
                    />
                  )}
                  {p.username !== user.username && (
                    <ActionForm
                      action={updateStaff}
                      hidden={{ username: p.username }}
                      confirm={p.active ? `Stop ${p.name} from signing in?` : undefined}
                      buttons={[p.active ? { label: "Disable login", value: "disable", tone: "danger" } : { label: "Enable login", value: "enable", tone: "ok" }]}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}

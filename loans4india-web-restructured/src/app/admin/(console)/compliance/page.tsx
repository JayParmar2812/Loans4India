import { notFound } from "next/navigation";
import { prisma } from "@/shared/db/db";
import { can } from "@/features/staff/domain/rbac";
import { currentStaff } from "@/features/staff/server/staff.server";
import { ActionForm } from "@/features/case-management/components/ActionForm";
import { legalHold } from "@/features/compliance/actions/compliance.actions";
import { retention } from "@/features/compliance/domain/retention";

export const metadata = { title: "Retention & holds" };
const ist = (d: Date) => d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

/** Compliance & Audit (v4 sections 26, 34, 42, 43): retention schedule, legal holds, purge proof and the message log. */
export default async function CompliancePage() {
  const user = await currentStaff();
  if (!user || !can(user, "compliance.manage")) notFound();
  const r = retention();
  const now = new Date().getTime();
  const [holds, closed, purges, messages, msgCounts] = await Promise.all([
    prisma.loanApplication.findMany({ where: { legalHold: true }, select: { reference: true, legalHoldReason: true, legalHoldBy: true, closedAt: true } }),
    prisma.loanApplication.findMany({ where: { stage: "CLOSED", purgedAt: null, legalHold: false }, select: { reference: true, closedAt: true, closedReason: true }, orderBy: { closedAt: "asc" }, take: 50 }),
    prisma.purgeLog.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.messageLog.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.messageLog.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const due = (d: Date | null, days: number) => (d ? new Date(d.getTime() + days * 864e5) : null);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold">Retention & holds</h1>
        <p className="text-sm text-muted">After an application closes: documents are deleted at close + {r.documentsDays} days, personal details at close + {r.profileDays} days (proposed defaults; VERIFY with counsel). Consent records, audit events and the purge log are kept. `npm run jobs` runs the purge.</p>
      </div>

      <section className="card p-5 space-y-4">
        <h2 className="font-bold">Legal holds</h2>
        <ActionForm action={legalHold} buttons={[{ label: "Set hold", value: "set" }, { label: "Lift hold", value: "lift", tone: "ghost" }]} className="grid gap-3 sm:grid-cols-[180px_1fr] items-end">
          <label><span className="field-label">Reference</span><input name="reference" className="field-input font-mono" placeholder="LFI-XXXXXX" required /></label>
          <label><span className="field-label">Reason</span><input name="reason" className="field-input" placeholder="Dispute, fraud case, regulator request…" /></label>
        </ActionForm>
        <ul className="text-sm divide-y divide-line">
          {holds.length === 0 && <li className="py-2 text-muted">No holds.</li>}
          {holds.map((h) => <li key={h.reference} className="py-2"><span className="font-mono">{h.reference}</span> · {h.legalHoldReason} · set by {h.legalHoldBy?.replace("staff:", "")}</li>)}
        </ul>
      </section>

      <section className="card p-5">
        <h2 className="font-bold mb-3">Closed, waiting for purge</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead className="text-left text-muted text-xs"><tr>{["Reference", "Closed", "Reason", "Documents deleted", "Details deleted"].map((h) => <th key={h} className="py-2 pr-4 font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {closed.length === 0 && <tr><td colSpan={5} className="py-4 text-muted">None.</td></tr>}
              {closed.map((c) => {
                const d1 = due(c.closedAt, r.documentsDays);
                const d2 = due(c.closedAt, r.profileDays);
                return (
                  <tr key={c.reference} className="border-t border-line">
                    <td className="py-2 pr-4 font-mono">{c.reference}</td>
                    <td className="py-2 pr-4">{c.closedAt ? ist(c.closedAt) : "?"}</td>
                    <td className="py-2 pr-4">{c.closedReason}</td>
                    <td className={`py-2 pr-4 ${d1 && d1.getTime() < now ? "text-danger" : ""}`}>{d1 ? ist(d1) : "?"}</td>
                    <td className={`py-2 pr-4 ${d2 && d2.getTime() < now ? "text-danger" : ""}`}>{d2 ? ist(d2) : "?"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="font-bold mb-3">Purge log</h2>
        <ul className="text-sm divide-y divide-line">
          {purges.length === 0 && <li className="py-2 text-muted">Nothing purged yet.</li>}
          {purges.map((p) => <li key={p.id} className="py-2"><span className="font-mono">{p.reference}</span> · {(JSON.parse(p.dataClasses) as string[]).join(", ").toLowerCase()} · {p.filesDeleted} files · {ist(p.createdAt)} · {p.jobVersion}</li>)}
        </ul>
      </section>

      <section className="card p-5">
        <h2 className="font-bold mb-1">Message delivery log</h2>
        <p className="text-xs text-muted mb-3">{msgCounts.map((c) => `${c.status.toLowerCase().replaceAll("_", " ")}: ${c._count._all}`).join(" · ") || "No messages yet."} A message is SENT only when a provider accepted it; NO_PROVIDER means it was never sent.</p>
        <ul className="text-sm divide-y divide-line">
          {messages.map((m) => <li key={m.id} className="py-2"><b>{m.template}</b> · {m.channel} · {m.recipient} · <span className="chip bg-canvas border border-line">{m.status}</span> · {ist(m.createdAt)}{m.error ? ` · ${m.error}` : ""}</li>)}
        </ul>
      </section>
    </div>
  );
}

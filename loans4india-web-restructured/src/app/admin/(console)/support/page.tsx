import Link from "next/link";
import { notFound } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/shared/db/db";
import { can } from "@/features/staff/domain/rbac";
import { currentStaff } from "@/features/staff/server/staff.server";
import { ActionForm } from "@/features/case-management/components/ActionForm";
import { updateTicket } from "@/features/support/actions/support.actions";
import { isTicketType, TICKET_OUTCOMES, TICKET_STATUSES, TICKET_TYPES } from "@/features/support/domain/tickets";
import { maskMobile } from "@/shared/utils/format";

export const metadata = { title: "Support & data rights" };
const ist = (d: Date) => d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

const FILTERS: Record<string, { label: string; where: Prisma.SupportTicketWhereInput }> = {
  open: { label: "Open", where: { status: { in: ["OPEN", "IN_PROGRESS", "ESCALATED"] } } },
  overdue: { label: "Overdue", where: { status: { in: ["OPEN", "IN_PROGRESS", "ESCALATED"] }, dueAt: { lt: new Date() } } },
  rights: { label: "Data rights", where: { status: { in: ["OPEN", "IN_PROGRESS", "ESCALATED"] }, type: { notIn: ["QUERY", "COMPLAINT"] } } },
  complaints: { label: "Complaints", where: { status: { in: ["OPEN", "IN_PROGRESS", "ESCALATED"] }, type: "COMPLAINT" } },
  mine: { label: "Mine", where: {} },
  done: { label: "Resolved", where: { status: { in: ["RESOLVED", "CLOSED"] } } },
};

/** Support queue (v4 sections 36, 41). Support sees the request and contact only; never documents or application data. */
export default async function SupportPage({ searchParams }: { searchParams: Promise<{ f?: string; t?: string }> }) {
  const user = await currentStaff();
  if (!user || !can(user, "support.view")) notFound();
  const { f = "open", t: openId } = await searchParams;
  const filter = FILTERS[f] ?? FILTERS.open;
  const where = f === "mine" ? { assignee: user.username, status: { in: ["OPEN", "IN_PROGRESS", "ESCALATED"] } } : filter.where;
  const [rows, counts] = await Promise.all([
    prisma.supportTicket.findMany({ where, orderBy: { dueAt: "asc" }, take: 200 }),
    Promise.all(Object.entries(FILTERS).map(async ([k, v]) => [k, await prisma.supportTicket.count({ where: k === "mine" ? { assignee: user.username, status: { in: ["OPEN", "IN_PROGRESS", "ESCALATED"] } } : v.where })] as const)),
  ]);
  const open = openId ? await prisma.supportTicket.findUnique({ where: { id: openId }, include: { events: { orderBy: { createdAt: "asc" } } } }) : null;
  const manage = can(user, "support.manage");

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold">Support & data rights</h1>
      <nav className="flex flex-wrap gap-2" aria-label="Ticket filters">
        {counts.map(([k, n]) => (
          <Link key={k} href={`/admin/support?f=${k}`} className={`chip ${k === f ? "bg-violet text-white" : "bg-white border border-line text-ink"}`}>{FILTERS[k].label} <b className="num">{n}</b></Link>
        ))}
      </nav>
      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr] items-start">
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="text-left text-muted text-xs uppercase tracking-wide"><tr className="border-b border-line">{["Ticket", "Type", "From", "Status", "Due"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted">Nothing here.</td></tr>}
              {rows.map((r) => {
                const late = !["RESOLVED", "CLOSED"].includes(r.status) && r.dueAt < new Date();
                return (
                  <tr key={r.id} className={`border-b border-line last:border-0 ${r.id === openId ? "bg-violet-soft/50" : "hover:bg-canvas"}`}>
                    <td className="px-4 py-3"><Link href={`/admin/support?f=${f}&t=${r.id}`} className="font-mono text-violet underline">{r.reference}</Link></td>
                    <td className="px-4 py-3">{isTicketType(r.type) ? TICKET_TYPES[r.type].label : r.type}{r.level === 2 && <span className="chip bg-danger-soft text-danger ml-1">L2</span>}</td>
                    <td className="px-4 py-3">{r.name} · <span className="num">{maskMobile(r.mobile)}</span>{r.verified && <span className="chip bg-mint-soft text-mint-ink ml-1">OTP verified</span>}</td>
                    <td className="px-4 py-3">{TICKET_STATUSES[r.status as keyof typeof TICKET_STATUSES] ?? r.status}{r.assignee ? ` · ${r.assignee}` : ""}</td>
                    <td className={`px-4 py-3 num ${late ? "text-danger font-semibold" : ""}`}>{ist(r.dueAt)}{late ? " (late)" : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {open && isTicketType(open.type) && (
          <section className="card p-5 space-y-4 xl:sticky xl:top-32" aria-label={`Ticket ${open.reference}`}>
            <div>
              <p className="font-mono text-sm text-muted">{open.reference} · {TICKET_TYPES[open.type].owner}</p>
              <h2 className="text-lg font-extrabold">{TICKET_TYPES[open.type].label}</h2>
              <p className="text-sm">{open.name} · {maskMobile(open.mobile)}{open.email ? ` · ${open.email}` : ""}{open.applicationRef ? ` · ${open.applicationRef}` : ""}</p>
              {!open.verified && TICKET_TYPES[open.type].dataRight && <p className="text-sm text-danger mt-1">Identity not verified by OTP. Don&apos;t release or change any data.</p>}
            </div>
            <p className="rounded-xl bg-canvas border border-line p-3 text-sm whitespace-pre-line">{open.message}</p>
            <ol className="text-xs space-y-1 text-muted">
              {open.events.map((e) => {
                const d = e.detail ? (JSON.parse(e.detail) as Record<string, string>) : {};
                return <li key={e.id}><b className="text-ink">{e.type.replaceAll("_", " ").toLowerCase()}</b> · {e.actor.replace("staff:", "")} · {ist(e.createdAt)}{d.note ? `: ${d.note}` : d.outcome ? `: ${TICKET_OUTCOMES[d.outcome as keyof typeof TICKET_OUTCOMES] ?? d.outcome}` : ""}</li>;
              })}
            </ol>
            {manage && !["RESOLVED", "CLOSED"].includes(open.status) && (
              <div className="space-y-3">
                {open.assignee !== user.username && <ActionForm action={updateTicket} hidden={{ id: open.id }} buttons={[{ label: "Take this ticket", value: "take" }]} />}
                <ActionForm action={updateTicket} hidden={{ id: open.id }} buttons={[{ label: "Add note", value: "note", tone: "ghost" }, { label: "Escalate to Grievance Officer", value: "escalate", tone: "ghost" }]}>
                  <textarea name="note" rows={2} className="field-input" placeholder="Internal note, or the reason for escalating" />
                </ActionForm>
                <ActionForm action={updateTicket} hidden={{ id: open.id }} buttons={[{ label: "Resolve", value: "resolve", tone: "ok" }]}>
                  <select name="outcome" className="field-input" defaultValue=""><option value="" disabled>Outcome…</option>{Object.entries(TICKET_OUTCOMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                  <textarea name="note" rows={2} className="field-input" placeholder="What you told the person" />
                </ActionForm>
              </div>
            )}
          </section>
        )}
      </div>
      <p className="text-xs text-muted">Targets: questions 2 days; complaints acknowledged in 1 working day and resolved in 15; data requests 7 days; consent withdrawal at once (v4 §41, proposed, VERIFY). Applicants withdraw consent themselves from their application page; this queue records requests made another way.</p>
    </div>
  );
}

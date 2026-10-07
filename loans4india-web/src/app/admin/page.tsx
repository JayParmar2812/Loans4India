import Link from "next/link";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { formatINR, maskMobile } from "@/lib/format";
import { ACTIVE_ATTEMPT_STATES, STAGE_LABELS, STAGE_TONE, isStage } from "@/lib/stages";
import { loanTypeLabel } from "@/config/applicantFlow";
import { getLiveFlow } from "@/lib/applicantFlow.server";
import { pendingChecks } from "@/lib/applicant.server";
import { can, canSeeCase, holdsPortal, type StaffUser } from "@/lib/rbac";
import { assignableStaff, currentStaff } from "@/lib/staff.server";
import { fmtHours, slaFor, SLA_TONE, STALE_WITH_BANK_DAYS } from "@/lib/sla";

type SP = Promise<{ q?: string; queue?: string }>;

const INCLUDE = {
  attempts: { select: { id: true, bankId: true, bankName: true, state: true, sentToGateAt: true, approvedAt: true, failedTries: true, preparedBy: true } },
  flags: { where: { status: "OPEN" }, select: { id: true } },
  tasks: { where: { status: "OPEN" }, select: { id: true } },
  documents: { where: { status: "UPLOADED" }, select: { id: true } },
  bankStatuses: { select: { id: true, attemptId: true, status: true, needsCheck: true, checkedAt: true, supersedesId: true, recordedBy: true, createdAt: true } },
  events: { where: { type: { in: ["STAGE_CHANGED", "CLOSE_PROPOSED", "ESCALATED"] } }, orderBy: { createdAt: "desc" }, take: 5, select: { type: true, createdAt: true } },
} satisfies Prisma.LoanApplicationInclude;

type Row = Awaited<ReturnType<typeof load>>[number];
async function load(where: Prisma.LoanApplicationWhereInput) {
  return prisma.loanApplication.findMany({ where, orderBy: { createdAt: "desc" }, take: 500, include: INCLUDE });
}

/** The queues of the control tower (Platform Flow v4, sections 12 and 38). Each case can sit in more than one. */
function queues(user: StaffUser) {
  const active = (r: Row) => r.attempts.find((t) => (ACTIVE_ATTEMPT_STATES as readonly string[]).includes(t.state));
  const lastBankEvent = (r: Row) => r.bankStatuses.reduce<Date | null>((m, s) => (!m || s.createdAt > m ? s.createdAt : m), null);
  const staleSince = new Date(Date.now() - STALE_WITH_BANK_DAYS * 864e5);
  const q: { id: string; label: string; test: (r: Row) => boolean; who?: (u: StaffUser) => boolean }[] = [
    { id: "mine", label: "My cases", test: (r) => r.ownerId === user.username && r.stage !== "CLOSED" },
    { id: "new", label: "New, unassigned", test: (r) => r.stage === "VERIFICATION_REVIEW" && !r.ownerId },
    { id: "files", label: "Files to review", test: (r) => r.documents.length > 0 && !!r.submittedAt && !["CLOSED", "ACTION_NEEDED"].includes(r.stage) },
    { id: "waiting", label: "Waiting on applicant", test: (r) => r.stage === "ACTION_NEEDED" || r.stage === "CONSENT_PENDING" },
    { id: "select", label: "Pick a bank", test: (r) => r.stage === "VERIFICATION_REVIEW" && !!r.reviewPassedAt && !active(r) },
    { id: "prep", label: "Preparing", test: (r) => r.stage === "APPLICATION_PREPARATION" },
    { id: "gate", label: "At the gate", test: (r) => r.stage === "INTERNAL_REVIEW" },
    { id: "ready", label: "Ready for portal entry", test: (r) => r.stage === "READY_FOR_BANK" && (user.role !== "DSA_OPERATOR" || r.attempts.some((t) => t.state === "READY_TO_SUBMIT" && holdsPortal(user, t.bankId))) },
    { id: "bank", label: "With the bank", test: (r) => r.stage === "SUBMITTED_TO_BANK" },
    { id: "stale", label: `No bank update in ${STALE_WITH_BANK_DAYS} days`, test: (r) => r.stage === "SUBMITTED_TO_BANK" && (lastBankEvent(r) ?? r.createdAt) < staleSince },
    { id: "checks", label: "Bank updates to confirm", test: (r) => pendingChecks(r.bankStatuses).some((s) => s.recordedBy !== `staff:${user.username}`) },
    {
      id: "exceptions",
      label: "Exceptions",
      test: (r) =>
        r.stage !== "CLOSED" &&
        (r.onHold || r.flags.length > 0 || r.attempts.some((t) => t.state === "OUTCOME_RECEIVED") || r.attempts.some((t) => t.failedTries >= 3) || r.events.some((e) => e.type === "CLOSE_PROPOSED")),
    },
    { id: "applicant", label: "Applicant still filling in", test: (r) => ["ENQUIRY", "PROFILE_IN_PROGRESS", "DOCUMENTS_PENDING"].includes(r.stage) },
    { id: "open", label: "All open", test: (r) => r.stage !== "CLOSED" },
    { id: "closed", label: "Closed", test: (r) => r.stage === "CLOSED" },
  ];
  return q;
}

function defaultQueue(user: StaffUser) {
  if (user.role === "DSA_OPERATOR") return "ready";
  if (user.role === "BANK_MANAGER") return "checks";
  if (user.role === "OPS_EXECUTIVE" || user.role === "DOCUMENT_REVIEWER") return "mine";
  return "open";
}

export default async function ControlTower({ searchParams }: { searchParams: SP }) {
  const { q, queue } = await searchParams;
  const user = await currentStaff();
  if (!user) return null;
  if (user.role === "FINANCE" || user.role === "SUPPORT") {
    return (
      <div className="rounded-2xl border border-line bg-surface p-6 space-y-2">
        <p>Your role ({user.role.replaceAll("_", " ").toLowerCase()}) doesn&apos;t work on applications in MVP1.</p>
        {/* A file download, not a page: a plain link is right here. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        {can(user, "export.counts") && <a href="/admin/export" className="text-violet underline">Download counts (CSV)</a>}
      </div>
    );
  }
  const search = q?.trim();
  const where = search ? { OR: [{ reference: { contains: search.toUpperCase() } }, { mobile: { contains: search.replace(/\D/g, "") || search } }, { fullName: { contains: search } }] } : {};
  const rows = (await load(where)).filter((r) => canSeeCase(user, r, r.attempts.map((t) => t.bankId)));
  const qs = queues(user);
  const current = qs.find((x) => x.id === (queue ?? defaultQueue(user))) ?? qs[qs.length - 2];
  const list = search ? rows : rows.filter(current.test);
  const staff = await assignableStaff();
  const { flow: liveFlow } = await getLiveFlow();
  const withSla = (r: Row) => {
    const active = r.attempts.find((t) => (ACTIVE_ATTEMPT_STATES as readonly string[]).includes(t.state));
    const stageSince = r.events.find((e) => e.type === "STAGE_CHANGED")?.createdAt ?? r.createdAt;
    return slaFor({ stage: r.stage, onHold: r.onHold, ownerId: r.ownerId, submittedAt: r.submittedAt, stageSince, sentToGateAt: active?.sentToGateAt, approvedAt: active?.approvedAt });
  };
  const open = rows.filter((r) => r.stage !== "CLOSED");
  const byOwner = can(user, "application.assign")
    ? staff.map((s) => {
        const mine = open.filter((r) => r.ownerId === s.username);
        return { name: s.name, n: mine.length, red: mine.filter((r) => withSla(r)?.colour === "red").length };
      }).filter((o) => o.n > 0)
    : [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {qs.map((x) => {
          const n = rows.filter(x.test).length;
          const on = !search && x.id === current.id;
          return (
            <Link key={x.id} href={`/admin?queue=${x.id}`} className={`rounded-xl border px-3 py-2 ${on ? "bg-violet text-white border-violet" : "bg-surface border-line"} ${n === 0 && !on ? "opacity-60" : ""}`}>
              <span className="block text-xs">{x.label}</span>
              <span className="text-xl font-bold num">{n}</span>
            </Link>
          );
        })}
      </div>

      {byOwner.length > 0 && (
        <p className="text-sm text-muted">
          Open cases by owner: {byOwner.map((o) => <span key={o.name} className="mr-3">{o.name} <b className="num">{o.n}</b>{o.red ? <span className="text-danger"> ({o.red} late)</span> : null}</span>)}
        </p>
      )}

      <div className="flex flex-wrap gap-3 items-center justify-between">
        <form className="flex gap-2" action="/admin">
          <input name="q" defaultValue={q} placeholder="Reference, mobile or name" className="field-input !py-2 w-72" aria-label="Search" />
          <button className="btn-ghost !py-2">Search</button>
        </form>
        {/* A file download, not a page: a plain link is right here. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        {can(user, "export.counts") && <a href="/admin/export" className="text-sm text-violet underline">Download counts (CSV)</a>}
      </div>

      <h2 className="font-bold text-lg">{search ? `Search: ${search}` : current.label}</h2>
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="text-left text-muted text-xs uppercase tracking-wide">
            <tr className="border-b border-line">
              {["Reference", "Received", "Name", "Mobile", "Loan", "Amount", "State", "Owner", "Bank", "SLA", "Attention"].map((h) => <th key={h} className="px-3 py-3 font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr><td colSpan={11} className="px-3 py-10 text-center text-muted">Nothing here.</td></tr>
            )}
            {list.map((r) => {
              const sla = withSla(r);
              const active = r.attempts.find((t) => (ACTIVE_ATTEMPT_STATES as readonly string[]).includes(t.state));
              const attention = [
                r.onHold && "on hold",
                r.flags.length && `${r.flags.length} flag${r.flags.length > 1 ? "s" : ""}`,
                r.documents.length && r.submittedAt && `${r.documents.length} file${r.documents.length > 1 ? "s" : ""} to review`,
                pendingChecks(r.bankStatuses).length && "update to confirm",
                r.attempts.some((t) => t.state === "OUTCOME_RECEIVED") && "bank decision",
                r.events.some((e) => e.type === "CLOSE_PROPOSED") && r.stage !== "CLOSED" && "close proposed",
              ].filter(Boolean);
              return (
                <tr key={r.id} className="border-b border-line last:border-0 hover:bg-canvas">
                  <td className="px-3 py-2.5 font-mono"><Link href={`/admin/applications/${r.id}`} className="text-violet underline">{r.reference}</Link></td>
                  <td className="px-3 py-2.5 whitespace-nowrap num">{r.createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}</td>
                  <td className="px-3 py-2.5">{r.fullName ?? "—"}</td>
                  <td className="px-3 py-2.5 num">{maskMobile(r.mobile)}</td>
                  <td className="px-3 py-2.5">{loanTypeLabel(liveFlow, r.product)}</td>
                  <td className="px-3 py-2.5 num">{formatINR(r.loanAmount)}</td>
                  <td className="px-3 py-2.5"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${isStage(r.stage) ? STAGE_TONE[r.stage] : ""}`}>{isStage(r.stage) ? STAGE_LABELS[r.stage] : r.stage}</span></td>
                  <td className="px-3 py-2.5">{r.ownerId ? staff.find((s) => s.username === r.ownerId)?.name ?? r.ownerId : <span className="text-muted">—</span>}</td>
                  <td className="px-3 py-2.5 text-xs">{active?.bankName ?? "—"}</td>
                  <td className="px-3 py-2.5">{sla ? <span className={`rounded-full px-2 py-0.5 text-xs font-semibold num ${SLA_TONE[sla.colour]}`}>{fmtHours(sla.used)}/{sla.limit}h</span> : <span className="text-muted text-xs">—</span>}</td>
                  <td className="px-3 py-2.5 text-xs text-amber-900">{attention.join(" · ")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">SLA clocks count working hours (Mon–Sat, 09:30–18:30 IST) and pause while the case waits on the applicant or is on hold.</p>
    </div>
  );
}

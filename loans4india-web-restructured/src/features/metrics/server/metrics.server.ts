import "server-only";
import { prisma } from "@/shared/db/db";
import { workingHoursBetween } from "@/features/case-management/domain/sla";

/**
 * Metrics with one definition each (Platform Flow v4, section 54), computed from the event and record tables
 * (no separate reporting copy). Ratios with no denominator are null ("not enough data"), never 0%.
 */
export type Metric = { id: string; label: string; value: number | null; unit: "%" | "h" | "count"; definition: string; n?: number };

const ratio = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 1000) / 10 : null);
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return Math.round((s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) * 10) / 10;
};

export async function funnelAndQuality(from: Date, to: Date): Promise<Metric[]> {
  const created = { createdAt: { gte: from, lt: to } };
  const [apps, submittedApps, ready, gateEvents, reviewedDocs, rejectedDocs] = await Promise.all([
    prisma.loanApplication.count({ where: created }),
    prisma.loanApplication.findMany({ where: { ...created, submittedAt: { not: null } }, select: { id: true, submittedAt: true } }),
    prisma.applicationEvent.findMany({ where: { createdAt: { gte: from, lt: to }, type: "STAGE_CHANGED", detail: { contains: '"to":"READY_FOR_BANK"' } }, select: { applicationId: true, createdAt: true } }),
    prisma.applicationEvent.groupBy({ by: ["type"], where: { createdAt: { gte: from, lt: to }, type: { in: ["GATE_APPROVED", "GATE_SENT_BACK"] } }, _count: { _all: true } }),
    prisma.applicationDocument.count({ where: { reviewedAt: { gte: from, lt: to } } }),
    prisma.applicationDocument.count({ where: { reviewedAt: { gte: from, lt: to }, status: "REJECTED" } }),
  ]);
  const consented = await prisma.consentRecord.findMany({ where: { createdAt: { gte: from, lt: to }, purpose: "PROCESS_APPLICATION", granted: true }, distinct: ["applicationId"], select: { applicationId: true } });

  // Time to first staff action and to Ready for Bank, in working hours, for applications submitted in the period.
  const ids = submittedApps.map((a) => a.id);
  const firstActions = ids.length
    ? await prisma.applicationEvent.findMany({ where: { applicationId: { in: ids }, actor: { startsWith: "staff:" } }, orderBy: { createdAt: "asc" }, select: { applicationId: true, createdAt: true } })
    : [];
  const firstByApp = new Map<string, Date>();
  for (const e of firstActions) if (!firstByApp.has(e.applicationId)) firstByApp.set(e.applicationId, e.createdAt);
  const toFirst = submittedApps.filter((a) => firstByApp.has(a.id)).map((a) => workingHoursBetween(a.submittedAt!, firstByApp.get(a.id)!));
  const readyByApp = new Map(ready.map((r) => [r.applicationId, r.createdAt]));
  const toReady = submittedApps.filter((a) => readyByApp.has(a.id)).map((a) => workingHoursBetween(a.submittedAt!, readyByApp.get(a.id)!));
  const sentBack = gateEvents.find((g) => g.type === "GATE_SENT_BACK")?._count._all ?? 0;
  const approved = gateEvents.find((g) => g.type === "GATE_APPROVED")?._count._all ?? 0;

  return [
    { id: "started", label: "Applications started", value: apps, unit: "count", definition: "Applications created (OTP-verified) in the period." },
    { id: "completion", label: "Completion rate", value: ratio(submittedApps.length, consented.length), unit: "%", n: consented.length, definition: "Submitted by the applicant ÷ consented (v4 §54)." },
    { id: "rfb", label: "Ready-for-Bank rate", value: ratio(readyByApp.size, submittedApps.length), unit: "%", n: submittedApps.length, definition: "Reached READY_FOR_BANK ÷ submitted by the applicant." },
    { id: "first", label: "Time to first review (median)", value: median(toFirst), unit: "h", n: toFirst.length, definition: "Applicant submit → first staff action, in working hours." },
    { id: "ready", label: "Time to Ready for Bank (median)", value: median(toReady), unit: "h", n: toReady.length, definition: "Applicant submit → READY_FOR_BANK, in working hours." },
    { id: "sendback", label: "Gate send-back rate", value: ratio(sentBack, sentBack + approved), unit: "%", n: sentBack + approved, definition: "Sent back ÷ gate decisions." },
    { id: "docreject", label: "Document rejection rate", value: ratio(rejectedDocs, reviewedDocs), unit: "%", n: reviewedDocs, definition: "Rejected files ÷ reviewed files." },
  ];
}

export async function complianceMetrics(now = new Date()): Promise<Metric[]> {
  const [rightsDone, rightsOnTime, overdueOpen, complaints, apps] = await Promise.all([
    prisma.supportTicket.count({ where: { type: { notIn: ["QUERY", "COMPLAINT"] }, status: { in: ["RESOLVED", "CLOSED"] } } }),
    prisma.supportTicketEvent.findMany({ where: { type: "STATUS_CHANGED", detail: { contains: '"to":"RESOLVED"' }, ticket: { type: { notIn: ["QUERY", "COMPLAINT"] } } }, select: { createdAt: true, ticket: { select: { dueAt: true } } } }),
    prisma.supportTicket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS", "ESCALATED"] }, dueAt: { lt: now } } }),
    prisma.supportTicket.count({ where: { type: "COMPLAINT" } }),
    prisma.loanApplication.count(),
  ]);
  return [
    { id: "rights", label: "Data-rights requests on time", value: ratio(rightsOnTime.filter((e) => e.createdAt <= e.ticket.dueAt).length, rightsDone), unit: "%", n: rightsDone, definition: "Closed within target ÷ total closed." },
    { id: "overdue", label: "Overdue tickets", value: overdueOpen, unit: "count", definition: "Open tickets past their due time." },
    { id: "complaints", label: "Complaints per 1,000 applications", value: apps ? Math.round((complaints / apps) * 1000 * 10) / 10 : null, unit: "count", n: apps, definition: "Complaints ÷ applications × 1,000." },
  ];
}

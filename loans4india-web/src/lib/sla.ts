/**
 * SLA clocks in working hours (Platform Flow v4, sections 11 and 38). Proposed defaults; the Ops Manager owns them.
 * Working time: Monday to Saturday, 09:30 to 18:30 IST. No holiday calendar yet.
 * Pure: safe on client and server.
 */
export const SLA_HOURS = {
  ASSIGNMENT: 2, // unassigned after submit
  FIRST_REVIEW: 9, // 1 working day from submit
  GATE: 9, // gate decision, 1 working day
  PORTAL_ENTRY: 18, // 2 working days after Ready for Bank
  READY_FOR_BANK: 27, // 3 working days from submit when nothing was asked of the applicant
} as const;
export const STALE_WITH_BANK_DAYS = 7;

const IST_OFFSET_MIN = 330;
const DAY_START = 9.5;
const DAY_END = 18.5;

/** Working hours between two instants. */
export function workingHoursBetween(from: Date, to: Date): number {
  if (to <= from) return 0;
  let total = 0;
  // Walk day by day in IST.
  const toIst = (d: Date) => new Date(d.getTime() + IST_OFFSET_MIN * 60000);
  const start = toIst(from);
  const end = toIst(to);
  const day = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  while (day <= end) {
    const dow = day.getUTCDay();
    if (dow !== 0) {
      const open = day.getTime() + DAY_START * 3600e3;
      const close = day.getTime() + DAY_END * 3600e3;
      const a = Math.max(open, start.getTime());
      const b = Math.min(close, end.getTime());
      if (b > a) total += (b - a) / 3600e3;
    }
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return total;
}

export type SlaColour = "green" | "amber" | "red";
export function slaColour(usedHours: number, limitHours: number): SlaColour {
  if (usedHours >= limitHours) return "red";
  if (usedHours >= limitHours * 0.75) return "amber";
  return "green";
}
export const SLA_TONE: Record<SlaColour, string> = {
  green: "bg-emerald-100 text-emerald-900",
  amber: "bg-amber-100 text-amber-900",
  red: "bg-red-100 text-red-900",
};

/** Which clock applies in this state, and since when. Paused while waiting on the applicant or on hold. */
export function slaFor(a: {
  stage: string;
  onHold: boolean;
  ownerId: string | null;
  submittedAt: Date | null;
  stageSince: Date | null;
  sentToGateAt?: Date | null;
  approvedAt?: Date | null;
}): { label: string; used: number; limit: number; colour: SlaColour } | null {
  if (a.onHold) return null;
  const now = new Date();
  const mk = (label: string, since: Date | null | undefined, limit: number) => {
    if (!since) return null;
    const used = workingHoursBetween(since, now);
    return { label, used, limit, colour: slaColour(used, limit) };
  };
  switch (a.stage) {
    case "VERIFICATION_REVIEW":
      return a.ownerId ? mk("First review", a.stageSince ?? a.submittedAt, SLA_HOURS.FIRST_REVIEW) : mk("Assignment", a.stageSince ?? a.submittedAt, SLA_HOURS.ASSIGNMENT);
    case "APPLICATION_PREPARATION":
      return mk("Ready for bank", a.submittedAt, SLA_HOURS.READY_FOR_BANK);
    case "INTERNAL_REVIEW":
      return mk("Gate decision", a.sentToGateAt ?? a.stageSince, SLA_HOURS.GATE);
    case "READY_FOR_BANK":
      return mk("Portal entry", a.approvedAt ?? a.stageSince, SLA_HOURS.PORTAL_ENTRY);
    default:
      return null;
  }
}

export const fmtHours = (h: number) => (h < 1 ? `${Math.round(h * 60)}m` : `${Math.floor(h)}h${Math.round((h % 1) * 60) ? ` ${Math.round((h % 1) * 60)}m` : ""}`);

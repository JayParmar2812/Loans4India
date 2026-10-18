import { notFound } from "next/navigation";
import { prisma } from "@/shared/db/db";
import { can } from "@/features/staff/domain/rbac";
import { currentStaff } from "@/features/staff/server/staff.server";
import { complianceMetrics, funnelAndQuality, type Metric } from "@/features/metrics/server/metrics.server";
import { STAGE_LABELS, isStage } from "@/features/applications/domain/stages";
import { dataMode } from "@/shared/config/brand";

export const metadata = { title: "Insights" };

const PERIODS = { "7": "Last 7 days", "30": "Last 30 days", "90": "Last 90 days", "365": "Last year" } as const;

function Tile({ m }: { m: Metric }) {
  return (
    <div className="card p-4" title={m.definition}>
      <p className="text-xs text-muted">{m.label}</p>
      <p className="font-display font-extrabold text-2xl num">{m.value === null ? <span className="text-muted text-base font-semibold">Not enough data</span> : `${m.value}${m.unit === "%" ? "%" : m.unit === "h" ? " h" : ""}`}</p>
      <p className="text-[11px] text-muted mt-1">{m.definition}{m.n !== undefined ? ` (n = ${m.n})` : ""}</p>
    </div>
  );
}

/**
 * Operational metrics (Platform Flow v4, section 54) from live records. Bank-side metrics (sanction, disbursal, commission) need
 * bank evidence that doesn't exist in MVP1, so they are listed as unavailable instead of being shown as zero.
 */
export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const user = await currentStaff();
  if (!user || !can(user, "metrics.view")) notFound();
  const d = (await searchParams).d;
  const daysKey = (d && d in PERIODS ? d : "30") as keyof typeof PERIODS;
  const to = new Date();
  const from = new Date(to.getTime() - Number(daysKey) * 864e5);
  const [funnel, compliance, byStage, bySource] = await Promise.all([
    funnelAndQuality(from, to),
    complianceMetrics(to),
    prisma.loanApplication.groupBy({ by: ["stage"], _count: { _all: true } }),
    prisma.loanApplication.groupBy({ by: ["source"], where: { createdAt: { gte: from, lt: to } }, _count: { _all: true } }),
  ]);
  const max = Math.max(1, ...byStage.map((s) => s._count._all));
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold">Insights</h1>
          <p className="text-sm text-muted">{dataMode() === "synthetic" ? "Synthetic data: these numbers describe test applications, not real customers." : "Live data."} Hover a tile for its definition.</p>
        </div>
        <nav className="flex gap-1" aria-label="Period">
          {Object.entries(PERIODS).map(([k, v]) => <a key={k} href={`?d=${k}`} className={`chip ${k === daysKey ? "bg-violet text-white" : "bg-white border border-line"}`}>{v}</a>)}
        </nav>
      </div>
      <section>
        <h2 className="font-bold mb-3">Funnel, speed and quality · {PERIODS[daysKey].toLowerCase()}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{funnel.map((m) => <Tile key={m.id} m={m} />)}</div>
      </section>
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-bold mb-3">Applications by state (all time)</h2>
          <ul className="space-y-2 text-sm">
            {byStage.sort((a, b) => b._count._all - a._count._all).map((s) => (
              <li key={s.stage} className="grid grid-cols-[160px_1fr_40px] items-center gap-3">
                <span>{isStage(s.stage) ? STAGE_LABELS[s.stage] : s.stage}</span>
                <span className="h-2.5 rounded-full bg-violet" style={{ width: `${(s._count._all / max) * 100}%` }} aria-hidden />
                <span className="num text-right">{s._count._all}</span>
              </li>
            ))}
            {byStage.length === 0 && <li className="text-muted">No applications yet.</li>}
          </ul>
        </div>
        <div className="card p-5">
          <h2 className="font-bold mb-3">Where applicants came from · {PERIODS[daysKey].toLowerCase()}</h2>
          <ul className="space-y-1.5 text-sm">
            {bySource.sort((a, b) => b._count._all - a._count._all).map((s) => <li key={s.source ?? "direct"} className="flex justify-between"><span>{s.source ?? "direct"}</span><span className="num">{s._count._all}</span></li>)}
            {bySource.length === 0 && <li className="text-muted">No applications in this period.</li>}
          </ul>
        </div>
      </section>
      <section>
        <h2 className="font-bold mb-3">Compliance</h2>
        <div className="grid gap-3 sm:grid-cols-3">{compliance.map((m) => <Tile key={m.id} m={m} />)}</div>
      </section>
      <section className="rounded-2xl border border-dashed border-line p-5 text-sm text-muted">
        <b className="text-ink">Not available yet:</b> sanction rate, disbursal rate, bank turnaround, bank query rate, commission realisation and days to payout. They need
        bank-confirmed evidence (MIS files, payouts) from a signed bank agreement (Phase 2), so they aren&apos;t estimated or shown as zero.
      </section>
    </div>
  );
}

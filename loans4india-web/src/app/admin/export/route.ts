import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { actorOf, currentStaff } from "@/lib/staff.server";

export const dynamic = "force-dynamic";

/**
 * Counts only (Platform Flow v4, section 13: no bulk export of personal data). One row per measure and value.
 */
export async function GET() {
  const user = await currentStaff();
  if (!user || !can(user, "export.counts")) return new Response("Forbidden", { status: 403 });
  await prisma.adminEvent.create({ data: { type: "COUNTS_EXPORTED", actor: actorOf(user) } });
  const [byStage, byClose, byProduct, bySource, byAttempt, byBankStatus] = await Promise.all([
    prisma.loanApplication.groupBy({ by: ["stage"], _count: { _all: true } }),
    prisma.loanApplication.groupBy({ by: ["closedReason"], where: { stage: "CLOSED" }, _count: { _all: true } }),
    prisma.loanApplication.groupBy({ by: ["product"], _count: { _all: true } }),
    prisma.loanApplication.groupBy({ by: ["source"], _count: { _all: true } }),
    prisma.bankAttempt.groupBy({ by: ["bankName", "state"], _count: { _all: true } }),
    prisma.bankStatusEvent.groupBy({ by: ["status"], where: { OR: [{ needsCheck: false }, { checkedAt: { not: null } }], supersedesId: null }, _count: { _all: true } }),
  ]);
  const rows: [string, string, number][] = [
    ...byStage.map((r) => ["application state", r.stage, r._count._all] as [string, string, number]),
    ...byClose.map((r) => ["close reason", r.closedReason ?? "none", r._count._all] as [string, string, number]),
    ...byProduct.map((r) => ["product", r.product, r._count._all] as [string, string, number]),
    ...bySource.map((r) => ["source", r.source ?? "direct", r._count._all] as [string, string, number]),
    ...byAttempt.map((r) => ["bank attempt", `${r.bankName}: ${r.state}`, r._count._all] as [string, string, number]),
    ...byBankStatus.map((r) => ["confirmed bank status rows", r.status, r._count._all] as [string, string, number]),
  ];
  const esc = (s: string) => {
    let v = s;
    if (/^[=+\-@]/.test(v)) v = `'${v}`; // block spreadsheet formula injection
    return /[",\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v;
  };
  const csv = ["measure,value,count", ...rows.map(([m, v, n]) => `${esc(m)},${esc(v)},${n}`)].join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="counts-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

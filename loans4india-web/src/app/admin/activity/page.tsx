import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { currentStaff } from "@/lib/staff.server";
import { staffDirectory } from "@/lib/staffAuth";

export const metadata = { title: "Activity" };

type SP = Promise<{ who?: string; kind?: string }>;
const LIMIT = 300;

const ist = (d: Date) => d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
const label = (s: string) => s.replaceAll("_", " ").toLowerCase();
function brief(detail: string | null) {
  if (!detail) return "";
  try {
    const v = JSON.parse(detail) as Record<string, unknown>;
    const s = Object.entries(v).map(([k, x]) => `${k}: ${typeof x === "object" ? JSON.stringify(x) : String(x)}`).join(" · ");
    return s.length > 180 ? `${s.slice(0, 180)}…` : s;
  } catch {
    return detail.slice(0, 180);
  }
}

/** Everything staff, applicants and the system did, newest first: case events and back-office (staff) events. */
export default async function ActivityPage({ searchParams }: { searchParams: SP }) {
  const user = await currentStaff();
  if (!user || !can(user, "audit.view")) notFound();
  const { who, kind } = await searchParams;
  const actor = who ? (who === "applicant" || who === "system" ? who : `staff:${who}`) : undefined;
  const [caseEvents, adminEvents, people] = await Promise.all([
    kind === "staff" ? [] : prisma.applicationEvent.findMany({ where: actor ? { actor } : {}, orderBy: { createdAt: "desc" }, take: LIMIT, include: { application: { select: { id: true, reference: true } } } }),
    kind === "cases" ? [] : prisma.adminEvent.findMany({ where: actor ? { actor } : {}, orderBy: { createdAt: "desc" }, take: LIMIT }),
    staffDirectory({ includeDisabled: true }),
  ]);
  const nameOf = (a: string) => (a.startsWith("staff:") ? people.find((p) => `staff:${p.username}` === a)?.name ?? a.slice(6) : a);
  const rows = [
    ...caseEvents.map((e) => ({ id: e.id, at: e.createdAt, actor: e.actor, type: e.type, detail: e.detail, ref: e.application })),
    ...adminEvents.map((e) => ({ id: e.id, at: e.createdAt, actor: e.actor, type: e.type, detail: e.target ? JSON.stringify({ [e.type.startsWith("STAFF_") ? "staff" : "what"]: e.target, ...JSON.parse(e.detail ?? "{}") }) : e.detail, ref: null })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, LIMIT);

  return (
    <div className="space-y-4">
      <form className="flex flex-wrap gap-2 items-end">
        <label><span className="field-label">Who</span>
          <select name="who" defaultValue={who ?? ""} className="field-input">
            <option value="">Everyone</option>
            {people.map((p) => <option key={p.username} value={p.username}>{p.name}</option>)}
            <option value="applicant">Applicants</option>
            <option value="system">System</option>
          </select>
        </label>
        <label><span className="field-label">What</span>
          <select name="kind" defaultValue={kind ?? ""} className="field-input">
            <option value="">Cases and admin changes</option>
            <option value="cases">Cases only</option>
            <option value="staff">Admin changes only (staff, website)</option>
          </select>
        </label>
        <button className="btn-primary !py-2">Show</button>
      </form>
      <p className="text-xs text-muted">Newest {LIMIT} entries. Nothing here can be edited or deleted.</p>
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full text-sm">
          <thead className="text-left text-muted"><tr><th className="px-3 py-2">When (IST)</th><th className="px-3 py-2">Who</th><th className="px-3 py-2">What</th><th className="px-3 py-2">Case</th><th className="px-3 py-2">Detail</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-line align-top">
                <td className="px-3 py-2 whitespace-nowrap">{ist(r.at)}</td>
                <td className="px-3 py-2">{nameOf(r.actor)}</td>
                <td className="px-3 py-2">{label(r.type)}</td>
                <td className="px-3 py-2 font-mono">{r.ref ? <Link className="text-violet underline" href={`/admin/applications/${r.ref.id}`}>{r.ref.reference}</Link> : "—"}</td>
                <td className="px-3 py-2 text-xs text-muted break-words">{brief(r.detail)}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5} className="px-3 py-6 text-center text-muted">Nothing yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

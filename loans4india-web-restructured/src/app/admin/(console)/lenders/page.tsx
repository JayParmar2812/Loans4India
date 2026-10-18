import { notFound } from "next/navigation";
import { prisma } from "@/shared/db/db";
import { can } from "@/features/staff/domain/rbac";
import { currentStaff } from "@/features/staff/server/staff.server";
import { BANK_LIST_VERSION, BANKS, agreementActive } from "@/features/bank-submission/config/banks";
import { brand } from "@/shared/config/brand";

export const metadata = { title: "Lenders" };

const STATUS_TONE = { TEST: "bg-warn-soft text-warn", LIVE: "bg-mint-soft text-mint-ink", SUSPENDED: "bg-danger-soft text-danger", INACTIVE: "bg-canvas text-muted border border-line" } as const;

// Platform Flow v4, section 47: a bank stays inactive until every item has evidence.
const GO_LIVE = [
  "Signed DSA agreement + effective date",
  "Bank due diligence passed",
  "Staff registered with the bank, code of conduct signed",
  "Portal logins issued to named operators",
  "MIS and payout formats received; column maps built",
  "Bank master: products, documents, service areas, portal field map",
  "Commission schedule entered and approved by Finance",
  "Partner-bank list and consent text approved by Compliance",
  "Website disclosure updated",
];

/**
 * Read-only view of the bank master (src/features/bank-submission/config/banks.ts). Changes to banks are code changes reviewed
 * like any other until the Bank/Partner Manager editor (Phase 2) exists. A record here is never a live partnership.
 */
export default async function LendersPage() {
  const user = await currentStaff();
  if (!user || !can(user, "lender.view")) notFound();
  const attempts = await prisma.bankAttempt.groupBy({ by: ["bankId", "state"], _count: { _all: true } });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Lenders</h1>
        <p className="text-sm text-muted max-w-3xl">
          Bank list version <span className="font-mono">{BANK_LIST_VERSION}</span>. No DSA agreement is signed yet, so every bank is a TEST bank: usable only with synthetic data
          outside production, never shown on the public site (public partner list: {brand.partnersLive ? "on" : "off"}). Changing this list creates a new bank-list version;
          older consents don&apos;t cover a new bank.
        </p>
      </div>
      {BANKS.map((b) => {
        const counts = attempts.filter((a) => a.bankId === b.id);
        return (
          <section key={b.id} className="card p-5 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-extrabold">{b.name}</h2>
              <span className={`chip ${STATUS_TONE[b.status]}`}>{b.status}</span>
              <span className="chip bg-canvas border border-line">{b.type}</span>
              <span className={`chip ${agreementActive(b) ? "bg-mint-soft text-mint-ink" : "bg-danger-soft text-danger"}`}>{agreementActive(b) ? "Usable here" : "Blocked here"}</span>
            </div>
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div><dt className="text-muted text-xs">Products</dt><dd>{b.products.join(", ").replaceAll("_", " ").toLowerCase()}</dd></div>
              <div><dt className="text-muted text-xs">DSA code</dt><dd className="font-mono">{b.dsaCode ?? "none"}</dd></div>
              <div><dt className="text-muted text-xs">Agreement valid to</dt><dd>{b.agreementValidTo ?? "n/a"}</dd></div>
              <div><dt className="text-muted text-xs">Template</dt><dd className="font-mono text-xs">{b.template.version} · {b.template.fields.length} fields</dd></div>
              <div className="sm:col-span-2"><dt className="text-muted text-xs">Sourcing rules (filters only, never a credit decision)</dt>
                <dd>
                  {[b.sourcing.minAge && `age ${b.sourcing.minAge}–${b.sourcing.maxAge ?? "any"}`, b.sourcing.minMonthlyIncome && `income ≥ ₹${b.sourcing.minMonthlyIncome.toLocaleString("en-IN")}/month`,
                    b.sourcing.employmentTypes && `employment: ${b.sourcing.employmentTypes.join(", ").toLowerCase()}`, b.sourcing.pincodePrefixes && `PIN prefixes: ${b.sourcing.pincodePrefixes.join(", ")}`].filter(Boolean).join(" · ") || "none published"}
                </dd>
              </div>
              <div className="sm:col-span-2"><dt className="text-muted text-xs">Attempts</dt><dd>{counts.length ? counts.map((c) => `${c.state.toLowerCase().replaceAll("_", " ")}: ${c._count._all}`).join(" · ") : "none"}</dd></div>
            </dl>
            {b.notes && <p className="text-sm text-muted">Staff note: {b.notes}</p>}
            <details className="text-sm">
              <summary className="cursor-pointer font-semibold">Go-live checklist (v4 §47)</summary>
              <ul className="mt-2 grid sm:grid-cols-2 gap-1.5">
                {GO_LIVE.map((g) => <li key={g} className="flex gap-2"><span className={b.status === "LIVE" ? "text-success" : "text-danger"} aria-hidden>{b.status === "LIVE" ? "✓" : "✕"}</span>{g}{b.status !== "LIVE" && <span className="text-muted">: no evidence</span>}</li>)}
              </ul>
            </details>
          </section>
        );
      })}
    </div>
  );
}

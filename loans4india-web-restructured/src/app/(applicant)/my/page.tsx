import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/shared/db/db";
import { applicantMobile } from "@/features/applicant-auth/server/applicantSession.server";
import { APPLICANT_INCLUDE } from "@/features/applications/server/applicant.server";
import { getLiveFlow } from "@/features/applicant-flow/server/applicantFlow.server";
import { portalState } from "@/features/applicant-portal/server/portal.server";
import { SignOutButton } from "@/features/applicant-auth/components/OtpSignIn";
import { formatINR } from "@/shared/utils/format";
import { consentState } from "@/features/consent/domain/consentState";
import { TRACKER_STEPS } from "@/features/applicant-portal/domain/tracker";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your applications", robots: { index: false, follow: false } };

/** Applicant dashboard (Platform Flow v4, sections 4 and 10): only applications on the verified mobile. */
export default async function MyPage() {
  const mobile = await applicantMobile();
  if (!mobile) redirect("/my/sign-in");
  const live = await getLiveFlow();
  const apps = await prisma.loanApplication.findMany({ where: { mobile, purgedAt: null }, include: APPLICANT_INCLUDE, orderBy: { createdAt: "desc" }, take: 20 });
  const views = apps.map((a) => ({ app: a, state: portalState({ ...a, live }), consent: consentState(a.consents) }));
  const open = views.filter((v) => !v.state.closed);
  const closed = views.filter((v) => v.state.closed);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:py-14 space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">Signed in as +91 ******{mobile.slice(-4)}</p>
          <h1 className="text-3xl sm:text-4xl font-extrabold">Your applications</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/apply" className="btn-primary">New application</Link>
          <SignOutButton />
        </div>
      </div>

      {views.length === 0 && (
        <div className="card p-8 text-center space-y-3">
          <h2 className="text-xl font-bold">No applications on this number yet</h2>
          <p className="text-muted">Start one in a couple of minutes. It&apos;s free.</p>
          <Link href="/apply" className="btn-primary">Start your application</Link>
        </div>
      )}

      {open.length > 0 && (
        <section className="space-y-3" aria-labelledby="open-h">
          <h2 id="open-h" className="font-bold text-lg">In progress</h2>
          {open.map(({ app, state }) => (
            <AppCard key={app.id} reference={app.reference} product={state.productLabel} amount={app.loanAmount} created={app.createdAt} tracker={state.tracker} tasks={state.tasks.length} />
          ))}
        </section>
      )}
      {closed.length > 0 && (
        <section className="space-y-3" aria-labelledby="closed-h">
          <h2 id="closed-h" className="font-bold text-lg text-muted">Closed</h2>
          {closed.map(({ app, state }) => (
            <AppCard key={app.id} reference={app.reference} product={state.productLabel} amount={app.loanAmount} created={app.createdAt} tracker={state.tracker} tasks={0} muted />
          ))}
        </section>
      )}

      <section className="rounded-2xl border border-line bg-white p-5 sm:p-6 space-y-3" aria-labelledby="data-h">
        <h2 id="data-h" className="font-bold text-lg">Your data and privacy</h2>
        <ul className="text-sm text-muted space-y-2">
          <li>• Open an application to withdraw it or to withdraw your consent. Withdrawing consent stops all processing straight away.</li>
          <li>• To see a copy of your data, correct it or ask us to erase it, <Link className="text-violet underline" href="/contact?type=DATA_ACCESS">send a data request</Link>. We confirm it&apos;s you with a code on this mobile.</li>
          <li>• Marketing messages: {views.some((v) => v.consent.marketing) ? "you agreed on at least one application; opt out on the application page." : "you haven't agreed to any."}</li>
        </ul>
      </section>
    </div>
  );
}

function AppCard(p: { reference: string; product: string; amount: number; created: Date; tracker: ReturnType<typeof portalState>["tracker"]; tasks: number; muted?: boolean }) {
  const pct = Math.round((Math.max(0, p.tracker.step) / TRACKER_STEPS.length) * 100);
  return (
    <Link href={`/my/applications/${p.reference}`} className={`card block p-5 hover:border-violet transition-colors ${p.muted ? "opacity-75" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted font-mono">{p.reference} · started {p.created.toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" })}</p>
          <p className="font-bold text-lg">{p.product} · <span className="num">{formatINR(p.amount)}</span></p>
        </div>
        {p.tasks > 0 && <span className="chip bg-warn-soft text-warn">{p.tasks} action{p.tasks > 1 ? "s" : ""} needed</span>}
      </div>
      <p className="mt-2 font-semibold text-violet-deep">{p.tracker.title}</p>
      <div className="mt-3 h-2 rounded-full bg-canvas border border-line overflow-hidden" aria-hidden>
        <div className={`h-full ${p.tracker.tone === "closed" ? "bg-line" : "bg-mint"}`} style={{ width: `${pct}%` }} />
      </div>
    </Link>
  );
}

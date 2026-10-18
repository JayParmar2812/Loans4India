import Link from "next/link";
import { QuickCheck } from "./QuickCheck";
import { Faq } from "./Faq";
import { CalculatorLinks } from "./CalculatorLinks";
import type { ProductSiteContent } from "@/features/site-control/config/siteContent";
import { Breadcrumbs } from "@/shared/ui/Breadcrumbs";
import { Icon } from "@/shared/ui/Icon";

export type ProductContent = ProductSiteContent & { product: "PERSONAL_LOAN" | "BUSINESS_LOAN"; path: string };

/** One page per loan type (Platform Flow v4, section 2): who it suits, typical documents, the process. Never a promised rate. */
export function ProductPage({ c }: { c: ProductContent }) {
  const applyHref = c.product === "BUSINESS_LOAN" ? "/apply?product=BUSINESS_LOAN" : "/apply";
  return (
    <>
      <section className="hero-wash border-b border-line">
        <div className="mx-auto max-w-6xl px-4 pt-6 pb-12 sm:pb-14">
          <Breadcrumbs items={[{ label: c.eyebrow || c.title, href: c.path }]} />
          <div className="mt-6 grid gap-10 lg:grid-cols-[1.25fr_1fr] items-center">
            <div>
              {c.eyebrow && <p className="eyebrow">{c.eyebrow}</p>}
              <h1 className="mt-2 text-4xl sm:text-5xl font-extrabold">{c.title}</h1>
              <p className="mt-4 text-lg text-muted max-w-xl">{c.intro}</p>
              {c.highlights.length > 0 && (
                <dl className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {c.highlights.map((h, i) => (
                    <div key={i} className="rounded-2xl bg-white border border-line p-3">
                      <dt className="text-xs text-muted">{h.k}</dt>
                      <dd className="font-display font-bold text-lg num">{h.v}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <p className="mt-3 text-xs text-muted">Typical ranges you can apply for. Each bank sets its own limits, rate and terms, and decides.</p>
            </div>
            <QuickCheck product={c.product} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 grid gap-6 md:grid-cols-2">
        {c.whoCanApply.length > 0 && (
          <div className="card p-6">
            <h2 className="text-2xl font-extrabold">Who can apply</h2>
            <ul className="mt-4 space-y-2.5">{c.whoCanApply.map((w, i) => <li key={i} className="flex gap-2"><Icon name="check" className="size-5 text-mint-deep shrink-0 mt-0.5" />{w}</li>)}</ul>
            <p className="mt-4 text-xs text-muted">Typical criteria. Each bank sets its own rules.</p>
          </div>
        )}
        {c.documents.length > 0 && (
          <div className="card p-6">
            <h2 className="text-2xl font-extrabold">Documents to keep ready</h2>
            <ul className="mt-4 space-y-2.5">{c.documents.map((d, i) => <li key={i} className="flex gap-2"><Icon name="file" className="size-5 text-violet shrink-0 mt-0.5" />{d}</li>)}</ul>
            <p className="mt-4 text-xs text-muted">You upload these in your application after the form. Your checklist shows exactly what your loan type needs.</p>
          </div>
        )}
      </section>

      <section className="mx-auto max-w-6xl px-4">
        <div className="rounded-3xl bg-violet-soft p-6 sm:p-10 grid gap-6 md:grid-cols-3">
          {[
            { t: "You apply once", d: "Loan, mobile, consent, then one form and your documents." },
            { t: "We check and submit", d: "A named person reviews your file and submits it to one suitable partner bank." },
            { t: "The bank decides", d: "It runs its own checks and shows you its terms in a Key Fact Statement." },
          ].map((s, i) => (
            <div key={s.t}>
              <span className="text-sm font-bold text-violet num">Step {i + 1}</span>
              <h3 className="text-lg font-extrabold">{s.t}</h3>
              <p className="text-muted text-[0.95rem]">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-14">
        {c.faq.length > 0 && (
          <>
            <h2 className="text-3xl font-extrabold mb-6">Frequently asked</h2>
            <Faq items={c.faq} />
          </>
        )}
        <div className="mt-10 text-center">
          <Link href={applyHref} className="btn-primary">Start your application. It&apos;s free</Link>
        </div>
      </section>
      <div className="mx-auto max-w-6xl px-4"><CalculatorLinks heading="Plan your loan" /></div>
    </>
  );
}

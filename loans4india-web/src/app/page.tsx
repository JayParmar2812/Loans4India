import Link from "next/link";
import { QuickCheck } from "@/components/QuickCheck";
import { EmiCalculator } from "@/components/EmiCalculator";
import { Faq } from "@/components/Faq";

import { Fragment } from "react";
import { getSiteContent } from "@/lib/siteContent.server";
import { linkIsLive, type HomeSection, type SiteContent } from "@/config/siteContent";

/** `*words*` in the headline are highlighted; each line of the headline is its own line on the page. */
function Headline({ text }: { text: string }) {
  return text.split("\n").map((line, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {line.split(/(\*[^*]+\*)/).map((part, j) => (part.startsWith("*") && part.endsWith("*") && part.length > 2 ? <span key={j} className="text-mint">{part.slice(1, -1)}</span> : part))}
    </Fragment>
  ));
}

export default async function Home() {
  const site = await getSiteContent();
  const { hero } = site.home;
  return (
    <>
      {/* Hero */}
      <section className="bg-violet text-white relative overflow-hidden">
        {hero.image && (
          <>
            {/* Background photo from the Website screen, tinted with the main colour so the white text stays readable. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/site-assets/${hero.image}`} alt="" aria-hidden className="absolute inset-0 size-full object-cover" />
            <div aria-hidden className="absolute inset-0 bg-violet/85" />
          </>
        )}
        <div aria-hidden className="absolute -right-32 -top-32 size-[28rem] rounded-full bg-violet-deep/40" />
        <div aria-hidden className="absolute right-40 bottom-[-6rem] size-56 rounded-full bg-mint/20" />
        <div className="relative mx-auto max-w-6xl px-4 py-12 sm:py-16 grid gap-10 lg:grid-cols-[1.25fr_1fr] items-center">
          <div>
            {hero.eyebrow && (
              <p className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-sm">
                <span className="size-2 rounded-full bg-mint" aria-hidden /> {hero.eyebrow}
              </p>
            )}
            <h1 className="mt-5 text-[2.6rem] sm:text-6xl font-extrabold tracking-tight"><Headline text={hero.headline} /></h1>
            {hero.subHi && <p lang="hi" className="mt-3 text-xl text-white/85 font-display">{hero.subHi}</p>}
            {hero.sub && <p className="mt-5 text-lg text-white/85 max-w-xl">{hero.sub}</p>}
            {hero.badges.length > 0 && (
              <ul className="mt-7 flex flex-wrap gap-2 text-sm">
                {hero.badges.map((t, i) => (
                  <li key={i} className="rounded-full bg-white/12 px-3 py-1.5">✓ {t}</li>
                ))}
              </ul>
            )}
          </div>
          <QuickCheck />
        </div>
      </section>

      {site.home.order.map((s) => (site.home[s].show ? <Fragment key={s}>{SECTIONS[s](site)}</Fragment> : null))}
    </>
  );
}

const SECTIONS: Record<HomeSection, (site: SiteContent) => React.ReactNode> = {
  how: ({ home: { how } }) => (
    <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-16 scroll-mt-20">
      <h2 className="text-3xl sm:text-4xl font-extrabold text-violet-deep">{how.heading}</h2>
      <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {how.items.map((s, i) => (
          <li key={i} className="rounded-2xl bg-surface border border-line p-5">
            <span className="grid place-items-center size-9 rounded-full bg-violet-soft text-violet font-display font-bold num">{i + 1}</span>
            <h3 className="mt-3 text-lg font-bold">{s.title}</h3>
            <p className="text-muted text-[0.95rem] mt-1">{s.text}</p>
          </li>
        ))}
      </ol>
    </section>
  ),
  products: (site) => {
    const cards = site.home.products.cards.filter((c) => linkIsLive(c.href, site));
    if (cards.length === 0) return null;
    return (
      <section className="mx-auto max-w-6xl px-4 py-6 grid gap-5 md:grid-cols-2">
        {cards.map((c, i) => <ProductCard key={i} {...c} />)}
      </section>
    );
  },
  uses: ({ home: { uses } }) => (
    <section className="mx-auto max-w-6xl px-4 py-14">
      <h2 className="text-2xl sm:text-3xl font-extrabold text-violet-deep">{uses.heading}</h2>
      <ul className="mt-6 flex flex-wrap gap-3">
        {uses.items.map((u, i) => (
          <li key={i}><Link href="/apply" className="inline-block rounded-full border-2 border-line bg-surface px-4 py-2 font-display font-semibold hover:border-violet hover:text-violet">{u}</Link></li>
        ))}
      </ul>
    </section>
  ),
  why: ({ home: { why } }) => (
    <section className="bg-violet-soft">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-violet-deep max-w-2xl">{why.heading}</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {why.items.map((w, i) => (
            <div key={i}>
              <h3 className="text-lg font-bold">{w.title}</h3>
              <p className="text-muted mt-1">{w.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  ),
  emi: (site) => (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-violet-deep">{site.home.emi.heading}</h2>
          {site.home.emi.text && <p className="text-muted mt-1">{site.home.emi.text}</p>}
        </div>
        {site.tools.emiCalculator && <Link href="/emi-calculator#eligibility" className="text-violet font-semibold underline underline-offset-4">Quick estimate of what you can borrow →</Link>}
      </div>
      <EmiCalculator />
    </section>
  ),
  faq: ({ home: { faq } }) =>
    faq.items.length > 0 && (
      <section className="mx-auto max-w-3xl px-4 py-10">
        <h2 className="text-3xl font-extrabold text-violet-deep mb-6">{faq.heading}</h2>
        <Faq items={faq.items} />
      </section>
    ),
  cta: ({ home: { cta } }) => (
    <section className="mx-auto max-w-6xl px-4 pt-10">
      <div className="rounded-3xl bg-violet-deep text-white px-6 py-10 sm:px-12 flex flex-wrap items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-extrabold">{cta.heading}</h2>
          {cta.text && <p className="text-white/75 mt-1">{cta.text}</p>}
        </div>
        <Link href="/apply" className="btn-primary">{cta.button}</Link>
      </div>
    </section>
  ),
};

function ProductCard({ href, title, range, points }: { href: string; title: string; range: string; points: string[] }) {
  return (
    <Link href={href} className="group rounded-3xl bg-surface border border-line p-6 sm:p-7 hover:border-violet transition-colors flex flex-col gap-3">
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-2xl font-extrabold text-violet-deep">{title}</h3>
        <span aria-hidden className="text-violet text-2xl transition-transform group-hover:translate-x-1">→</span>
      </div>
      <p className="font-display font-semibold text-violet num">{range}</p>
      <ul className="text-muted space-y-1">{points.map((p, i) => <li key={i}>• {p}</li>)}</ul>
      <p className="text-xs text-muted mt-auto">Amounts indicative; final limits are set by each lender.</p>
    </Link>
  );
}

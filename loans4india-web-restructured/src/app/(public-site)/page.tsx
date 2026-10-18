import Link from "next/link";
import { Fragment } from "react";
import { QuickCheck } from "@/features/public-site/components/QuickCheck";
import { EmiCalculator } from "@/features/public-site/components/EmiCalculator";
import { Faq } from "@/features/public-site/components/Faq";
import { CalculatorLinks } from "@/features/public-site/components/CalculatorLinks";
import { LatestGuides } from "@/features/cms/components/LatestGuides";
import { getSiteContent } from "@/features/site-control/server/siteContent.server";
import { linkIsLive, type HomeSection, type SiteContent } from "@/features/site-control/config/siteContent";
import { JsonLd } from "@/shared/seo/JsonLd";
import { organisationLd, pageMetadata } from "@/shared/seo/metadata";
import { brand } from "@/shared/config/brand";
import { Icon, type IconName } from "@/shared/ui/Icon";

export const metadata = pageMetadata({
  title: `${brand.name} | Apply once, we submit to the right bank`,
  absoluteTitle: true,
  description: "Apply once for a personal or business loan. We check your file and submit it to one suitable partner bank or NBFC from the list you agree to. Free for you. Loan sourcing service, not a lender.",
  path: "/",
});

/** `*words*` in the headline are highlighted; each line of the headline is its own line on the page. */
function Headline({ text }: { text: string }) {
  return text.split("\n").map((line, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {line.split(/(\*[^*]+\*)/).map((part, j) =>
        part.startsWith("*") && part.endsWith("*") && part.length > 2 ? (
          <span key={j} className="text-violet underline decoration-mint decoration-[6px] underline-offset-[6px]">{part.slice(1, -1)}</span>
        ) : (
          part
        ),
      )}
    </Fragment>
  ));
}

// Fixed trust promises (Platform Flow v4, section 2: "not a lender", "no fee from you"). Not editable on purpose.
const TRUST: { icon: IconName; title: string; text: string }[] = [
  { icon: "rupee", title: "No fee from you", text: "Free at every stage. We never ask you for money." },
  { icon: "bank", title: "Not a lender", text: "The bank checks, decides and lends. We prepare and submit." },
  { icon: "shield", title: "Your consent, named banks", text: "Your data goes only to banks you agreed to, by name." },
  { icon: "lock", title: "Encrypted documents", text: "Virus-scanned, encrypted, viewed only by authorised staff." },
];

export default async function Home() {
  const site = await getSiteContent();
  const { hero } = site.home;
  return (
    <>
      <section className="hero-wash relative overflow-hidden border-b border-line">
        {hero.image && (
          <>
            {/* Background photo from the Website screen, washed out so text stays readable. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/site-assets/${hero.image}`} alt="" aria-hidden className="absolute inset-0 size-full object-cover opacity-15" />
          </>
        )}
        <div className="relative mx-auto max-w-6xl px-4 py-12 sm:py-16 grid gap-10 lg:grid-cols-[1.25fr_1fr] items-center">
          <div>
            {hero.eyebrow && (
              <p className="inline-flex items-center gap-2 rounded-full bg-white border border-line px-3 py-1 text-sm font-semibold shadow-sm">
                <span className="size-2 rounded-full bg-mint" aria-hidden /> {hero.eyebrow}
              </p>
            )}
            <h1 className="mt-5 text-[2.4rem] leading-[1.08] sm:text-6xl font-extrabold tracking-tight"><Headline text={hero.headline} /></h1>
            {hero.subHi && <p lang="hi" className="mt-4 text-xl text-muted">{hero.subHi}</p>}
            {hero.sub && <p className="mt-5 text-lg text-muted max-w-xl">{hero.sub}</p>}
            {hero.badges.length > 0 && (
              <ul className="mt-6 grid sm:grid-cols-2 gap-2 text-[0.95rem] max-w-xl">
                {hero.badges.map((t, i) => (
                  <li key={i} className="flex items-center gap-2"><span className="grid place-items-center size-6 rounded-full bg-mint text-mint-ink"><Icon name="check" className="size-4" /></span>{t}</li>
                ))}
              </ul>
            )}
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/apply" className="btn-primary">Start your application</Link>
              <Link href="/how-it-works" className="btn-ghost">See how it works</Link>
            </div>
          </div>
          <QuickCheck />
        </div>
      </section>

      <section aria-label="Our promises" className="border-b border-line bg-white">
        <ul className="mx-auto max-w-6xl px-4 py-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST.map((t) => (
            <li key={t.title} className="flex gap-3">
              <span className="grid place-items-center size-10 shrink-0 rounded-xl bg-violet-soft text-violet"><Icon name={t.icon} /></span>
              <span><b className="block text-[0.95rem]">{t.title}</b><span className="text-sm text-muted">{t.text}</span></span>
            </li>
          ))}
        </ul>
      </section>

      {site.home.order.map((s) => (site.home[s].show ? <Fragment key={s}>{SECTIONS[s](site)}</Fragment> : null))}

      <LatestGuides />
      <JsonLd data={organisationLd()} />
    </>
  );
}

const SECTIONS: Record<HomeSection, (site: SiteContent) => React.ReactNode> = {
  how: ({ home: { how } }) => (
    <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-16 scroll-mt-28">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-3xl sm:text-4xl font-extrabold">{how.heading}</h2>
        <Link href="/how-it-works" className="text-violet font-semibold underline underline-offset-4">Every step explained →</Link>
      </div>
      <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {how.items.map((s, i) => (
          <li key={i} className="card p-5 relative">
            <span className="grid place-items-center size-10 rounded-full bg-mint text-mint-ink font-display font-extrabold num">{i + 1}</span>
            <h3 className="mt-4 text-lg font-bold">{s.title}</h3>
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
      <section className="mx-auto max-w-6xl px-4 py-6">
        <h2 className="sr-only">Loans</h2>
        <div className="grid gap-5 md:grid-cols-2">{cards.map((c, i) => <ProductCard key={i} {...c} />)}</div>
      </section>
    );
  },
  uses: ({ home: { uses } }) => (
    <section className="mx-auto max-w-6xl px-4 py-14">
      <h2 className="text-2xl sm:text-3xl font-extrabold">{uses.heading}</h2>
      <ul className="mt-6 flex flex-wrap gap-3">
        {uses.items.map((u, i) => (
          <li key={i}><Link href="/apply" className="inline-block rounded-full border-2 border-line bg-white px-4 py-2 font-display font-semibold hover:border-violet hover:text-violet transition-colors">{u}</Link></li>
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
            <div key={i} className="rounded-2xl bg-white p-5">
              <h3 className="text-lg font-bold">{w.title}</h3>
              <p className="text-muted mt-1 text-[0.95rem]">{w.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  ),
  emi: (site) =>
    site.tools.emiCalculator && (
      <section className="mx-auto max-w-6xl px-4 py-16 space-y-10">
        <div>
          <h2 className="text-3xl sm:text-4xl font-extrabold">{site.home.emi.heading}</h2>
          {site.home.emi.text && <p className="text-muted mt-1">{site.home.emi.text}</p>}
        </div>
        <EmiCalculator showSchedule={false} />
        <CalculatorLinks except="/emi-calculator" heading="More calculators" />
      </section>
    ),
  faq: ({ home: { faq } }) =>
    faq.items.length > 0 && (
      <section className="mx-auto max-w-3xl px-4 py-10">
        <h2 className="text-3xl font-extrabold mb-6">{faq.heading}</h2>
        <Faq items={faq.items} />
        <p className="mt-4"><Link href="/faq" className="text-violet font-semibold underline underline-offset-4">All questions →</Link></p>
      </section>
    ),
  cta: ({ home: { cta } }) => (
    <section className="mx-auto max-w-6xl px-4 pt-10">
      <div className="rounded-3xl bg-mint px-6 py-10 sm:px-12 flex flex-wrap items-center justify-between gap-6 text-mint-ink">
        <div>
          <h2 className="text-3xl font-extrabold">{cta.heading}</h2>
          {cta.text && <p className="mt-1 opacity-80">{cta.text}</p>}
        </div>
        <Link href="/apply" className="btn-secondary">{cta.button}</Link>
      </div>
    </section>
  ),
};

function ProductCard({ href, title, range, points }: { href: string; title: string; range: string; points: string[] }) {
  return (
    <Link href={href} className="group card p-6 sm:p-7 hover:border-violet transition-colors flex flex-col gap-3">
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-2xl font-extrabold">{title}</h3>
        <span aria-hidden className="grid place-items-center size-9 rounded-full bg-violet-soft text-violet transition-transform group-hover:translate-x-1"><Icon name="arrow" className="size-4" /></span>
      </div>
      <p className="font-display font-bold text-violet num">{range}</p>
      <ul className="text-muted space-y-1.5">
        {points.map((p, i) => <li key={i} className="flex gap-2"><Icon name="check" className="size-5 text-mint-deep shrink-0" />{p}</li>)}
      </ul>
      <p className="text-xs text-muted mt-auto">Amounts you can apply for. Each bank sets its own limits and decides.</p>
    </Link>
  );
}

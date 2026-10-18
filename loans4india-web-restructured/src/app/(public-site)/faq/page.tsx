import Link from "next/link";
import { PageHero } from "@/features/public-site/components/PageHero";
import { Faq } from "@/features/public-site/components/Faq";
import { FAQ_TOPICS } from "@/features/public-site/content/faq";
import { JsonLd } from "@/shared/seo/JsonLd";
import { pageMetadata } from "@/shared/seo/metadata";
import { brand } from "@/shared/config/brand";

export const metadata = pageMetadata({
  title: "Frequently asked questions",
  description: `How ${brand.name} works, what it costs (nothing), documents you need, how your data and consent are handled, and who decides on your loan.`,
  path: "/faq",
});

export default function FaqPage() {
  return (
    <>
      <PageHero crumbs={[{ label: "FAQs", href: "/faq" }]} eyebrow="Straight answers" title="Frequently asked questions" intro={<>Can&apos;t find your answer? <Link href="/contact" className="text-violet underline">Ask us</Link>.</>} />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:py-12 grid gap-10 lg:grid-cols-[220px_1fr]">
        <nav aria-label="FAQ topics" className="lg:sticky lg:top-32 self-start min-w-0">
          <ul className="flex lg:flex-col gap-2 overflow-x-auto pb-2 lg:pb-0 text-sm">
            {FAQ_TOPICS.map((t) => (
              <li key={t.id}><a href={`#${t.id}`} className="block whitespace-nowrap rounded-lg px-3 py-2 font-semibold text-muted hover:text-violet hover:bg-violet-soft">{t.title}</a></li>
            ))}
          </ul>
        </nav>
        <div className="space-y-12 max-w-3xl min-w-0">
          {FAQ_TOPICS.map((t) => (
            <section key={t.id} id={t.id} aria-labelledby={`${t.id}-h`} className="scroll-mt-32">
              <h2 id={`${t.id}-h`} className="text-2xl font-extrabold mb-4">{t.title}</h2>
              <Faq items={t.items} schema={false} />
            </section>
          ))}
        </div>
      </div>
      {/* One FAQPage block for the whole page. */}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ_TOPICS.flatMap((t) => t.items).map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.a } })),
        }}
      />
    </>
  );
}

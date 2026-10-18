import { notFound } from "next/navigation";
import { PageHero } from "./PageHero";
import { CalculatorLinks } from "./CalculatorLinks";
import { Faq, type FaqItem } from "./Faq";
import { getSiteContent } from "@/features/site-control/server/siteContent.server";
import { JsonLd } from "@/shared/seo/JsonLd";
import { absoluteUrl } from "@/shared/seo/metadata";

/** Shared layout for a calculator page: hero, the tool, an explainer, questions, other calculators. */
export async function CalculatorPage(p: { path: string; title: string; intro: string; description: string; tool: React.ReactNode; explainer: React.ReactNode; faq?: FaqItem[] }) {
  if (!(await getSiteContent()).tools.emiCalculator) notFound();
  return (
    <>
      <PageHero crumbs={[{ label: "Calculators", href: "/calculators" }, { label: p.title, href: p.path }]} eyebrow="Free calculator" title={p.title} intro={p.intro} />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:py-12 space-y-14">
        {p.tool}
        <section className="prose-l4i text-muted">{p.explainer}</section>
        {p.faq && p.faq.length > 0 && (
          <section className="max-w-3xl">
            <h2 className="text-2xl font-extrabold mb-4">Questions</h2>
            <Faq items={p.faq} />
          </section>
        )}
        <CalculatorLinks except={p.path} />
      </div>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: p.title,
          url: absoluteUrl(p.path),
          description: p.description,
          applicationCategory: "FinanceApplication",
          operatingSystem: "Any",
          isAccessibleForFree: true,
        }}
      />
    </>
  );
}

import { JsonLd } from "@/shared/seo/JsonLd";

export type FaqItem = { q: string; a: string };

/**
 * Accordion of questions. FAQPage structured data is emitted only when the questions are the page's main content
 * (schema=true); a page should carry one FAQPage block at most.
 */
export function Faq({ items, schema = true }: { items: FaqItem[]; schema?: boolean }) {
  return (
    <div className="divide-y divide-line border-y border-line">
      {items.map((i, n) => (
        <details key={n} className="group py-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display font-bold text-[1.05rem] [&::-webkit-details-marker]:hidden">
            {i.q}
            <span aria-hidden className="grid place-items-center size-7 shrink-0 rounded-full bg-violet-soft text-violet text-xl transition-transform group-open:rotate-45">+</span>
          </summary>
          <p className="mt-2 text-muted max-w-[68ch] whitespace-pre-line">{i.a}</p>
        </details>
      ))}
      {schema && items.length > 0 && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: items.map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.a } })),
          }}
        />
      )}
    </div>
  );
}

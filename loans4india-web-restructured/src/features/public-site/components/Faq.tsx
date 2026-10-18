export type FaqItem = { q: string; a: string };

export function Faq({ items }: { items: FaqItem[] }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.a } })),
  };
  return (
    <div className="divide-y divide-line border-y border-line">
      {items.map((i, n) => (
        <details key={n} className="group py-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display font-semibold text-lg">
            {i.q}
            <span aria-hidden className="text-violet text-2xl transition-transform group-open:rotate-45">+</span>
          </summary>
          <p className="mt-2 text-muted max-w-[65ch]">{i.a}</p>
        </details>
      ))}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  );
}

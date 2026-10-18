import Link from "next/link";
import { Fragment } from "react";
import { EmiCalculator } from "@/features/public-site/components/EmiCalculator";
import { Faq } from "@/features/public-site/components/Faq";
import type { Block } from "@/features/site-control/config/siteContent";

/**
 * Renders validated CMS blocks (Website pages and guides). Text is always rendered as text, never as HTML,
 * so nothing typed in the CMS can inject markup or scripts.
 */
export function BlockList({ blocks, faqSchema = true }: { blocks: Block[]; faqSchema?: boolean }) {
  let faqDone = false;
  return blocks.map((b, i) => {
    // One FAQPage block per page.
    const schema = b.type === "faq" && faqSchema && !faqDone;
    if (b.type === "faq") faqDone = true;
    return (
      <Fragment key={i}>
        {b.type === "heading" && <h2 className="text-2xl sm:text-3xl font-extrabold pt-4">{b.text}</h2>}
        {b.type === "text" && b.text.split(/\n{2,}/).map((para, j) => <p key={j} className="text-[1.05rem] leading-relaxed whitespace-pre-line">{para}</p>)}
        {b.type === "image" && (
          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/site-assets/${b.asset}`} alt={b.alt} className="w-full rounded-2xl border border-line" loading="lazy" />
            {b.caption && <figcaption className="text-sm text-muted mt-2">{b.caption}</figcaption>}
          </figure>
        )}
        {b.type === "list" && (
          <ul className="space-y-2 text-[1.05rem]">{b.items.map((it, j) => <li key={j} className="flex gap-2"><span className="text-mint-deep font-bold" aria-hidden>✓</span>{it}</li>)}</ul>
        )}
        {b.type === "faq" && <Faq items={b.items} schema={schema} />}
        {b.type === "cta" && (
          <div className="rounded-3xl bg-mint text-mint-ink px-6 py-8 sm:px-10 flex flex-wrap items-center justify-between gap-5">
            <div>
              <h2 className="text-2xl font-extrabold">{b.heading}</h2>
              {b.text && <p className="opacity-80 mt-1">{b.text}</p>}
            </div>
            <Link href={b.href} className="btn-secondary">{b.button}</Link>
          </div>
        )}
        {b.type === "emi" && <EmiCalculator />}
      </Fragment>
    );
  });
}

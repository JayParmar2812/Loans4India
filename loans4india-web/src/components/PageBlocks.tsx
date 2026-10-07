import Link from "next/link";
import { Fragment } from "react";
import { EmiCalculator } from "./EmiCalculator";
import { Faq } from "./Faq";
import type { SitePage } from "@/config/siteContent";

/** A page built on the Website screen, block by block. */
export function PageBlocks({ page }: { page: SitePage }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 space-y-6">
      <h1 className="text-4xl sm:text-5xl font-extrabold text-violet-deep">{page.title}</h1>
      {page.blocks.map((b, i) => (
        <Fragment key={i}>
          {b.type === "heading" && <h2 className="text-2xl sm:text-3xl font-extrabold text-violet-deep pt-4">{b.text}</h2>}
          {b.type === "text" && b.text.split(/\n{2,}/).map((para, j) => <p key={j} className="text-lg leading-relaxed whitespace-pre-line">{para}</p>)}
          {b.type === "image" && (
            <figure>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/site-assets/${b.asset}`} alt={b.alt} className="w-full rounded-2xl border border-line" loading="lazy" />
              {b.caption && <figcaption className="text-sm text-muted mt-2">{b.caption}</figcaption>}
            </figure>
          )}
          {b.type === "list" && (
            <ul className="space-y-2 text-lg">{b.items.map((it, j) => <li key={j} className="flex gap-2"><span className="text-violet">✓</span>{it}</li>)}</ul>
          )}
          {b.type === "faq" && <Faq items={b.items} />}
          {b.type === "cta" && (
            <div className="rounded-3xl bg-violet-deep text-white px-6 py-8 sm:px-10 flex flex-wrap items-center justify-between gap-5">
              <div>
                <h2 className="text-2xl font-extrabold">{b.heading}</h2>
                {b.text && <p className="text-white/75 mt-1">{b.text}</p>}
              </div>
              <Link href={b.href} className="btn-primary">{b.button}</Link>
            </div>
          )}
          {b.type === "emi" && <EmiCalculator />}
        </Fragment>
      ))}
    </article>
  );
}

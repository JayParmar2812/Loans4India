import type { SitePage } from "@/features/site-control/config/siteContent";
import { Breadcrumbs } from "@/shared/ui/Breadcrumbs";
import { BlockList } from "./BlockList";

/** A page built on the Website screen, block by block. */
export function PageBlocks({ page }: { page: SitePage }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-8 sm:py-12 space-y-6">
      <Breadcrumbs items={[{ label: page.title, href: `/${page.slug}` }]} />
      <h1 className="text-4xl sm:text-5xl font-extrabold">{page.title}</h1>
      <BlockList blocks={page.blocks} />
    </article>
  );
}

import Link from "next/link";
import { BlockList } from "@/features/site-control/components/BlockList";
import { ARTICLE_CATEGORIES, readingMinutes, type ArticleData } from "@/features/cms/domain/article";
import { Breadcrumbs } from "@/shared/ui/Breadcrumbs";
import { JsonLd } from "@/shared/seo/JsonLd";
import { absoluteUrl } from "@/shared/seo/metadata";
import { brand } from "@/shared/config/brand";

/** A guide, as the public sees it (and as staff preview it before approval). */
export function ArticleView({ slug, data, publishedAt, updatedAt, related = [], preview = false }: {
  slug: string; data: ArticleData; publishedAt: Date | null; updatedAt: Date | null; related?: { slug: string; title: string; excerpt: string }[]; preview?: boolean;
}) {
  const path = `/guides/${slug}`;
  const date = (d: Date) => d.toLocaleDateString("en-IN", { dateStyle: "long", timeZone: "Asia/Kolkata" });
  return (
    <article className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Guides", href: "/guides" }, { label: data.breadcrumb || data.title, href: path }]} />
      <p className="eyebrow mt-6">{ARTICLE_CATEGORIES[data.category]} · {readingMinutes(data)} min read</p>
      <h1 className="mt-2 text-3xl sm:text-5xl font-extrabold">{data.title}</h1>
      <p className="mt-4 text-lg text-muted">{data.excerpt}</p>
      <p className="mt-3 text-sm text-muted">
        {publishedAt ? <>Published {date(publishedAt)}</> : "Not published yet"}
        {updatedAt && publishedAt && updatedAt.getTime() - publishedAt.getTime() > 864e5 ? <> · Updated {date(updatedAt)}</> : null} · by the {brand.name} team
      </p>
      <div className="mt-8 space-y-6"><BlockList blocks={data.blocks} /></div>
      <aside className="mt-12 rounded-2xl border border-line bg-canvas p-5 text-sm text-muted">
        General information, not financial advice. {brand.name} is a loan sourcing service, not a lender: each bank sets its own rules, rates and decisions.
      </aside>
      {related.length > 0 && (
        <section className="mt-12" aria-labelledby="rel-h">
          <h2 id="rel-h" className="text-xl font-extrabold mb-4">Related guides</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {related.map((r) => (
              <li key={r.slug}><Link href={`/guides/${r.slug}`} className="card block p-4 hover:border-violet"><b className="block">{r.title}</b><span className="text-sm text-muted">{r.excerpt}</span></Link></li>
            ))}
          </ul>
        </section>
      )}
      {!preview && publishedAt && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "Article",
            headline: data.title,
            description: data.seo.description || data.excerpt,
            datePublished: publishedAt.toISOString(),
            dateModified: (updatedAt ?? publishedAt).toISOString(),
            mainEntityOfPage: absoluteUrl(path),
            author: { "@type": "Organization", name: brand.name, url: brand.siteUrl },
            publisher: { "@type": "Organization", name: brand.name, logo: { "@type": "ImageObject", url: absoluteUrl(brand.logo.src) } },
            ...(data.seo.image ? { image: absoluteUrl(`/site-assets/${data.seo.image}`) } : {}),
          }}
        />
      )}
    </article>
  );
}

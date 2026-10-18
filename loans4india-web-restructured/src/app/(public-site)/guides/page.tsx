import Link from "next/link";
import { PageHero } from "@/features/public-site/components/PageHero";
import { publishedArticles } from "@/features/cms/server/articles.server";
import { ARTICLE_CATEGORIES, readingMinutes } from "@/features/cms/domain/article";
import { pageMetadata } from "@/shared/seo/metadata";

export const dynamic = "force-dynamic";
export const metadata = pageMetadata({
  title: "Loan guides",
  description: "Plain-language guides to personal and business loans: documents, EMIs, Key Fact Statements, your rights and how banks decide.",
  path: "/guides",
});

export default async function GuidesPage() {
  const list = (await publishedArticles()).filter((a) => !a.data.seo.noindex);
  return (
    <>
      <PageHero crumbs={[{ label: "Guides", href: "/guides" }]} eyebrow="Learn before you borrow" title="Loan guides" intro="Plain-language explainers on documents, EMIs, costs and your rights. Every guide is reviewed before it's published." />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:py-12">
        {list.length === 0 ? (
          <div className="card p-8 text-center space-y-3 max-w-xl mx-auto">
            <h2 className="text-xl font-bold">Guides are on their way</h2>
            <p className="text-muted">Our first guides are being reviewed. Meanwhile, the calculators and FAQs answer the most common questions.</p>
            <div className="flex flex-wrap justify-center gap-3"><Link href="/calculators" className="btn-ghost">Calculators</Link><Link href="/faq" className="btn-ghost">FAQs</Link></div>
          </div>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((a) => (
              <li key={a.slug}>
                <Link href={`/guides/${a.slug}`} className="card h-full p-6 flex flex-col gap-2 hover:border-violet transition-colors group">
                  <span className="eyebrow">{ARTICLE_CATEGORIES[a.data.category]} · {readingMinutes(a.data)} min read</span>
                  <h2 className="font-display font-bold text-lg group-hover:text-violet">{a.data.title}</h2>
                  <p className="text-sm text-muted">{a.data.excerpt}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

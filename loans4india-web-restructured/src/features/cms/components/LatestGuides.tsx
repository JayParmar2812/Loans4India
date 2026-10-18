import Link from "next/link";
import { publishedArticles } from "@/features/cms/server/articles.server";
import { ARTICLE_CATEGORIES, readingMinutes } from "@/features/cms/domain/article";

/** Home-page teaser of the newest published guides. Renders nothing until a guide has been approved and published. */
export async function LatestGuides({ limit = 3 }: { limit?: number }) {
  const list = (await publishedArticles()).filter((a) => !a.data.seo.noindex).slice(0, limit);
  if (list.length === 0) return null;
  return (
    <section className="mx-auto max-w-6xl px-4 py-16" aria-labelledby="guides-h">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <h2 id="guides-h" className="text-3xl sm:text-4xl font-extrabold">Guides before you borrow</h2>
        <Link href="/guides" className="text-violet font-semibold underline underline-offset-4">All guides →</Link>
      </div>
      <ul className="grid gap-5 md:grid-cols-3">
        {list.map((a) => (
          <li key={a.slug}>
            <Link href={`/guides/${a.slug}`} className="card h-full p-6 flex flex-col gap-2 hover:border-violet transition-colors group">
              <span className="eyebrow">{ARTICLE_CATEGORIES[a.data.category]} · {readingMinutes(a.data)} min</span>
              <span className="font-display font-bold text-lg group-hover:text-violet">{a.data.title}</span>
              <span className="text-sm text-muted">{a.data.excerpt}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

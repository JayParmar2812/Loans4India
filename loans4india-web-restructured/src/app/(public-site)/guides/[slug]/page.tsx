import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleView } from "@/features/cms/components/ArticleView";
import { publishedArticle, publishedArticles } from "@/features/cms/server/articles.server";
import { followRedirect } from "@/features/cms/server/redirects.server";
import { pageMetadata } from "@/shared/seo/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const a = await publishedArticle((await params).slug);
  if (!a) return { title: "Guide not found", robots: { index: false } };
  const d = a.data;
  return pageMetadata({
    title: d.seo.title || d.title,
    description: d.seo.description || d.excerpt,
    path: d.seo.canonical || `/guides/${a.slug}`,
    noindex: d.seo.noindex,
    type: "article",
    image: d.seo.image ? { url: `/site-assets/${d.seo.image}`, alt: d.seo.imageAlt } : null,
    publishedTime: a.publishedAt.toISOString(),
    modifiedTime: a.updatedAt.toISOString(),
  });
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = await publishedArticle(slug);
  if (!a) {
    await followRedirect(`/guides/${slug}`);
    notFound();
  }
  const all = await publishedArticles();
  const related = a.data.related.map((s) => all.find((x) => x.slug === s)).filter((x) => x !== undefined).map((x) => ({ slug: x.slug, title: x.data.title, excerpt: x.data.excerpt }));
  return <ArticleView slug={a.slug} data={a.data} publishedAt={a.publishedAt} updatedAt={a.updatedAt} related={related} />;
}

import type { MetadataRoute } from "next";
import { brand } from "@/shared/config/brand";
import { linkIsLive } from "@/features/site-control/config/siteContent";
import { getSiteContent } from "@/features/site-control/server/siteContent.server";
import { publishedArticles } from "@/features/cms/server/articles.server";
import { CALCULATORS } from "@/features/public-site/content/calculators";

/** Only published, indexable pages. Private areas, drafts, noindex guides and switched-off products are left out. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = brand.siteUrl;
  const site = await getSiteContent();
  const fixed = [
    "", "/personal-loan", "/business-loan", "/how-it-works", "/calculators", ...CALCULATORS.map((c) => c.href),
    "/faq", "/guides", "/about", "/contact", "/privacy", "/terms", "/grievance",
  ];
  const pages = site.pages.filter((p) => p.published).map((p) => `/${p.slug}`);
  const entries: MetadataRoute.Sitemap = [...fixed, ...pages]
    .filter((p, i, a) => a.indexOf(p) === i && (p === "" || linkIsLive(p, site)))
    .map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly", priority: p === "" ? 1 : ["/personal-loan", "/business-loan"].includes(p) ? 0.9 : 0.7 }));
  const guides = (await publishedArticles())
    .filter((a) => !a.data.seo.noindex && !a.data.seo.canonical)
    .map((a) => ({ url: `${base}/guides/${a.slug}`, lastModified: a.updatedAt, changeFrequency: "monthly" as const, priority: 0.6 }));
  return [...entries, ...guides];
}

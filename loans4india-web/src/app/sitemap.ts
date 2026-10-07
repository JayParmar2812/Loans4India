import type { MetadataRoute } from "next";
import { brand } from "@/config/brand";
import { linkIsLive } from "@/config/siteContent";
import { getSiteContent } from "@/lib/siteContent.server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = `https://${brand.domain}`;
  // Pages switched off on the Website screen are left out.
  const site = await getSiteContent();
  const pages = site.pages.filter((p) => p.published).map((p) => `/${p.slug}`);
  return ["", "/personal-loan", "/business-loan", "/emi-calculator", "/about", "/privacy", "/terms", "/grievance", ...pages]
    .filter((p) => p === "" || linkIsLive(p, site))
    .map((p) => ({
      url: `${base}${p}`,
      changeFrequency: "weekly",
      priority: p === "" ? 1 : 0.7,
    }));
}

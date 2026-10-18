import type { MetadataRoute } from "next";
import { brand } from "@/shared/config/brand";

/** Public pages are crawlable; private areas, APIs and the application journey are not (Platform Flow v4, section 2). */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/apply", "/documents", "/share", "/my"] },
    sitemap: `${brand.siteUrl}/sitemap.xml`,
    host: brand.siteUrl,
  };
}

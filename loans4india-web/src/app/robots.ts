import type { MetadataRoute } from "next";
import { brand } from "@/config/brand";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/apply", "/documents", "/share"] },
    sitemap: `https://${brand.domain}/sitemap.xml`,
  };
}

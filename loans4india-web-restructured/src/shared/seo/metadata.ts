import type { Metadata } from "next";
import { brand } from "@/shared/config/brand";

/**
 * Page metadata with a canonical URL (relative to metadataBase, i.e. NEXT_PUBLIC_SITE_URL) and social previews.
 * Every public page should use this so titles, descriptions and canonicals stay unique and consistent.
 */
export function pageMetadata(p: { title: string; description?: string; path: string; noindex?: boolean; image?: { url: string; alt?: string } | null; type?: "website" | "article"; absoluteTitle?: boolean; publishedTime?: string; modifiedTime?: string }): Metadata {
  const images = p.image ? [{ url: p.image.url, alt: p.image.alt ?? "" }] : undefined;
  return {
    title: p.absoluteTitle ? { absolute: p.title } : p.title,
    description: p.description,
    alternates: { canonical: p.path },
    robots: p.noindex ? { index: false, follow: true } : undefined,
    openGraph: {
      title: p.title,
      description: p.description,
      url: p.path,
      siteName: brand.name,
      locale: "en_IN",
      type: p.type ?? "website",
      ...(images ? { images } : {}),
      ...(p.type === "article" ? { publishedTime: p.publishedTime, modifiedTime: p.modifiedTime } : {}),
    },
    twitter: { card: "summary_large_image", title: p.title, description: p.description, ...(images ? { images: images.map((i) => i.url) } : {}) },
  };
}

/** Absolute URL on the public site, for structured data. */
export const absoluteUrl = (path: string) => `${brand.siteUrl}${path.startsWith("/") ? path : `/${path}`}`;

/** Organization + WebSite structured data for the home page (facts only: name, URL, logo, contact). */
export function organisationLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": absoluteUrl("/#organization"),
        name: brand.name,
        url: brand.siteUrl,
        logo: absoluteUrl(brand.logo.src),
        description: "Loan sourcing service (Direct Selling Agent) for partner banks and NBFCs. Not a lender.",
        contactPoint: [{ "@type": "ContactPoint", contactType: "customer support", email: brand.supportEmail, areaServed: "IN", availableLanguage: ["en", "hi"] }],
      },
      { "@type": "WebSite", "@id": absoluteUrl("/#website"), url: brand.siteUrl, name: brand.name, publisher: { "@id": absoluteUrl("/#organization") }, inLanguage: "en-IN" },
    ],
  };
}

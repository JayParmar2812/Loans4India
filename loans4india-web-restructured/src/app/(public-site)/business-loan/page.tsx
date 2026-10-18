import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductPage } from "@/features/public-site/components/ProductPage";
import { getSiteContent } from "@/features/site-control/server/siteContent.server";
import { pageMetadata } from "@/shared/seo/metadata";

// Text comes from the Website screen (/admin/site); the defaults are in src/features/site-control/config/siteContent.ts.
export async function generateMetadata(): Promise<Metadata> {
  const c = (await getSiteContent()).products.BUSINESS_LOAN;
  return pageMetadata({ title: c.metaTitle || c.title, description: c.metaDescription || c.intro, path: "/business-loan" });
}

export default async function Page() {
  const c = (await getSiteContent()).products.BUSINESS_LOAN;
  if (!c.enabled) notFound();
  return <ProductPage c={{ ...c, product: "BUSINESS_LOAN", path: "/business-loan" }} />;
}

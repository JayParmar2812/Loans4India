import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductPage } from "@/components/ProductPage";
import { getSiteContent } from "@/lib/siteContent.server";

// Text comes from the Website screen (/admin/site); the defaults are in src/config/siteContent.ts.
export async function generateMetadata(): Promise<Metadata> {
  const c = (await getSiteContent()).products.PERSONAL_LOAN;
  return { title: c.metaTitle || c.title, description: c.metaDescription || undefined };
}

export default async function Page() {
  const c = (await getSiteContent()).products.PERSONAL_LOAN;
  if (!c.enabled) notFound();
  return <ProductPage c={{ ...c, product: "PERSONAL_LOAN" }} />;
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageBlocks } from "@/components/PageBlocks";
import { getSiteContent } from "@/lib/siteContent.server";

// Pages made on the Website screen (/admin/site). Every built-in address (/apply, /about…) has its own folder and wins over this one.
async function findPage(slug: string) {
  const page = (await getSiteContent()).pages.find((p) => p.slug === slug);
  return page?.published ? page : null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const page = await findPage((await params).slug);
  return page ? { title: page.title, description: page.metaDescription || undefined } : {};
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const page = await findPage((await params).slug);
  if (!page) notFound();
  return <PageBlocks page={page} />;
}

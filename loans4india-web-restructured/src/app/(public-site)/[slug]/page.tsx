import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageBlocks } from "@/features/site-control/components/PageBlocks";
import { getSiteContent } from "@/features/site-control/server/siteContent.server";
import { followRedirect } from "@/features/cms/server/redirects.server";
import { pageMetadata } from "@/shared/seo/metadata";

// Pages made on the Website screen (/admin/site). Every built-in address (/apply, /about…) has its own folder and wins over this one.
async function findPage(slug: string) {
  const page = (await getSiteContent()).pages.find((p) => p.slug === slug);
  return page?.published ? page : null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const page = await findPage((await params).slug);
  return page ? pageMetadata({ title: page.title, description: page.metaDescription || undefined, path: `/${page.slug}` }) : { robots: { index: false } };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await findPage(slug);
  if (!page) {
    // A retired or renamed address goes to its replacement; anything else is a real 404.
    await followRedirect(`/${slug}`);
    notFound();
  }
  return <PageBlocks page={page} />;
}

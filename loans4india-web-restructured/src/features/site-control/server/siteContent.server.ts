import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { prisma } from "@/shared/db/db";
import { DEFAULT_SITE_CONTENT, normaliseSiteContent, type SiteContent } from "@/features/site-control/config/siteContent";

/** The newest published version, or the built-in defaults if nothing was published yet. Usable outside a request (scripts). */
export async function readSiteContent(): Promise<SiteContent> {
  const row = await prisma.siteContentVersion.findFirst({ where: { publishedAt: { not: null } }, orderBy: { id: "desc" } });
  if (!row) return DEFAULT_SITE_CONTENT;
  try {
    return normaliseSiteContent(JSON.parse(row.content));
  } catch {
    console.error(`Website content version ${row.id} is not valid JSON; showing the defaults.`);
    return DEFAULT_SITE_CONTENT;
  }
}

/**
 * The live public-site content for a page render.
 * connection() keeps pages that read it out of build-time prerendering, so a publish shows on the next page load.
 */
export const getSiteContent = cache(async (): Promise<SiteContent> => {
  await connection();
  return readSiteContent();
});

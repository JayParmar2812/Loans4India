import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { prisma } from "./db";
import { DEFAULT_SITE_CONTENT, normaliseSiteContent, type SiteContent } from "@/config/siteContent";

/**
 * The live public-site content: the newest saved version, or the built-in defaults if nothing was saved yet.
 * connection() keeps pages that read it out of build-time prerendering, so a save shows on the next page load.
 */
export const getSiteContent = cache(async (): Promise<SiteContent> => {
  await connection();
  const row = await prisma.siteContentVersion.findFirst({ orderBy: { id: "desc" } });
  if (!row) return DEFAULT_SITE_CONTENT;
  try {
    return normaliseSiteContent(JSON.parse(row.content));
  } catch {
    console.error(`Website content version ${row.id} is not valid JSON; showing the defaults.`);
    return DEFAULT_SITE_CONTENT;
  }
});

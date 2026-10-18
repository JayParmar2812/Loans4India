import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { prisma } from "@/shared/db/db";
import { DEFAULT_FLOW, normaliseFlow, type Flow, type LoanType } from "@/features/applicant-flow/config/applicantFlow";
import { consentBanks } from "@/features/bank-submission/config/banks";
import type { SiteContent } from "@/features/site-control/config/siteContent";

export type LiveFlow = { version: number; flow: Flow };

/** The live applicant flow: the newest saved version, or the built-in defaults (version 0). Usable outside a request (scripts). */
export async function readLiveFlow(): Promise<LiveFlow> {
  const row = await prisma.applicantFlowVersion.findFirst({ orderBy: { id: "desc" } });
  if (!row) return { version: 0, flow: DEFAULT_FLOW };
  try {
    return { version: row.id, flow: normaliseFlow(JSON.parse(row.content)) };
  } catch {
    console.error(`Applicant flow version ${row.id} can't be read; using the built-in defaults.`);
    return { version: 0, flow: DEFAULT_FLOW };
  }
}

/** The live applicant flow for a request; connection() keeps reading pages out of build-time prerendering. */
export const getLiveFlow = cache(async (): Promise<LiveFlow> => {
  await connection();
  return readLiveFlow();
});

/**
 * Loan types taking new applications: applications not paused on the Website screen, the loan type switched on here,
 * its page switched on (for the two built-in loan pages), and at least one partner bank covering it.
 */
export function openLoanTypes(site: SiteContent, flow: Flow): LoanType[] {
  if (!site.applications.open) return [];
  return flow.loanTypes.filter((l) => {
    if (!l.open) return false;
    if (l.id === "PERSONAL_LOAN" || l.id === "BUSINESS_LOAN") if (!site.products[l.id].enabled) return false;
    return consentBanks(l.banks).length > 0;
  });
}

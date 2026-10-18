import "server-only";
import { permanentRedirect, redirect } from "next/navigation";
import { prisma } from "@/shared/db/db";

/**
 * Same-site redirects for retired or renamed pages. Only paths on this site, never another host (no open redirects);
 * private areas can't be redirected; loops and chains are refused when a redirect is saved.
 */
const PROTECTED = /^\/(admin|api|my|apply|documents|share|_next|site-assets|brand)(\/|$)/;
export const PATH_RE = /^\/(?!\/)[a-z0-9\-/]{0,200}$/;

export function redirectPathProblem(p: string, which: "from" | "to"): string | null {
  if (!PATH_RE.test(p)) return `The ${which === "from" ? "old" : "new"} address must be a path on this site in lower case, like /guides/emi-explained`;
  if (which === "from" && (p === "/" || PROTECTED.test(p))) return "That address can't be redirected.";
  if (which === "to" && /^\/(admin|api|_next)(\/|$)/.test(p)) return "Redirects can't point into private areas.";
  return null;
}

/** Would adding from → to create a loop (to eventually leads back to from)? */
export async function createsLoop(from: string, to: string): Promise<boolean> {
  if (from === to) return true;
  const seen = new Set([from]);
  let cur: string | null = to;
  for (let i = 0; cur && i < 20; i++) {
    if (seen.has(cur)) return true;
    seen.add(cur);
    cur = (await prisma.redirect.findUnique({ where: { fromPath: cur }, select: { toPath: true } }))?.toPath ?? null;
  }
  return false;
}

/** Called by catch-all pages before a 404: follow a saved redirect for this exact path, if there is one. */
export async function followRedirect(path: string): Promise<void> {
  if (!PATH_RE.test(path)) return;
  const r = await prisma.redirect.findUnique({ where: { fromPath: path } });
  if (!r) return;
  if (r.permanent) permanentRedirect(r.toPath);
  redirect(r.toPath);
}

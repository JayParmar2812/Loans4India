"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { actorOf, currentStaff } from "@/lib/staff.server";
import { getSiteContent } from "@/lib/siteContent.server";
import { bannedPhrases, DEFAULT_SITE_CONTENT, HOME_SECTION_LABELS, HOME_SECTIONS, normaliseSiteContent, siteContentSchema, themeProblems, type SiteContent } from "@/config/siteContent";
import { cleanName, scanFile } from "@/lib/filecheck.server";
import { deleteStored, saveEncrypted } from "@/lib/storage.server";

export type SiteResult = { ok: boolean; message: string; version?: number };
const fail = (message: string): SiteResult => ({ ok: false, message });

/** Only someone with site.manage (the master admin) gets past this. */
async function guard() {
  const user = await currentStaff();
  if (!user || !can(user, "site.manage")) return null;
  return user;
}

/** Plain names of the parts that changed, for the Activity screen. */
function changedParts(before: SiteContent, after: SiteContent): string[] {
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const out: string[] = [];
  if (!same(before.banner, after.banner)) out.push("Banner");
  if (!same(before.applications, after.applications)) out.push(after.applications.open ? "Applications (open)" : "Applications (paused)");
  if (!same(before.nav, after.nav)) out.push("Menu");
  if (!same(before.home.order, after.home.order)) out.push("Home section order");
  if (!same(before.home.hero, after.home.hero)) out.push("Home: top banner");
  for (const s of HOME_SECTIONS) if (!same(before.home[s], after.home[s])) out.push(`Home: ${HOME_SECTION_LABELS[s]}`);
  if (!same(before.products.PERSONAL_LOAN, after.products.PERSONAL_LOAN)) out.push("Personal Loan page");
  if (!same(before.products.BUSINESS_LOAN, after.products.BUSINESS_LOAN)) out.push("Business Loan page");
  if (!same(before.tools, after.tools)) out.push("EMI calculator page");
  if (!same(before.footer, after.footer)) out.push("Footer");
  const before_ = new Map(before.pages.map((p) => [p.slug, p]));
  for (const p of after.pages) {
    const was = before_.get(p.slug);
    if (!was) out.push(`New page /${p.slug}${p.published ? "" : " (draft)"}`);
    else if (!same(was, p)) out.push(`Page /${p.slug}${was.published !== p.published ? (p.published ? " (published)" : " (unpublished)") : ""}`);
  }
  for (const p of before.pages) if (!after.pages.some((q) => q.slug === p.slug)) out.push(`Removed page /${p.slug}`);
  if (!same(before.theme, after.theme)) out.push("Look (colours, font, logo)");
  return out;
}

async function publish(content: SiteContent, actor: string, type: "SITE_CONTENT_SAVED" | "SITE_CONTENT_RESTORED", note: string | null, extra: Record<string, unknown> = {}) {
  const before = await getSiteContent();
  const changed = changedParts(before, content);
  if (changed.length === 0) return fail("Nothing has changed since the last save.");
  if ((await missingImages(content)).length) return fail("An image this version uses has been removed from the library. Pick another image and save.");
  const row = await prisma.siteContentVersion.create({ data: { content: JSON.stringify(content), note, createdBy: actor } });
  await prisma.adminEvent.create({ data: { type, actor, target: `website v${row.id}`, detail: JSON.stringify({ changed, note, ...extra }) } });
  // Every public page reads the content through the root layout.
  revalidatePath("/", "layout");
  return { ok: true, message: `Live on the site now (version ${row.id}). Changed: ${changed.join(", ")}.`, version: row.id };
}

export async function saveSiteContent(json: string, note: string): Promise<SiteResult> {
  const user = await guard();
  if (!user) return fail("Only the master admin can change the website.");
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return fail("The editor sent something unreadable. Reload the page and try again.");
  }
  const parsed = siteContentSchema.safeParse(raw);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return fail(`${i.message} (at ${i.path.join(" › ")}).`);
  }
  const look = themeProblems(parsed.data.theme);
  if (look.length) return fail(`${look[0]}. Pick a darker or lighter colour.`);
  const banned = bannedPhrases(parsed.data);
  if (banned.length) return fail(`The site can't say "${banned.join('", "')}". An estimate is never an approval, and only the bank decides.`);
  return publish(normaliseSiteContent(parsed.data), actorOf(user), "SITE_CONTENT_SAVED", note.trim().slice(0, 200) || null);
}

/** Put an older version (or the original site, version 0) live again, as a new version so nothing is lost. */
export async function restoreSiteContent(version: number): Promise<SiteResult> {
  const user = await guard();
  if (!user) return fail("Only the master admin can change the website.");
  let content: SiteContent;
  if (version === 0) content = DEFAULT_SITE_CONTENT;
  else {
    const row = await prisma.siteContentVersion.findUnique({ where: { id: version } });
    if (!row) return fail("That version doesn't exist.");
    content = normaliseSiteContent(JSON.parse(row.content));
  }
  return publish(content, actorOf(user), "SITE_CONTENT_RESTORED", version === 0 ? "Back to the original site" : `Restored version ${version}`, { from: version });
}

/** Every library image the content points at. */
function usedImages(c: SiteContent): string[] {
  const ids = [c.home.hero.image, ...c.pages.flatMap((p) => p.blocks.flatMap((b) => (b.type === "image" ? [b.asset] : [])))];
  return [...new Set(ids.filter(Boolean))];
}

async function missingImages(c: SiteContent): Promise<string[]> {
  const ids = usedImages(c);
  if (ids.length === 0) return [];
  const found = await prisma.siteAsset.findMany({ where: { id: { in: ids }, deletedAt: null }, select: { id: true } });
  return ids.filter((id) => !found.some((f) => f.id === id));
}

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/** JPG, PNG or WebP, judged by the file's first bytes; SVG and everything else are refused. */
function imageType(buf: Buffer): { mime: string; ext: string } | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: "image/png", ext: "png" };
  if (buf.length >= 12 && buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return { mime: "image/webp", ext: "webp" };
  return null;
}

export type ImageResult = SiteResult & { image?: { id: string; name: string; alt: string } };

export async function uploadSiteImage(fd: FormData): Promise<ImageResult> {
  const user = await guard();
  if (!user) return fail("Only the master admin can change the website.");
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("Choose an image to upload.");
  if (file.size > MAX_IMAGE_BYTES) return fail("Images can be up to 2 MB. Save a smaller copy and try again.");
  const buf = Buffer.from(await file.arrayBuffer());
  const type = imageType(buf);
  if (!type) return fail("Only JPG, PNG or WebP images are accepted.");
  const scan = await scanFile(buf);
  if (scan === "INFECTED") return fail("This file failed the virus check.");
  if (scan === "UNAVAILABLE") return fail("The virus check isn't available right now, so the image wasn't saved. Try again later.");
  const alt = String(fd.get("alt") ?? "").trim().slice(0, 200);
  const storageKey = await saveEncrypted(buf);
  const row = await prisma.siteAsset.create({ data: { name: cleanName(file.name, type.ext), mime: type.mime, bytes: buf.length, storageKey, alt, createdBy: actorOf(user) } });
  await prisma.adminEvent.create({ data: { type: "SITE_IMAGE_UPLOADED", actor: actorOf(user), target: row.name, detail: JSON.stringify({ id: row.id, bytes: row.bytes, scan }) } });
  revalidatePath("/admin/site");
  return { ok: true, message: `${row.name} added to the library.`, image: { id: row.id, name: row.name, alt: row.alt } };
}

/** Remove an image from the library. Refused while the live site still uses it. */
export async function deleteSiteImage(id: string): Promise<SiteResult> {
  const user = await guard();
  if (!user) return fail("Only the master admin can change the website.");
  const row = await prisma.siteAsset.findUnique({ where: { id } });
  if (!row || row.deletedAt) return fail("That image is already gone.");
  if (usedImages(await getSiteContent()).includes(id)) return fail("The live site uses this image. Remove it from the page or banner and save first.");
  await prisma.siteAsset.update({ where: { id }, data: { deletedAt: new Date() } });
  await deleteStored(row.storageKey);
  await prisma.adminEvent.create({ data: { type: "SITE_IMAGE_DELETED", actor: actorOf(user), target: row.name, detail: JSON.stringify({ id }) } });
  revalidatePath("/admin/site");
  return { ok: true, message: `${row.name} removed from the library.` };
}

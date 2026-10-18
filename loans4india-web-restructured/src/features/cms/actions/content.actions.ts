"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/shared/db/db";
import { can, type Permission } from "@/features/staff/domain/rbac";
import { actorOf, currentStaff } from "@/features/staff/server/staff.server";
import type { ActionResult } from "@/features/case-management/actions/case.actions";
import { emptyArticle } from "@/features/cms/domain/article";
import {
  approveAndPublish, CmsRule, createArticle, renameSlug, requestReview, restoreRevision, saveDraft, sendBack, unpublish,
} from "@/features/cms/server/articles.server";
import { createsLoop, redirectPathProblem } from "@/features/cms/server/redirects.server";

/**
 * CMS actions. Content Editors write and submit; Compliance or the master admin approve and publish (never their own draft).
 * Every action checks the permission on the server and is written to the Activity log.
 */
const str = (f: FormData, k: string, max = 300) => String(f.get(k) ?? "").trim().slice(0, max);
const fail = (message: string): ActionResult => ({ ok: false, message });

async function guard(...perms: Permission[]) {
  const user = await currentStaff();
  return user && perms.some((p) => can(user, p)) ? user : null;
}

async function run(id: string | null, fn: () => Promise<unknown>, message: string): Promise<ActionResult> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof CmsRule) return fail(e.message);
    throw e;
  }
  revalidatePath("/admin/content");
  if (id) revalidatePath(`/admin/content/${id}`);
  // Published guides show on the guides list, the home page and the sitemap.
  revalidatePath("/", "layout");
  return { ok: true, message };
}

export async function createGuide(_p: ActionResult, f: FormData): Promise<ActionResult> {
  const user = await guard("content.edit");
  if (!user) return fail("You don't have permission for this.");
  const title = str(f, "title", 120);
  const slug = str(f, "slug", 80).toLowerCase();
  if (title.length < 5) return fail("Give the guide a title.");
  let id = "";
  const r = await run(null, async () => {
    id = (await createArticle(slug, emptyArticle(title), actorOf(user))).id;
  }, "Created.");
  if (!r?.ok) return r;
  redirect(`/admin/content/${id}`);
}

/** Called by the editor with the whole draft as JSON. */
export async function saveGuideDraft(id: string, json: string, note: string): Promise<ActionResult> {
  const user = await guard("content.edit");
  if (!user) return fail("You don't have permission for this.");
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return fail("The editor sent something unreadable. Reload and try again.");
  }
  return run(id, () => saveDraft(id, raw, note.trim().slice(0, 200) || null, actorOf(user)), "Draft saved. The live guide hasn't changed.");
}

export async function guideWorkflow(_p: ActionResult, f: FormData): Promise<ActionResult> {
  const id = str(f, "id", 40);
  const decision = str(f, "decision", 30);
  const article = await prisma.article.findUnique({ where: { id } });
  if (!article) return fail("Guide not found.");

  if (decision === "submit" || decision === "restore" || (decision === "rename" && !article.liveRevisionId)) {
    const user = await guard("content.edit");
    if (!user) return fail("You don't have permission for this.");
    if (decision === "submit") return run(id, () => requestReview(id, actorOf(user)), "Sent for approval.");
    if (decision === "restore") return run(id, () => restoreRevision(id, str(f, "revisionId", 40), actorOf(user)), "Restored as a new draft. Send it for approval to make it live.");
    return run(id, () => renameSlug(id, str(f, "slug", 80).toLowerCase(), actorOf(user)), "Address changed.");
  }

  // Everything that changes what the public sees needs the publish permission.
  const user = await guard("content.publish");
  if (!user) return fail("Only Compliance or the master admin can approve, publish or unpublish.");
  switch (decision) {
    case "publish": {
      const when = str(f, "publishAt", 20);
      const at = when ? new Date(`${when}+05:30`) : null;
      if (at && Number.isNaN(at.getTime())) return fail("Pick a valid date and time.");
      return run(id, () => approveAndPublish(id, actorOf(user), at && at > new Date() ? at : null), at && at > new Date() ? "Approved. It goes live at the scheduled time." : "Approved and published.");
    }
    case "sendBack":
      return run(id, () => sendBack(id, actorOf(user), str(f, "reason", 400)), "Sent back to the author.");
    case "unpublish":
      return run(id, () => unpublish(id, actorOf(user)), "Taken off the public site.");
    case "rename":
      return run(id, () => renameSlug(id, str(f, "slug", 80).toLowerCase(), actorOf(user)), "Address changed. The old address now redirects to the new one.");
    default:
      return fail("Unknown action.");
  }
}

// ---------- Redirects ----------

export async function addRedirect(_p: ActionResult, f: FormData): Promise<ActionResult> {
  const user = await guard("site.manage");
  if (!user) return fail("Only the master admin can manage redirects.");
  const from = str(f, "from", 200).toLowerCase().replace(/\/+$/, "") || "/";
  const to = str(f, "to", 200).toLowerCase();
  const problem = redirectPathProblem(from, "from") ?? redirectPathProblem(to, "to");
  if (problem) return fail(problem);
  if (await prisma.redirect.findUnique({ where: { fromPath: from } })) return fail("That old address already redirects somewhere. Delete it first.");
  if (await createsLoop(from, to)) return fail("That would create a redirect loop.");
  await prisma.$transaction([
    prisma.redirect.create({ data: { fromPath: from, toPath: to, permanent: f.get("temporary") !== "on", createdBy: actorOf(user) } }),
    prisma.adminEvent.create({ data: { type: "REDIRECT_ADDED", actor: actorOf(user), target: from, detail: JSON.stringify({ to }) } }),
  ]);
  revalidatePath("/admin/redirects");
  return { ok: true, message: `${from} now redirects to ${to}.` };
}

export async function deleteRedirect(_p: ActionResult, f: FormData): Promise<ActionResult> {
  const user = await guard("site.manage");
  if (!user) return fail("Only the master admin can manage redirects.");
  const r = await prisma.redirect.findUnique({ where: { id: str(f, "id", 40) } });
  if (!r) return fail("Redirect not found.");
  await prisma.$transaction([
    prisma.redirect.delete({ where: { id: r.id } }),
    prisma.adminEvent.create({ data: { type: "REDIRECT_DELETED", actor: actorOf(user), target: r.fromPath, detail: JSON.stringify({ to: r.toPath }) } }),
  ]);
  revalidatePath("/admin/redirects");
  return { ok: true, message: "Deleted." };
}

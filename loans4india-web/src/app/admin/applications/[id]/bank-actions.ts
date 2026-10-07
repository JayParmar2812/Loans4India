"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { newUploadToken } from "@/lib/uploadToken.server";
import { SHARE_LINK_HOURS, SHARE_LINK_MAX_DOWNLOADS } from "@/lib/bankPackage";
import { publicBaseUrl, currentStaff, actorOf } from "@/lib/staff.server";
import { can, canSeeCase, holdsPortal } from "@/lib/rbac";
import { BANK_SHARE_LINKS_ENABLED } from "@/config/banks";

export type ShareLinkState = { ok: boolean; url?: string; expiresAt?: string; error?: string } | null;

/**
 * The older "share link for a bank sales officer" channel. Platform Flow v4 sends documents to a bank only through
 * the operator's portal entry, so this is off (BANK_SHARE_LINKS_ENABLED). If it is ever switched on, a link can only
 * carry an approved package, to the attempt's own bank, created by an operator who holds that bank's login.
 */
export async function createShareLink(_prev: ShareLinkState, formData: FormData): Promise<ShareLinkState> {
  if (!BANK_SHARE_LINKS_ENABLED) return { ok: false, error: "Share links are switched off. Submit through the bank portal." };
  const user = await currentStaff();
  if (!user || !can(user, "portal.submit")) return { ok: false, error: "You don't have permission for this." };
  const id = String(formData.get("id"));
  const contactName = String(formData.get("contactName") ?? "").trim().slice(0, 80) || null;
  const app = await prisma.loanApplication.findUnique({ where: { id }, include: { attempts: true } });
  if (!app || !canSeeCase(user, app, app.attempts.map((a) => a.bankId))) return { ok: false, error: "Application not found." };
  const att = app.attempts.find((a) => a.state === "READY_TO_SUBMIT");
  if (app.stage !== "READY_FOR_BANK" || !att?.manifest || !holdsPortal(user, att.bankId)) return { ok: false, error: "Only an approved package can be shared, by its bank's operator." };
  const docIds = (JSON.parse(att.manifest) as { documents: { id: string }[] }).documents.map((d) => d.id);
  const { token, hash } = newUploadToken();
  const expiresAt = new Date(Date.now() + SHARE_LINK_HOURS * 3600e3);
  const actor = actorOf(user);
  await prisma.$transaction([
    prisma.bankShare.create({
      data: {
        applicationId: id, bankName: att.bankName, channel: "BANK_SALES_OFFICER", contactName, documentIds: JSON.stringify(docIds),
        linkTokenHash: hash, linkExpiresAt: expiresAt, maxDownloads: SHARE_LINK_MAX_DOWNLOADS, sharedBy: actor,
      },
    }),
    prisma.applicationEvent.create({
      data: { applicationId: id, type: "BANK_LINK_CREATED", actor, detail: JSON.stringify({ bank: att.bankName, contact: contactName, files: docIds.length, expiresAt }) },
    }),
  ]);
  revalidatePath(`/admin/applications/${id}`);
  return { ok: true, url: `${await publicBaseUrl()}/share/${token}`, expiresAt: expiresAt.toISOString() };
}

/** Switch off a link made before v4. Always allowed for staff who can see the case. */
export async function revokeShare(formData: FormData) {
  const user = await currentStaff();
  const shareId = String(formData.get("shareId"));
  const share = await prisma.bankShare.findUnique({ where: { id: shareId }, include: { application: { include: { attempts: true } } } });
  if (!user || !share || share.revokedAt || !share.linkTokenHash) return;
  if (!canSeeCase(user, share.application, share.application.attempts.map((a) => a.bankId))) return;
  await prisma.$transaction([
    prisma.bankShare.update({ where: { id: shareId }, data: { revokedAt: new Date() } }),
    prisma.applicationEvent.create({ data: { applicationId: share.applicationId, type: "BANK_LINK_REVOKED", actor: actorOf(user), detail: JSON.stringify({ bank: share.bankName }) } }),
  ]);
  revalidatePath(`/admin/applications/${share.applicationId}`);
}

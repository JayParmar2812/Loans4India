import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { applicantApp } from "@/lib/applicant.server";
import { portalState, uploadableSlots } from "@/lib/portal.server";
import { deleteStored } from "@/lib/storage.server";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

/** Applicant removes a file they uploaded by mistake (only unreviewed files, only in slots they may still change). */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ token: string; docId: string }> }) {
  const { token, docId } = await params;
  const app = await applicantApp(token);
  if (!app || app.stage === "CLOSED") return NextResponse.json({ ok: false, error: "This link has expired or is not valid." }, { status: 404, headers: noStore });
  const doc = app.documents.find((d) => d.id === docId);
  if (!doc) return NextResponse.json({ ok: false, error: "File not found." }, { status: 404, headers: noStore });
  const unlocked = uploadableSlots(app, app.tasks);
  const inSnapshot = await prisma.applicationSnapshot.count({ where: { applicationId: app.id, data: { contains: doc.id } } });
  if (doc.status !== "UPLOADED" || inSnapshot > 0 || (unlocked !== "all" && !unlocked.has(doc.slot))) {
    return NextResponse.json({ ok: false, error: "This file is already with our team and can't be removed here." }, { status: 409, headers: noStore });
  }
  await prisma.$transaction([
    prisma.applicationDocument.update({ where: { id: doc.id }, data: { status: "REMOVED" } }),
    prisma.applicationEvent.create({ data: { applicationId: app.id, type: "DOCUMENT_REMOVED", actor: "customer", detail: JSON.stringify({ slot: doc.slot, documentId: doc.id }) } }),
  ]);
  await deleteStored(doc.storageKey);
  const fresh = await applicantApp(token);
  return NextResponse.json({ ok: true, state: fresh ? portalState(fresh) : null }, { headers: noStore });
}

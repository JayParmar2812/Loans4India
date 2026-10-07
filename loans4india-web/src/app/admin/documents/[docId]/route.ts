import { prisma } from "@/lib/db";
import { readDecrypted } from "@/lib/storage.server";
import { canSeeCase } from "@/lib/rbac";
import { actorOf, currentStaff } from "@/lib/staff.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Staff-only: open one document inline, only for a case in the viewer's scope. Every view is logged with who opened it. */
export async function GET(_req: Request, { params }: { params: Promise<{ docId: string }> }) {
  const user = await currentStaff();
  const { docId } = await params;
  const doc = await prisma.applicationDocument.findUnique({ where: { id: docId }, include: { application: { include: { attempts: { select: { bankId: true } } } } } });
  if (!user || !doc || doc.status === "REMOVED") return new Response("Not found", { status: 404 });
  // Operators get documents only through the approved package; reviewers and owners open them here.
  if (user.role === "DSA_OPERATOR" || !canSeeCase(user, doc.application, doc.application.attempts.map((a) => a.bankId))) return new Response("Not found", { status: 404 });
  const data = await readDecrypted(doc.storageKey);
  await prisma.applicationEvent.create({
    data: { applicationId: doc.applicationId, type: "DOCUMENT_VIEWED", actor: actorOf(user), detail: JSON.stringify({ slot: doc.slot, documentId: doc.id }) },
  });
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `inline; filename="${doc.originalName.replace(/"/g, "")}"`,
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      "Referrer-Policy": "no-referrer",
    },
  });
}

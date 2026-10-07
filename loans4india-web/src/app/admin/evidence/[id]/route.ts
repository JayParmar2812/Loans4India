import { prisma } from "@/lib/db";
import { readDecrypted } from "@/lib/storage.server";
import { detectType } from "@/lib/filecheck.server";
import { canSeeCase } from "@/lib/rbac";
import { actorOf, currentStaff } from "@/lib/staff.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Staff-only: open the evidence behind a bank status (portal screenshot, bank email). Every view is logged. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentStaff();
  const { id } = await params;
  const row = await prisma.bankStatusEvent.findUnique({ where: { id }, include: { application: { include: { attempts: { select: { bankId: true } } } } } });
  if (!user || !row?.evidenceKey || !canSeeCase(user, row.application, row.application.attempts.map((a) => a.bankId))) return new Response("Not found", { status: 404 });
  const data = await readDecrypted(row.evidenceKey);
  const t = detectType(data);
  await prisma.applicationEvent.create({ data: { applicationId: row.applicationId, type: "EVIDENCE_VIEWED", actor: actorOf(user), detail: JSON.stringify({ status: row.status }) } });
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": t?.mime ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${(row.evidenceName ?? "evidence").replace(/"/g, "")}"`,
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      "Referrer-Policy": "no-referrer",
    },
  });
}

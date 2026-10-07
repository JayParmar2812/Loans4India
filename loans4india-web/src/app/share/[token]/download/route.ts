import { prisma } from "@/lib/db";
import { buildBankPackage, shareForToken } from "@/lib/bankPackage.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Bank sales officer downloads the package. Counts against the link's download limit and is logged. */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const share = await shareForToken(token);
  if (!share) return new Response("This link is no longer active.", { status: 410, headers: { "Cache-Control": "no-store" } });

  // Count first, atomically, so two quick taps can't exceed the limit.
  const counted = await prisma.bankShare.updateMany({
    where: { id: share.id, downloadCount: { lt: share.maxDownloads }, revokedAt: null },
    data: { downloadCount: { increment: 1 } },
  });
  if (counted.count === 0) return new Response("This link is no longer active.", { status: 410, headers: { "Cache-Control": "no-store" } });

  const pkg = await buildBankPackage(share.applicationId, JSON.parse(share.documentIds) as string[], share.bankName, share.sharedBy);
  await prisma.applicationEvent.create({
    data: {
      applicationId: share.applicationId,
      type: "BANK_LINK_DOWNLOADED",
      actor: `bank:${share.bankName}`,
      detail: JSON.stringify({ bank: share.bankName, ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null, userAgent: req.headers.get("user-agent")?.slice(0, 200) ?? null, download: share.downloadCount + 1 }),
    },
  });
  return new Response(new Uint8Array(pkg.zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${pkg.fileName}"`,
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

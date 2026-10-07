import { prisma } from "@/lib/db";
import { readDecrypted } from "@/lib/storage.server";

export const runtime = "nodejs";

/** Public images from the Website screen's library. The id never changes, so browsers may cache them for good. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const asset = /^[a-z0-9]{20,32}$/.test(id) ? await prisma.siteAsset.findUnique({ where: { id } }) : null;
  if (!asset || asset.deletedAt) return new Response("Not found", { status: 404 });
  const body = await readDecrypted(asset.storageKey);
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": asset.mime,
      "Content-Length": String(body.length),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}

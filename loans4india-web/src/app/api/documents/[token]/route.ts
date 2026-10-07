import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { applicantApp } from "@/lib/applicant.server";
import { portalState, uploadableSlots } from "@/lib/portal.server";
import { appFlow, checklistFor } from "@/config/applicantFlow";
import { checkFile, cleanName, scanFile } from "@/lib/filecheck.server";
import { saveEncrypted } from "@/lib/storage.server";
import { consentState } from "@/lib/consentState";

export const runtime = "nodejs";

const MAX_DOCS_PER_APPLICATION = 60;
const hits = new Map<string, number[]>();
function throttled(key: string) {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < 60 * 60 * 1000);
  list.push(now);
  hits.set(key, list);
  return list.length > 80; // uploads per hour per application
}

const noStore = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
const gone = () => NextResponse.json({ ok: false, error: "This link has expired or is not valid." }, { status: 404, headers: noStore });

/** The applicant's application: tracker, details, checklist, open tasks. Never returns file contents or staff notes. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const app = await applicantApp(token);
  if (!app) return gone();
  return NextResponse.json({ ok: true, state: portalState(app) }, { headers: noStore });
}

/** Upload one file into one slot (multipart: slot, file). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const app = await applicantApp(token);
  if (!app || app.stage === "CLOSED") return gone();
  if (!consentState(app.consents).valid) return NextResponse.json({ ok: false, error: "Please give consent before uploading documents." }, { status: 409, headers: noStore });
  if (throttled(app.id)) return NextResponse.json({ ok: false, error: "Too many uploads. Please try again in a while." }, { status: 429, headers: noStore });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Upload failed. Please try again." }, { status: 400, headers: noStore });
  }
  const slotId = String(form.get("slot") ?? "");
  const file = form.get("file");
  const slot = checklistFor(appFlow(app), app.employmentType).find((s) => s.id === slotId);
  if (!slot) return NextResponse.json({ ok: false, error: "Unknown document type." }, { status: 400, headers: noStore });
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "Please choose a file." }, { status: 400, headers: noStore });

  // After submission, only the slots named in an open Action needed task take new files (section 14).
  const unlocked = uploadableSlots(app, app.tasks);
  if (unlocked !== "all" && !unlocked.has(slotId)) {
    return NextResponse.json({ ok: false, error: "Your application is with our team. We'll ask if we need anything else." }, { status: 409, headers: noStore });
  }
  const liveCount = app.documents.filter((d) => d.slot === slotId && d.status !== "REJECTED").length;
  if (liveCount >= slot.maxFiles) {
    return NextResponse.json({ ok: false, error: `You can add up to ${slot.maxFiles} files here. Remove one to add another.` }, { status: 409, headers: noStore });
  }
  if (app.documents.length >= MAX_DOCS_PER_APPLICATION) {
    return NextResponse.json({ ok: false, error: "This application has too many files. Please contact support." }, { status: 409, headers: noStore });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const check = checkFile(buf);
  if (!check.ok) return NextResponse.json({ ok: false, error: check.error }, { status: 422, headers: noStore });

  const scan = await scanFile(buf);
  if (scan === "INFECTED") {
    await prisma.applicationEvent.create({ data: { applicationId: app.id, type: "DOCUMENT_BLOCKED", actor: "system", detail: JSON.stringify({ slot: slotId, reason: "malware" }) } });
    return NextResponse.json({ ok: false, error: "We couldn't accept this file. Please upload a fresh copy." }, { status: 422, headers: noStore });
  }
  if (scan === "UNAVAILABLE") {
    return NextResponse.json({ ok: false, error: "Uploads are paused for a moment. Please try again shortly." }, { status: 503, headers: noStore });
  }

  const sha256 = createHash("sha256").update(buf).digest("hex");
  if (app.documents.some((d) => d.sha256 === sha256 && d.slot === slotId)) {
    return NextResponse.json({ ok: false, error: "You've already uploaded this exact file here." }, { status: 409, headers: noStore });
  }

  let storageKey: string;
  try {
    storageKey = await saveEncrypted(buf);
  } catch (err) {
    console.error("Document storage failed", err);
    return NextResponse.json({ ok: false, error: "Uploads are paused for a moment. Please try again shortly." }, { status: 503, headers: noStore });
  }
  const doc = await prisma.$transaction(async (tx) => {
    const d = await tx.applicationDocument.create({
      data: { applicationId: app.id, slot: slotId, originalName: cleanName(file.name, check.type.ext), mimeType: check.type.mime, sizeBytes: buf.length, sha256, storageKey, scanResult: scan },
    });
    await tx.applicationEvent.create({ data: { applicationId: app.id, type: "DOCUMENT_UPLOADED", actor: "customer", detail: JSON.stringify({ slot: slotId, documentId: d.id, scan }) } });
    return d;
  });

  const fresh = await applicantApp(token);
  return NextResponse.json({ ok: true, documentId: doc.id, state: fresh ? portalState(fresh) : null }, { status: 201, headers: noStore });
}

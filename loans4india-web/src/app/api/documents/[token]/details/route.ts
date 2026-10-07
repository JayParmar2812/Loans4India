import { NextResponse, type NextRequest } from "next/server";
import { applicantApp } from "@/lib/applicant.server";
import { editableSections, saveDetails } from "@/lib/details.server";
import { portalState } from "@/lib/portal.server";
import { consentState } from "@/lib/consentState";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

/** Autosave: the form sends one field (or a few) when the applicant leaves it. Validated again here. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const app = await applicantApp(token);
  if (!app || app.stage === "CLOSED") return NextResponse.json({ ok: false, error: "This link has expired or is not valid." }, { status: 404, headers: noStore });
  if (!consentState(app.consents).valid) return NextResponse.json({ ok: false, error: "Please give consent before filling in your details." }, { status: 409, headers: noStore });
  const body = (await req.json().catch(() => null)) as { fields?: Record<string, unknown> } | null;
  if (!body?.fields || typeof body.fields !== "object" || Object.keys(body.fields).length > 40) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400, headers: noStore });
  }
  const result = await saveDetails(app.id, body.fields, "customer", editableSections(app, app.tasks));
  if (!result) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404, headers: noStore });
  const fresh = await applicantApp(token);
  return NextResponse.json({ ok: true, saved: result.saved, errors: result.errors, state: fresh ? portalState(fresh) : null }, { headers: noStore });
}

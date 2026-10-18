import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/shared/db/db";
import { brand } from "@/shared/config/brand";
import { decryptField, encryptField } from "@/shared/security/fieldCrypto.server";
import { newTotpSecret, otpauthUrl } from "@/shared/security/totp";
import { MfaForm } from "@/features/staff/components/AuthForms";
import { readStaffSession } from "@/features/staff/server/staffSession.server";
import { safeNext } from "@/features/staff/domain/safeNext";

export const metadata = { title: "Two-step check" };

export default async function MfaPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  const s = await readStaffSession();
  if (s.kind === "ok") redirect(next);
  if (s.kind !== "mfa") redirect("/admin/login");

  if (s.enrolled) {
    return (
      <>
        <h1 className="text-2xl font-extrabold">Two-step check</h1>
        <p className="text-sm text-muted mt-1 mb-6">Open your authenticator app and enter the current code for {brand.name}.</p>
        <MfaForm next={next} enrolling={false} />
      </>
    );
  }

  // First sign-in (or after a reset): give this person a secret to add to their authenticator app.
  // The secret is stored encrypted and only becomes active once a code from it is confirmed.
  const acc = await prisma.staffAccount.findUniqueOrThrow({ where: { username: s.username } });
  let secret = acc.mfaSecretEnc ? decryptField(acc.mfaSecretEnc) : null;
  if (!secret) {
    secret = newTotpSecret();
    await prisma.staffAccount.update({ where: { username: s.username }, data: { mfaSecretEnc: encryptField(secret) } });
  }
  const url = otpauthUrl(secret, s.username, brand.name);
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#14122b", light: "#ffffff" } });
  return (
    <>
      <h1 className="text-2xl font-extrabold">Set up two-step sign-in</h1>
      <p className="text-sm text-muted mt-1">Every staff login needs it. Use Google Authenticator, Microsoft Authenticator or any TOTP app.</p>
      <ol className="mt-5 space-y-4 text-sm">
        <li>
          <b>1. Scan this code</b> in the app.
          {/* Our own QR SVG (generated above from our own URL), not user content. */}
          <div className="mt-2 mx-auto w-44 rounded-xl border border-line p-2 bg-white" dangerouslySetInnerHTML={{ __html: svg }} aria-label="QR code for your authenticator app" role="img" />
          <details className="mt-2 text-xs text-muted">
            <summary className="cursor-pointer">Can&apos;t scan? Enter this key instead</summary>
            <code className="block mt-1 break-all rounded-lg bg-canvas border border-line p-2 font-mono text-ink">{secret.match(/.{1,4}/g)?.join(" ")}</code>
          </details>
        </li>
        <li><b>2. Enter the 6-digit code</b> the app shows.</li>
      </ol>
      <div className="mt-4"><MfaForm next={next} enrolling /></div>
    </>
  );
}

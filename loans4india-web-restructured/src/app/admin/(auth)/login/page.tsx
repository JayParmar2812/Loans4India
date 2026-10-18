import { redirect } from "next/navigation";
import { SignInForm } from "@/features/staff/components/AuthForms";
import { readStaffSession } from "@/features/staff/server/staffSession.server";
import { safeNext } from "@/features/staff/domain/safeNext";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const s = await readStaffSession();
  if (s.kind === "ok") redirect(safeNext(next));
  if (s.kind === "mfa") redirect("/admin/mfa");
  return (
    <>
      <h1 className="text-2xl font-extrabold">Staff sign-in</h1>
      <p className="text-sm text-muted mt-1 mb-6">Then confirm with the code from your authenticator app.</p>
      <SignInForm next={safeNext(next)} notice={error === "mfa" ? "Too many wrong codes. Sign in again." : undefined} />
    </>
  );
}

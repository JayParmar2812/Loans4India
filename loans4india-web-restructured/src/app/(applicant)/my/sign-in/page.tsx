import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { OtpSignIn } from "@/features/applicant-auth/components/OtpSignIn";
import { applicantMobile } from "@/features/applicant-auth/server/applicantSession.server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in to your application", robots: { index: false, follow: false } };

export default async function SignInPage() {
  if (await applicantMobile()) redirect("/my");
  return (
    <div className="hero-wash">
      <div className="mx-auto max-w-md px-4 py-12 sm:py-16">
        <h1 className="text-3xl font-extrabold">Sign in to your application</h1>
        <p className="text-muted mt-2 mb-6">Use the mobile number you applied with. We&apos;ll send a one-time code. No password needed.</p>
        <div className="card p-6"><OtpSignIn /></div>
        <p className="text-sm text-muted mt-6">New here? <Link href="/apply" className="text-violet underline underline-offset-4">Start your application</Link>.</p>
      </div>
    </div>
  );
}

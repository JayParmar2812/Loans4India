import Link from "next/link";
import { PageHero } from "@/features/public-site/components/PageHero";
import { ContactForm } from "@/features/support/components/ContactForm";
import { applicantMobile } from "@/features/applicant-auth/server/applicantSession.server";
import { brand } from "@/shared/config/brand";
import { pageMetadata } from "@/shared/seo/metadata";
import { Icon } from "@/shared/ui/Icon";

export const dynamic = "force-dynamic";
export const metadata = pageMetadata({
  title: "Contact & support",
  description: `Questions, complaints and data requests for ${brand.name}. Get a ticket number and a response time.`,
  path: "/contact",
});

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  const mobile = await applicantMobile();
  return (
    <>
      <PageHero crumbs={[{ label: "Contact", href: "/contact" }]} eyebrow="We're here to help" title="Contact & support" intro="Ask a question, raise a complaint or make a request about your data. Every request gets a ticket number and a response time." />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:py-12 grid gap-8 lg:grid-cols-[1.6fr_1fr] items-start">
        <ContactForm initialType={type} signedInMobile={mobile} />
        <aside className="space-y-4">
          <div className="card p-5 space-y-3 text-sm">
            <h2 className="font-bold text-base">Other ways to reach us</h2>
            <p className="flex gap-2"><Icon name="mail" className="size-5 text-mint-deep shrink-0" /><a className="text-violet underline" href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}</a></p>
            <p className="flex gap-2"><Icon name="clock" className="size-5 text-mint-deep shrink-0" />{brand.supportHours}</p>
          </div>
          <div className="card p-5 space-y-2 text-sm">
            <h2 className="font-bold text-base">Track your application</h2>
            <p className="text-muted">The fastest way to see where your application is: <Link href="/my" className="text-violet underline">sign in with your mobile</Link>.</p>
          </div>
          <div className="rounded-2xl border border-warn/30 bg-warn-soft p-5 text-sm text-warn space-y-1">
            <p className="font-bold">Stay safe</p>
            <p>We never ask for money, an OTP, a PIN or your passwords. If someone does in our name, don&apos;t pay. Tell us here.</p>
          </div>
          <p className="text-sm text-muted">Not resolved? See <Link href="/grievance" className="text-violet underline">how complaints are escalated</Link>.</p>
        </aside>
      </div>
    </>
  );
}

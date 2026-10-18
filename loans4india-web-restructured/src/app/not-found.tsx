import Link from "next/link";
import { PublicChrome } from "@/features/public-site/components/PublicChrome";

export const metadata = { title: "Page not found", robots: { index: false } };

export default function NotFound() {
  return (
    <PublicChrome>
      <div className="mx-auto max-w-xl px-4 py-20 sm:py-28 text-center space-y-5">
        <p className="eyebrow">Error 404</p>
        <h1 className="text-4xl sm:text-5xl font-extrabold">We couldn&apos;t find that page</h1>
        <p className="text-muted">The page may have moved, or the address has a typo. These might help:</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/" className="btn-primary">Go to the homepage</Link>
          <Link href="/calculators" className="btn-ghost">Loan calculators</Link>
          <Link href="/my" className="btn-ghost">Sign in to your application</Link>
        </div>
      </div>
    </PublicChrome>
  );
}

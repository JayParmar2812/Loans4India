"use client";
import Link from "next/link";
import { useEffect } from "react";

/**
 * Generic error page. Never shows the error message or stack (they can hold internal detail);
 * the digest lets support find the matching server log line.
 */
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center space-y-5">
      <p className="eyebrow">Something went wrong</p>
      <h1 className="text-3xl sm:text-4xl font-extrabold">Sorry, that didn&apos;t work</h1>
      <p className="text-muted">Nothing you entered is lost. Please try again. If it keeps happening, contact support{error.digest ? " and quote this code" : ""}.</p>
      {error.digest && <p className="font-mono text-sm bg-canvas border border-line rounded-lg inline-block px-3 py-1">{error.digest}</p>}
      <div className="flex flex-wrap justify-center gap-3">
        <button className="btn-primary" onClick={() => retry()}>Try again</button>
        <Link href="/" className="btn-ghost">Homepage</Link>
      </div>
    </div>
  );
}

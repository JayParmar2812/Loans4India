import Link from "next/link";
import type { SiteContent } from "@/config/siteContent";

/** Announcement strip above the header, set by the master admin on the Website screen. */
export function SiteBanner({ banner }: { banner: SiteContent["banner"] }) {
  return (
    <div className="bg-mint text-mint-ink text-sm">
      <p className="mx-auto max-w-6xl px-4 py-2 text-center">
        {banner.text}
        {banner.linkHref && banner.linkLabel && (
          <>
            {" "}
            <Link href={banner.linkHref} className="font-semibold underline underline-offset-2">{banner.linkLabel}</Link>
          </>
        )}
      </p>
    </div>
  );
}

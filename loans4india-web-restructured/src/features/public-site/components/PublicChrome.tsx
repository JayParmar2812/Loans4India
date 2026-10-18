import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { AttributionTracker } from "./AttributionTracker";
import { SiteBanner } from "@/features/site-control/components/SiteBanner";
import { getSiteContent } from "@/features/site-control/server/siteContent.server";
import { linkIsLive } from "@/features/site-control/config/siteContent";

/** Header, optional banner and footer for every public and applicant page. Staff pages use their own shell. */
export async function PublicChrome({ children }: { children: React.ReactNode }) {
  const site = await getSiteContent();
  const nav = site.nav.filter((l) => linkIsLive(l.href, site));
  const columns = site.footer.columns.map((c) => ({ ...c, links: c.links.filter((l) => linkIsLive(l.href, site)) })).filter((c) => c.links.length > 0);
  return (
    <>
      <AttributionTracker />
      {site.banner.show && site.banner.text && <SiteBanner banner={site.banner} />}
      <SiteHeader nav={nav} />
      <main id="main" className="flex-1">{children}</main>
      <SiteFooter columns={columns} />
    </>
  );
}

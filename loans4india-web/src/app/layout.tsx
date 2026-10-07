import type { Metadata, Viewport } from "next";
import "@fontsource/baloo-2/600.css";
import "@fontsource/baloo-2/700.css";
import "@fontsource/baloo-2/800.css";
import "@fontsource/mukta/400.css";
import "@fontsource/mukta/500.css";
import "@fontsource/mukta/600.css";
import "@fontsource/mukta/700.css";
import "./globals.css";
import { brand } from "@/config/brand";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { AttributionTracker } from "@/components/AttributionTracker";
import { SiteBanner } from "@/components/SiteBanner";
import { getSiteContent } from "@/lib/siteContent.server";
import { DEFAULT_SITE_CONTENT, linkIsLive, type SiteTheme } from "@/config/siteContent";

/** CSS variables for the Look set on the Website screen; nothing when it matches globals.css. Values are validated #rrggbb. */
function themeCss(t: SiteTheme): string | null {
  const d = DEFAULT_SITE_CONTENT.theme;
  const v: string[] = [];
  if (t.main !== d.main) v.push(`--violet:${t.main}`);
  if (t.dark !== d.dark) v.push(`--violet-deep:${t.dark}`);
  if (t.light !== d.light) v.push(`--violet-soft:${t.light}`);
  if (t.accent !== d.accent) v.push(`--mint:${t.accent}`);
  if (t.headingFont === "Mukta") v.push(`--heading-font:"Mukta",system-ui,sans-serif`);
  // html:root outranks globals.css whatever order the styles load in.
  return v.length ? `html:root{${v.join(";")}}` : null;
}

export const metadata: Metadata = {
  metadataBase: new URL(`https://${brand.domain}`),
  title: {
    default: `${brand.name} — Personal & business loans from the right bank`,
    template: `%s | ${brand.name}`,
  },
  description:
    "Apply once and we submit your application to a suitable partner bank or NBFC. Free EMI calculator and quick loan estimate. LoansForIndia is a loan sourcing service, not a lender.",
  openGraph: { siteName: brand.name, locale: "en_IN", type: "website" },
};

export async function generateViewport(): Promise<Viewport> {
  return { themeColor: (await getSiteContent()).theme.main };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const site = await getSiteContent();
  const nav = site.nav.filter((l) => linkIsLive(l.href, site));
  const css = themeCss(site.theme);
  const columns = site.footer.columns.map((c) => ({ ...c, links: c.links.filter((l) => linkIsLive(l.href, site)) })).filter((c) => c.links.length > 0);
  return (
    <html lang="en-IN">
      <body className="min-h-dvh flex flex-col">
        {css && <style href="site-theme" precedence="high">{css}</style>}
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:px-3 focus:py-2">
          Skip to content
        </a>
        <AttributionTracker />
        {site.banner.show && site.banner.text && <SiteBanner banner={site.banner} />}
        <SiteHeader nav={nav} wordmark={site.theme.logo} />
        <main id="main" className="flex-1">{children}</main>
        <SiteFooter columns={columns} wordmark={site.theme.logo} />
      </body>
    </html>
  );
}

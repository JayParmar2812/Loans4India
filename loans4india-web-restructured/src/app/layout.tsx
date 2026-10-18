import type { Metadata, Viewport } from "next";
import "@fontsource-variable/plus-jakarta-sans/wght.css";
import "@fontsource/baloo-2/700.css";
import "@fontsource/baloo-2/800.css";
import "@fontsource/mukta/400.css";
import "@fontsource/mukta/600.css";
import "./globals.css";
import { brand } from "@/shared/config/brand";
import { getSiteContent } from "@/features/site-control/server/siteContent.server";
import { DEFAULT_SITE_CONTENT, type SiteTheme } from "@/features/site-control/config/siteContent";

/** CSS variables for the Look set on the Website screen; nothing when it matches globals.css. Values are validated #rrggbb. */
function themeCss(t: SiteTheme): string | null {
  const d = DEFAULT_SITE_CONTENT.theme;
  const v: string[] = [];
  if (t.main !== d.main) v.push(`--violet:${t.main}`);
  if (t.dark !== d.dark) v.push(`--violet-deep:${t.dark}`);
  if (t.light !== d.light) v.push(`--violet-soft:${t.light}`);
  if (t.accent !== d.accent) v.push(`--mint:${t.accent}`);
  if (t.headingFont === "Mukta") v.push(`--heading-font:"Mukta",system-ui,sans-serif`);
  if (t.headingFont === "Baloo 2") v.push(`--heading-font:"Baloo 2","Mukta",system-ui,sans-serif`);
  // html:root outranks globals.css whatever order the styles load in.
  return v.length ? `html:root{${v.join(";")}}` : null;
}

export const metadata: Metadata = {
  metadataBase: new URL(brand.siteUrl),
  title: {
    default: `${brand.name} | Personal & business loans through the right bank`,
    template: `%s | ${brand.name}`,
  },
  description:
    "Apply once and we prepare your application and submit it to a suitable partner bank or NBFC. Free for borrowers. Loans4India is a loan sourcing service, not a lender.",
  applicationName: brand.name,
  openGraph: { siteName: brand.name, locale: "en_IN", type: "website" },
  twitter: { card: "summary_large_image" },
  formatDetection: { telephone: false },
};

export async function generateViewport(): Promise<Viewport> {
  return { themeColor: "#ffffff", width: "device-width", initialScale: 1 };
}

/** Root: document shell and theme only. The public header/footer live in PublicChrome; staff pages have their own shell. */
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const site = await getSiteContent();
  const css = themeCss(site.theme);
  return (
    <html lang="en-IN">
      <body className="min-h-dvh flex flex-col">
        {css && <style href="site-theme" precedence="high">{css}</style>}
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:px-3 focus:py-2 focus:rounded-lg">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}

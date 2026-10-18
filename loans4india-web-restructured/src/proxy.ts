import { NextResponse, type NextRequest } from "next/server";

/**
 * Runs before every page and API route (Platform Flow v4, section 44, "Edge" and "Application" layers):
 * 1. A per-request nonce Content-Security-Policy plus the standard security headers.
 * 2. A cheap gate on the staff area and the applicant dashboard: no session cookie, straight to sign-in.
 *    This is only a convenience. Every page, action and route checks the session in the database again.
 */
const STAFF_COOKIES = ["__Host-l4i_staff", "l4i_staff"];
const APPLICANT_COOKIES = ["__Host-l4i_applicant", "l4i_applicant"];

function csp(nonce: string, dev: boolean, https: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // React style attributes and the theme <style> tag need inline styles; scripts stay nonce-only.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${dev ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "manifest-src 'self'",
    ...(https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const dev = process.env.NODE_ENV !== "production";

  const has = (names: string[]) => names.some((n) => req.cookies.get(n)?.value);
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login") && !pathname.startsWith("/admin/mfa") && !has(STAFF_COOKIES)) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = pathname === "/admin" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith("/my") && !pathname.startsWith("/my/sign-in") && !has(APPLICANT_COOKIES)) {
    const url = req.nextUrl.clone();
    url.pathname = "/my/sign-in";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  // Behind a TLS-terminating proxy the scheme arrives in X-Forwarded-Proto.
  const https = req.nextUrl.protocol === "https:" || (process.env.TRUST_PROXY === "1" && req.headers.get("x-forwarded-proto") === "https");
  const policy = csp(nonce, dev, https);
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", policy);
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()");
  res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  if (https && !dev) res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  // Private areas are never cached by shared caches or indexed.
  if (/^\/(admin|my|documents|share|api)(\/|$)/.test(pathname)) {
    res.headers.set("Cache-Control", "no-store, private");
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return res;
}

export const config = {
  matcher: [
    {
      // Everything except Next's static assets, the logo/brand files and metadata images.
      source: "/((?!_next/static|_next/image|brand/|favicon.ico|icon|apple-icon|opengraph-image).*)",
      missing: [{ type: "header", key: "next-router-prefetch" }],
    },
  ],
};

/**
 * The "current request" seen by next/headers under test. Each test sets the browser it is acting as:
 * its cookies (session tokens) and headers (IP, origin).
 */
export const requestContext = {
  headers: new Headers({ host: "localhost:3000", "x-forwarded-for": "203.0.113.10" }),
  cookies: new Map<string, string>(),
};

/** Start acting as a fresh browser (no cookies) from the given IP. */
export function newBrowser(ip = "203.0.113.10") {
  requestContext.cookies = new Map();
  requestContext.headers = new Headers({ host: "localhost:3000", "x-forwarded-for": ip });
  return requestContext;
}

/** Snapshot and restore a browser's cookies, to switch between two people in one test. */
export const saveBrowser = () => new Map(requestContext.cookies);
export const useBrowser = (cookies: Map<string, string>) => {
  requestContext.cookies = new Map(cookies);
};

/** A NextRequest-like Request with this browser's headers and cookies. */
export function req(url: string, init: { method?: string; json?: unknown; body?: BodyInit; headers?: Record<string, string> } = {}) {
  const h = new Headers(requestContext.headers);
  if (requestContext.cookies.size) h.set("cookie", [...requestContext.cookies].map(([k, v]) => `${k}=${v}`).join("; "));
  if (init.json !== undefined) h.set("content-type", "application/json");
  for (const [k, v] of Object.entries(init.headers ?? {})) h.set(k, v);
  return new Request(`http://localhost:3000${url}`, {
    method: init.method ?? (init.json !== undefined || init.body ? "POST" : "GET"),
    headers: h,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  });
}

/** Route handler `params` argument. */
export const params = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });

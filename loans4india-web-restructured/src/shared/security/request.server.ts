import "server-only";
import { createHash, randomBytes } from "node:crypto";

/**
 * Client IP for throttling and consent evidence. X-Forwarded-For is set by any client, so it is honoured only
 * when the app sits behind a proxy we control (TRUST_PROXY=1); then the right-most hop added by that proxy is used.
 */
export function clientIp(headers: Headers): string {
  if (process.env.TRUST_PROXY === "1") {
    const xff = headers.get("x-forwarded-for");
    if (xff) {
      const hops = xff.split(",").map((s) => s.trim()).filter(Boolean);
      const ip = hops[hops.length - 1];
      if (ip) return ip.slice(0, 64);
    }
    const real = headers.get("x-real-ip");
    if (real) return real.trim().slice(0, 64);
  }
  return "unknown";
}

export const userAgentOf = (headers: Headers) => headers.get("user-agent")?.slice(0, 300) ?? null;

/**
 * CSRF defence in depth for cookie-authenticated POST/PATCH/DELETE routes (SameSite cookies are the first line):
 * a browser always sends Origin on these; it must be this site.
 */
export function sameOrigin(headers: Headers): boolean {
  const origin = headers.get("origin");
  if (!origin) return true; // non-browser clients; cookies still required
  try {
    const host = headers.get("x-forwarded-host") ?? headers.get("host");
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

// ---------- Rate limiting ----------
// In-memory sliding window, per process. Enough for a single server (MVP1).
// Several instances need a shared store (e.g. Redis) behind the same function.
const buckets = new Map<string, number[]>();
let sweeps = 0;

/** Record one hit and say whether the caller is over the limit. */
export function rateLimited(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const list = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  list.push(now);
  buckets.set(key, list);
  if (++sweeps % 500 === 0) {
    for (const [k, v] of buckets) if (v.every((t) => now - t >= 3600e3)) buckets.delete(k);
  }
  return list.length > limit;
}

/** Test helper: forget every bucket. */
export const resetRateLimits = () => buckets.clear();

// ---------- Opaque tokens ----------

/** A random bearer token (cookie or link) and the SHA-256 hash we store instead of it. */
export function newOpaqueToken(bytes = 32) {
  const token = randomBytes(bytes).toString("base64url");
  return { token, hash: sha256(token) };
}
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Short id for correlating a generic error message with the server log. */
export const correlationId = () => randomBytes(6).toString("hex");

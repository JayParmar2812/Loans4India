import "server-only";
import { headers } from "next/headers";
import type { StaffUser } from "./rbac";
import { staffDirectory, verifyBasic } from "./staffAuth";

export { staffDirectory, verifyBasic };

/** The signed-in staff member, re-verified on every call (never trust a header we didn't check). */
export async function currentStaff(): Promise<StaffUser | null> {
  return verifyBasic((await headers()).get("authorization"));
}

/** Audit actor string, e.g. "staff:ravi". */
export async function staffActor(): Promise<string> {
  const u = await currentStaff();
  return u ? `staff:${u.username}` : "staff";
}

export const actorOf = (u: StaffUser) => `staff:${u.username}`;

/** Staff who can own cases, for the assignment picker. */
export async function assignableStaff(): Promise<StaffUser[]> {
  return (await staffDirectory())
    .filter((s) => s.role === "OPS_EXECUTIVE" || s.role === "OPS_MANAGER" || s.role === "DOCUMENT_REVIEWER" || s.role === "SUPER_ADMIN")
    .map(({ username, role, name, banks }) => ({ username, role, name, banks }));
}

/** Public base URL for links we send out (set PUBLIC_BASE_URL in production). */
export async function publicBaseUrl(): Promise<string> {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

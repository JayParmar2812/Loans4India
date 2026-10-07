import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { prisma } from "./db";
import { isRole, type StaffUser } from "./rbac";

export type StaffEntry = StaffUser & { source: "env" | "db"; active: boolean; password?: string; passwordHash?: string };

/** Shortest password the Staff screen accepts (and production accepts in STAFF_USERS). */
export const MIN_PASSWORD = 12;

/**
 * Staff logins from .env (temporary, until staff accounts with MFA replace HTTP Basic auth).
 * STAFF_USERS is a JSON list: [{"username":"jp","name":"JP","role":"SUPER_ADMIN","password":"...","banks":["demo-bank-a"]}].
 * "banks" is the operator–bank register: which banks a DSA Operator holds a portal login for.
 * Without STAFF_USERS, the old ADMIN_USER / ADMIN_PASSWORD login works as a single Ops Manager.
 */
export function envStaff(): StaffEntry[] {
  const raw = process.env.STAFF_USERS;
  if (raw) {
    try {
      const list = JSON.parse(raw) as Partial<StaffEntry>[];
      return list
        .filter((u) => u.username && u.password && u.role && isRole(u.role))
        .map((u) => ({ username: u.username!, password: u.password!, role: u.role!, name: u.name || u.username!, banks: Array.isArray(u.banks) ? u.banks : [], source: "env" as const, active: true }));
    } catch {
      console.error("STAFF_USERS is not valid JSON; no .env staff can log in.");
      return [];
    }
  }
  if (process.env.ADMIN_USER && process.env.ADMIN_PASSWORD) {
    return [{ username: process.env.ADMIN_USER, password: process.env.ADMIN_PASSWORD, role: "OPS_MANAGER", name: process.env.ADMIN_USER, banks: [], source: "env", active: true }];
  }
  return [];
}

const parseBanks = (s: string): string[] => {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
};

/** Everyone who has (or had) a staff login: .env accounts first, then accounts added on the Staff screen. */
export async function staffDirectory(opts: { includeDisabled?: boolean } = {}): Promise<StaffEntry[]> {
  const env = envStaff();
  const taken = new Set(env.map((e) => e.username));
  const rows = await prisma.staffAccount.findMany({ where: opts.includeDisabled ? {} : { active: true }, orderBy: { createdAt: "asc" } });
  const db: StaffEntry[] = rows
    .filter((r) => isRole(r.role) && !taken.has(r.username))
    .map((r) => ({ username: r.username, name: r.name, role: r.role as StaffEntry["role"], banks: parseBanks(r.banks), passwordHash: r.passwordHash, source: "db", active: r.active }));
  return [...env, ...db];
}

export function hashPassword(pw: string): string {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${scryptSync(pw, salt, 64).toString("hex")}`;
}

function checkHash(pw: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const want = Buffer.from(hash, "hex");
  const got = scryptSync(pw, Buffer.from(salt, "hex"), want.length);
  return want.length === got.length && timingSafeEqual(want, got);
}

export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** Check a Basic-auth header against the directory. Disabled accounts never pass. */
export async function verifyBasic(header: string | null): Promise<StaffUser | null> {
  const [scheme, encoded] = (header ?? "").split(" ");
  if (scheme !== "Basic" || !encoded) return null;
  let decoded: string;
  try {
    decoded = atob(encoded);
  } catch {
    return null;
  }
  const [u, ...rest] = decoded.split(":");
  const pass = rest.join(":");
  const found = (await staffDirectory()).find((s) => safeEqual(s.username, u));
  if (!found) return null;
  const ok = found.source === "env" ? safeEqual(found.password ?? "", pass) : checkHash(pass, found.passwordHash ?? "");
  if (!ok) return null;
  return { username: found.username, role: found.role, name: found.name, banks: found.banks };
}

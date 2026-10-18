import "server-only";
import { prisma } from "@/shared/db/db";
import { isRole, type StaffUser } from "@/features/staff/domain/rbac";
import { hashPassword, MIN_PASSWORD, passwordProblem } from "@/shared/security/password.server";

export { MIN_PASSWORD };

export type StaffEntry = StaffUser & { active: boolean; mfaEnabled: boolean; lastLoginAt: Date | null; locked: boolean };

const parseBanks = (s: string): string[] => {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
};

/**
 * Everyone who has (or had) a staff login. Accounts live only in the database (StaffAccount):
 * one sign-in path, Argon2id passwords, TOTP MFA and revocable sessions.
 * STAFF_USERS in .env is no longer a login; `npm run staff -- import-env` copies it into the database once.
 */
export async function staffDirectory(opts: { includeDisabled?: boolean } = {}): Promise<StaffEntry[]> {
  const rows = await prisma.staffAccount.findMany({ where: opts.includeDisabled ? {} : { active: true }, orderBy: { createdAt: "asc" } });
  const now = new Date();
  return rows
    .filter((r) => isRole(r.role))
    .map((r) => ({
      username: r.username,
      name: r.name,
      role: r.role as StaffEntry["role"],
      banks: parseBanks(r.banks),
      active: r.active,
      mfaEnabled: Boolean(r.mfaEnabledAt),
      lastLoginAt: r.lastLoginAt,
      locked: Boolean(r.lockedUntil && r.lockedUntil > now),
    }));
}

/** Bootstrap: copy STAFF_USERS from .env into the database. Existing usernames are left alone. Used by the staff CLI only. */
export async function importEnvStaff(raw = process.env.STAFF_USERS): Promise<{ created: string[]; skipped: string[] }> {
  const created: string[] = [];
  const skipped: string[] = [];
  if (!raw) return { created, skipped };
  const list = JSON.parse(raw) as { username?: string; name?: string; role?: string; password?: string; banks?: unknown }[];
  for (const u of list) {
    const username = u.username?.trim().toLowerCase();
    if (!username || !u.password || !u.role || !isRole(u.role)) {
      skipped.push(username ?? "(no username)");
      continue;
    }
    if (passwordProblem(u.password, username)) {
      skipped.push(`${username} (weak password)`);
      continue;
    }
    if (await prisma.staffAccount.findUnique({ where: { username } })) {
      skipped.push(`${username} (exists)`);
      continue;
    }
    await prisma.staffAccount.create({
      data: {
        username, name: u.name || username, role: u.role, banks: JSON.stringify(Array.isArray(u.banks) ? u.banks : []),
        passwordHash: await hashPassword(u.password), passwordChangedAt: new Date(), createdBy: "system:import-env",
      },
    });
    await prisma.adminEvent.create({ data: { type: "STAFF_CREATED", actor: "system:import-env", target: username, detail: JSON.stringify({ role: u.role }) } });
    created.push(username);
  }
  return { created, skipped };
}

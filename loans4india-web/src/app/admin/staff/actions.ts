"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { BANKS } from "@/config/banks";
import { can, isRole, ROLES } from "@/lib/rbac";
import { actorOf, currentStaff } from "@/lib/staff.server";
import { envStaff, hashPassword, MIN_PASSWORD } from "@/lib/staffAuth";
import type { ActionResult } from "@/app/admin/applications/[id]/actions";

const USERNAME = /^[a-z0-9._-]{3,32}$/;
const fail = (message: string): ActionResult => ({ ok: false, message });

/** Only someone with staff.manage (the master admin) gets past this. */
async function guard() {
  const user = await currentStaff();
  if (!user || !can(user, "staff.manage")) return null;
  return user;
}

function readBanks(fd: FormData) {
  const ids = new Set(BANKS.map((b) => b.id));
  return fd.getAll("banks").map(String).filter((b) => ids.has(b));
}

async function log(type: string, actor: string, target: string, detail: Record<string, unknown> = {}) {
  await prisma.adminEvent.create({ data: { type, actor, target, detail: JSON.stringify(detail) } });
}

export async function createStaff(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await guard();
  if (!user) return fail("Only the master admin can manage staff.");
  const username = String(fd.get("username") ?? "").trim().toLowerCase();
  const name = String(fd.get("name") ?? "").trim();
  const role = String(fd.get("role") ?? "");
  const password = String(fd.get("password") ?? "");
  if (!USERNAME.test(username)) return fail("Username: 3–32 lower-case letters, numbers, dot, dash or underscore.");
  if (!name) return fail("Enter the person's name.");
  if (!isRole(role)) return fail("Pick a role.");
  if (password.length < MIN_PASSWORD) return fail(`Password must be at least ${MIN_PASSWORD} characters.`);
  if (envStaff().some((s) => s.username === username) || (await prisma.staffAccount.findUnique({ where: { username } }))) return fail("That username is taken.");
  const banks = readBanks(fd);
  await prisma.staffAccount.create({ data: { username, name, role, banks: JSON.stringify(banks), passwordHash: hashPassword(password), createdBy: actorOf(user) } });
  await log("STAFF_CREATED", actorOf(user), username, { name, role, banks });
  revalidatePath("/admin/staff");
  return { ok: true, message: `${name} can now sign in as ${username} (${ROLES[role]}).` };
}

export async function updateStaff(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await guard();
  if (!user) return fail("Only the master admin can manage staff.");
  const username = String(fd.get("username") ?? "");
  const row = await prisma.staffAccount.findUnique({ where: { username } });
  if (!row) return fail("Accounts from the .env file can only be changed in .env.");
  const decision = String(fd.get("decision") ?? "save");

  if (decision === "disable" || decision === "enable") {
    if (username === user.username) return fail("You can't disable your own login.");
    const active = decision === "enable";
    await prisma.staffAccount.update({ where: { username }, data: { active } });
    await log(active ? "STAFF_ENABLED" : "STAFF_DISABLED", actorOf(user), username);
    revalidatePath("/admin/staff");
    return { ok: true, message: active ? `${row.name} can sign in again.` : `${row.name} can no longer sign in. Their cases keep them as owner until you reassign.` };
  }

  if (decision === "password") {
    const password = String(fd.get("password") ?? "");
    if (password.length < MIN_PASSWORD) return fail(`Password must be at least ${MIN_PASSWORD} characters.`);
    await prisma.staffAccount.update({ where: { username }, data: { passwordHash: hashPassword(password) } });
    await log("STAFF_PASSWORD_RESET", actorOf(user), username);
    revalidatePath("/admin/staff");
    return { ok: true, message: `New password set for ${row.name}. Share it with them directly.` };
  }

  const name = String(fd.get("name") ?? "").trim();
  const role = String(fd.get("role") ?? "");
  if (!name) return fail("Enter the person's name.");
  if (!isRole(role)) return fail("Pick a role.");
  if (username === user.username && role !== row.role) return fail("You can't change your own role.");
  const banks = readBanks(fd);
  await prisma.staffAccount.update({ where: { username }, data: { name, role, banks: JSON.stringify(banks) } });
  await log("STAFF_UPDATED", actorOf(user), username, { from: { name: row.name, role: row.role, banks: JSON.parse(row.banks) }, to: { name, role, banks } });
  revalidatePath("/admin/staff");
  return { ok: true, message: `Saved ${name}.` };
}

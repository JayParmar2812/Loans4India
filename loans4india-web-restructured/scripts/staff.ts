/**
 * Staff accounts from the command line: bootstrap and break-glass (Platform Flow v4, section 37).
 *   npm run staff -- import-env                       copy STAFF_USERS from .env into the database (once)
 *   npm run staff -- create <username> <ROLE> "<Name>"  new account; password from STAFF_PASSWORD or generated
 *   npm run staff -- reset-password <username>        new random password, ends their sessions
 *   npm run staff -- reset-mfa <username>             they set up a new authenticator at the next sign-in
 *   npm run staff -- unlock <username>                clear a lockout after failed sign-ins
 *   npm run staff -- list
 * Every change is written to the AdminEvent log as "system:cli".
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { prisma } from "@/shared/db/db";
import { hashPassword, passwordProblem } from "@/shared/security/password.server";
import { importEnvStaff } from "@/features/staff/server/staffAuth";
import { isRole, ROLES } from "@/features/staff/domain/rbac";
import { revokeStaffSessions } from "@/features/staff/server/staffSession.server";

const ACTOR = "system:cli";
const log = (type: string, target: string, detail: Record<string, unknown> = {}) =>
  prisma.adminEvent.create({ data: { type, actor: ACTOR, target, detail: JSON.stringify(detail) } });
const generated = () => randomBytes(15).toString("base64url");

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  switch (cmd) {
    case "import-env": {
      const r = await importEnvStaff();
      console.log(`Created: ${r.created.join(", ") || "none"}\nSkipped: ${r.skipped.join(", ") || "none"}`);
      if (r.created.length) console.log("Remove the passwords from STAFF_USERS in .env now; the database is the only login source.");
      break;
    }
    case "create": {
      const [username, role, name] = args;
      if (!username || !role || !isRole(role)) throw new Error(`Usage: create <username> <ROLE> "<Name>". Roles: ${Object.keys(ROLES).join(", ")}`);
      const pw = process.env.STAFF_PASSWORD || generated();
      const weak = passwordProblem(pw, username);
      if (weak) throw new Error(weak);
      await prisma.staffAccount.create({ data: { username, role, name: name || username, passwordHash: await hashPassword(pw), passwordChangedAt: new Date(), createdBy: ACTOR } });
      await log("STAFF_CREATED", username, { role });
      console.log(`Created ${username} (${ROLES[role]}).${process.env.STAFF_PASSWORD ? "" : `\nTemporary password (shown once): ${pw}`}`);
      break;
    }
    case "reset-password": {
      const [username] = args;
      const pw = generated();
      await prisma.staffAccount.update({ where: { username }, data: { passwordHash: await hashPassword(pw), passwordChangedAt: new Date(), failedLogins: 0, lockedUntil: null } });
      await revokeStaffSessions(username);
      await log("STAFF_PASSWORD_RESET", username);
      console.log(`New temporary password for ${username} (shown once): ${pw}`);
      break;
    }
    case "reset-mfa": {
      const [username] = args;
      await prisma.staffAccount.update({ where: { username }, data: { mfaSecretEnc: null, mfaEnabledAt: null, mfaLastStep: null } });
      await revokeStaffSessions(username);
      await log("STAFF_MFA_RESET", username);
      console.log(`${username} will set up a new authenticator at the next sign-in.`);
      break;
    }
    case "unlock": {
      const [username] = args;
      await prisma.staffAccount.update({ where: { username }, data: { failedLogins: 0, lockedUntil: null } });
      await log("STAFF_UNLOCKED", username);
      console.log(`${username} unlocked.`);
      break;
    }
    case "list": {
      for (const a of await prisma.staffAccount.findMany({ orderBy: { createdAt: "asc" } })) {
        console.log(`${a.active ? " " : "x"} ${a.username.padEnd(20)} ${a.role.padEnd(18)} MFA:${a.mfaEnabledAt ? "on " : "off"} ${a.lockedUntil && a.lockedUntil > new Date() ? "LOCKED" : ""}`);
      }
      break;
    }
    default:
      console.log("Commands: import-env | create <username> <ROLE> \"<Name>\" | reset-password <u> | reset-mfa <u> | unlock <u> | list");
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";

/**
 * Build one template SQLite database from the real migrations (including the append-only triggers).
 * Each test file copies it, so tests never touch dev.db and always run against the current schema.
 */
export const TEST_DIR = path.resolve(__dirname, "../../.test-db");

export default function setup() {
  rmSync(TEST_DIR, { recursive: true, force: true });
  mkdirSync(TEST_DIR, { recursive: true });
  const template = path.join(TEST_DIR, "template.db");
  execFileSync(process.execPath, [path.resolve(__dirname, "../../node_modules/prisma/build/index.js"), "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: `file:${template}` },
    stdio: "pipe",
  });
  process.env.L4I_TEMPLATE_DB = template;
  return () => rmSync(TEST_DIR, { recursive: true, force: true });
}

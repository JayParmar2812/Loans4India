import { copyFileSync, mkdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { vi } from "vitest";
import { requestContext } from "./context";

// A private copy of the migrated template database for this test file.
const dir = path.resolve(import.meta.dirname, "../../.test-db");
mkdirSync(dir, { recursive: true });
const db = path.join(dir, `t-${randomBytes(6).toString("hex")}.db`);
copyFileSync(path.join(dir, "template.db"), db);
process.env.DATABASE_URL = `file:${db}`;
process.env.STORAGE_DIR = path.join(dir, `storage-${randomBytes(4).toString("hex")}`);
process.env.TRUST_PROXY = "1";

// next/headers and friends, backed by an in-memory request the test controls (see context.ts).
vi.mock("next/headers", () => ({
  headers: async () => requestContext.headers,
  cookies: async () => ({
    get: (name: string) => (requestContext.cookies.has(name) ? { name, value: requestContext.cookies.get(name)! } : undefined),
    set: (name: string, value: string) => void requestContext.cookies.set(name, value),
    delete: (name: string) => void requestContext.cookies.delete(name),
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error(`REDIRECT:${url}`), { redirectTo: url });
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  permanentRedirect: (url: string) => {
    throw Object.assign(new Error(`REDIRECT:${url}`), { redirectTo: url });
  },
}));
vi.mock("next/server", async (orig) => {
  const real = await orig<typeof import("next/server")>();
  return { ...real, connection: async () => {} };
});
// React's per-request cache() memoises across tests here (there is no request); make it a pass-through.
vi.mock("react", async (orig) => {
  const real = await orig<typeof import("react")>();
  return { ...real, cache: <T,>(fn: T) => fn };
});

/**
 * Background jobs (Platform Flow v4, sections 26, 42, 43). Schedule every 15 minutes:
 *   npm run jobs            all jobs
 *   npm run jobs -- purge   one job: dormancy | purge | messages | housekeeping
 * Prints a one-line JSON summary per job (no personal data) for the scheduler's log.
 */
import "dotenv/config";
import { prisma } from "@/shared/db/db";
import { runDormancy, runHousekeeping, runMessages, runPurge } from "@/features/compliance/server/jobs.server";

const JOBS = { dormancy: runDormancy, purge: runPurge, messages: runMessages, housekeeping: runHousekeeping } as const;

async function main() {
  const only = process.argv[2] as keyof typeof JOBS | undefined;
  if (only && !(only in JOBS)) throw new Error(`Unknown job "${only}". Jobs: ${Object.keys(JOBS).join(", ")}`);
  for (const [name, fn] of Object.entries(JOBS)) {
    if (only && name !== only) continue;
    const started = Date.now();
    try {
      const result = await fn();
      console.log(JSON.stringify({ job: name, ok: true, ms: Date.now() - started, ...result }));
    } catch (e) {
      process.exitCode = 1;
      console.error(JSON.stringify({ job: name, ok: false, error: e instanceof Error ? e.message : String(e) }));
    }
  }
}

main().finally(() => prisma.$disconnect());

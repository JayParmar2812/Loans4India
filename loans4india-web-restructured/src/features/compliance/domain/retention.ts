/**
 * Retention and dormancy timers (Platform Flow v4, sections 26 and 43). Proposed defaults; VERIFY each period with
 * counsel and the bank agreements. Override per deployment with the env vars named here.
 */
const days = (env: string | undefined, fallback: number) => {
  const n = Number(env);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export const retention = () => ({
  /** Identity and income documents: close + 90 days. */
  documentsDays: days(process.env.RETENTION_DOCUMENTS_DAYS, 90),
  /** Profile, contact and identifiers: close + 180 days. */
  profileDays: days(process.env.RETENTION_PROFILE_DAYS, 180),
});

export const DORMANCY = {
  /** Before submit: remind after 7 days without applicant activity, close as DORMANT after 30. */
  remindAfterDays: 7,
  closeAfterDays: 30,
  /** Action needed (before the bank): reminders at 2 and 5 days, close after 15 (section 14). */
  actionReminderDays: [2, 5],
  actionCloseDays: 15,
} as const;

/** States in which the applicant is still filling in (dormancy applies). */
export const BEFORE_SUBMIT_STATES = ["ENQUIRY", "CONSENT_PENDING", "PROFILE_IN_PROGRESS", "DOCUMENTS_PENDING"];

/** Quiet hours for non-OTP messages: only 09:00-21:00 IST (section 42). */
export function inQuietHours(now = new Date()): boolean {
  const ist = new Date(now.getTime() + 330 * 60_000);
  const h = ist.getUTCHours();
  return h < 9 || h >= 21;
}

export const JOB_VERSION = "jobs-2026-10-18.1";

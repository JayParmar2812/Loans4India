/**
 * Older "Send to bank" records (BankShare) from before Platform Flow v4's attempt model.
 * Kept so their history stays readable. Pure: safe on client and server.
 */
export const SHARE_CHANNELS = {
  BANK_PORTAL: "Bank portal",
  BANK_SALES_OFFICER: "Bank sales officer / POS",
  MASTER_DSA: "Master DSA",
  OTHER: "Other approved channel",
} as const;
export type ShareChannel = keyof typeof SHARE_CHANNELS;

export const SHARE_LINK_HOURS = 72;
export const SHARE_LINK_MAX_DOWNLOADS = 3;

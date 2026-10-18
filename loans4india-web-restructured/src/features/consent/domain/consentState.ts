import { REQUIRED_PURPOSES } from "./consent";

type ConsentRow = { purpose: string; granted: boolean; createdAt: Date; bankListVersion: string | null; banksNamed: string | null; noticeVersion: string };

export type ConsentState = {
  /** Every required purpose is granted in its latest record. */
  valid: boolean;
  /** Banks named on the screen the applicant agreed to (latest sharing consent). */
  bankIds: string[];
  bankListVersion: string | null;
  noticeVersion: string | null;
  grantedAt: Date | null;
  revokedAt: Date | null;
  marketing: boolean;
};

/** Read the append-only consent ledger: the latest row per purpose wins. */
export function consentState(rows: ConsentRow[]): ConsentState {
  const latest = new Map<string, ConsentRow>();
  for (const r of [...rows].sort((a, b) => +a.createdAt - +b.createdAt)) latest.set(r.purpose, r);
  const valid = REQUIRED_PURPOSES.every((p) => latest.get(p)?.granted);
  const share = latest.get("SHARE_WITH_PARTNER_LENDERS");
  let bankIds: string[] = [];
  try {
    bankIds = share?.granted && share.banksNamed ? (JSON.parse(share.banksNamed) as string[]) : [];
  } catch {
    bankIds = [];
  }
  const revoked = REQUIRED_PURPOSES.map((p) => latest.get(p)).filter((r) => r && !r.granted) as ConsentRow[];
  return {
    valid,
    bankIds,
    bankListVersion: share?.bankListVersion ?? null,
    noticeVersion: share?.noticeVersion ?? null,
    grantedAt: valid && share ? share.createdAt : null,
    revokedAt: revoked.length ? revoked.map((r) => r.createdAt).sort((a, b) => +b - +a)[0] : null,
    marketing: Boolean(latest.get("MARKETING")?.granted),
  };
}

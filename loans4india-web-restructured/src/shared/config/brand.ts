/**
 * Single source of truth for the consumer brand.
 * Renaming the product later = edit this file (plus logo assets).
 */
export const brand = {
  name: "LoansForIndia",
  // Split used by the wordmark: first part in ink, second in violet.
  wordmark: ["Loans", "ForIndia"] as const,
  shortName: "LFI",
  referencePrefix: "LFI",
  domain: "loansforindia.com",
  tagline: "One application. The right bank.",
  taglineHi: "सही लोन, सही बैंक, एक ही आवेदन में।",
  supportEmail: "support@loansforindia.com",
  supportPhone: "+91 00000 00000", // TODO: real number before launch
  // Legal entity shown in disclosures. TODO: confirm registered company name.
  legalEntity: "LoansForIndia (proposed entity name)",
  grievanceOfficer: {
    name: "To be appointed",
    email: "grievance@loansforindia.com",
  },
  /**
   * Flip to true ONLY after at least one bank/NBFC DSA agreement is signed.
   * While false, the site avoids naming lenders or promising partner banks.
   */
  partnersLive: false,
  partners: [] as { name: string; type: "Bank" | "NBFC"; grievanceUrl?: string }[],
} as const;

export type Brand = typeof brand;

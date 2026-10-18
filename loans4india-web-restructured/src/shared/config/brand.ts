/**
 * Single source of truth for the consumer brand.
 * Renaming the product later = edit this file (plus the logo in public/brand).
 * Name and logo: "Loans4India Mint Smile Logo" (Logo options folder). The public domain is still an open decision,
 * so the site URL comes from NEXT_PUBLIC_SITE_URL; the default below is the domain the code used before the rename.
 */
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://loansforindia.com").replace(/\/$/, "");

export const brand = {
  name: "Loans4India",
  // Text form of the wordmark, for alt text and places an image can't go (emails, SMS).
  wordmark: ["Loans", "4India"] as const,
  logo: { src: "/brand/loans4india-logo.webp", width: 640, height: 143 },
  shortName: "L4I",
  // Applicant references keep the LFI prefix that Platform Flow v4 section 4 specifies (e.g. LFI-7K3P9Q).
  referencePrefix: "LFI",
  siteUrl,
  domain: new URL(siteUrl).host,
  tagline: "One application. The right bank.",
  taglineHi: "सही लोन, सही बैंक, एक ही आवेदन में।",
  supportEmail: "support@loansforindia.com", // TODO: confirm mailbox on the final domain
  supportPhone: "+91 00000 00000", // TODO: real number before launch
  supportHours: "Monday to Saturday, 9:30 am to 6:30 pm IST",
  // Legal entity shown in disclosures. TODO: confirm registered company name.
  legalEntity: "Loans4India (proposed entity name)",
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

/** "Synthetic" until the first bank agreement and counsel sign-off (v4 section 52): staff and applicants are told. */
export const dataMode = (): "synthetic" | "live" => (process.env.DATA_MODE === "live" ? "live" : "synthetic");

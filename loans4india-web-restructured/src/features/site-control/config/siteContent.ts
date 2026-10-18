import { z } from "zod";
import { brand } from "@/shared/config/brand";

/**
 * Everything the master admin can change on the public site (Website screen, /admin/site).
 * The defaults below are the site as built; saved versions live in the SiteContentVersion table.
 * Fixed on purpose (not here): the "not a lender" disclosures, the consent screen, the legal pages,
 * the document checklist and everything an applicant sees after they apply.
 */

const text = (max: number) => z.string().trim().max(max);
const href = z
  .string()
  .trim()
  .max(300)
  .refine((h) => /^\/[^/\\]/.test(h) || h === "/" || /^https:\/\/[^\s]+$/.test(h), "Links must start with / (a page on this site) or https://");

const link = z.object({ label: text(60).min(1, "Every link needs a label"), href });
const item = z.object({ title: text(80).min(1, "Every item needs a title"), text: text(400) });
const faq = z.object({ q: text(200).min(1, "Every question needs text"), a: text(1500).min(1, "Every question needs an answer") });

export const HOME_SECTIONS = ["how", "products", "uses", "why", "emi", "faq", "cta"] as const;
export type HomeSection = (typeof HOME_SECTIONS)[number];
export const HOME_SECTION_LABELS: Record<HomeSection, string> = {
  how: "How it works",
  products: "Loan cards",
  uses: "Reasons to borrow",
  why: "Why choose us",
  emi: "EMI calculator",
  faq: "Questions",
  cta: "Closing call to action",
};

const productSchema = z.object({
  enabled: z.boolean(),
  metaTitle: text(120),
  metaDescription: text(300),
  eyebrow: text(60),
  title: text(120).min(1),
  intro: text(500),
  highlights: z.array(z.object({ k: text(30).min(1), v: text(30).min(1) })).max(8),
  whoCanApply: z.array(text(200).min(1)).max(12),
  documents: z.array(text(200).min(1)).max(12),
  faq: z.array(faq).max(20),
});
export type ProductSiteContent = z.infer<typeof productSchema>;

/** Top-level addresses the site already uses; a new page can't take one. */
export const RESERVED_SLUGS = [
  "about", "admin", "api", "apply", "business-loan", "documents", "emi-calculator", "grievance", "personal-loan",
  "privacy", "share", "site-assets", "sitemap.xml", "robots.txt", "terms", "favicon.ico", "_next",
  "calculators", "how-it-works", "faq", "guides", "contact", "my", "brand", "opengraph-image", "icon",
];
const slug = z
  .string()
  .trim()
  .max(60)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "A page address uses lower-case letters, numbers and single dashes, like home-loan-guide")
  .refine((s) => !RESERVED_SLUGS.includes(s), "That address is already used by the site");
/** An image from the Website screen's image library ("" for none). */
const assetRef = z.union([z.literal(""), z.string().regex(/^[a-z0-9]{20,32}$/, "Pick an image from the library")]);

export const BLOCK_TYPES = { heading: "Heading", text: "Text", image: "Image", list: "List", faq: "Questions", cta: "Call to action", emi: "EMI calculator" } as const;
export type BlockType = keyof typeof BLOCK_TYPES;
const blockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("heading"), text: text(120).min(1, "A heading block needs text") }),
  z.object({ type: z.literal("text"), text: text(5000).min(1, "A text block needs text") }),
  z.object({ type: z.literal("image"), asset: assetRef.refine((a) => a !== "", "Pick an image for the image block"), alt: text(200).min(1, "Describe the image for people who can't see it"), caption: text(200) }),
  z.object({ type: z.literal("list"), items: z.array(text(300).min(1)).min(1).max(30) }),
  z.object({ type: z.literal("faq"), items: z.array(faq).min(1).max(20) }),
  z.object({ type: z.literal("cta"), heading: text(80).min(1), text: text(200), button: text(40).min(1), href }),
  z.object({ type: z.literal("emi") }),
]);
export type Block = z.infer<typeof blockSchema>;

const pageSchema = z.object({
  slug,
  title: text(120).min(1, "Every page needs a title"),
  metaDescription: text(300),
  published: z.boolean(),
  blocks: z.array(blockSchema).max(40),
});
export type SitePage = z.infer<typeof pageSchema>;

const colour = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Colours are written like #4b22d1");
export const HEADING_FONTS = { "Plus Jakarta Sans": "Plus Jakarta Sans (current)", "Baloo 2": "Baloo 2 (rounded)", Mukta: "Mukta" } as const;
const themeSchema = z.object({
  main: colour,
  dark: colour,
  light: colour,
  accent: colour,
  headingFont: z.enum(Object.keys(HEADING_FONTS) as [keyof typeof HEADING_FONTS]),
  logo: z.tuple([text(20).min(1, "The logo needs text"), text(20)]),
});
export type SiteTheme = z.infer<typeof themeSchema>;

export const siteContentSchema = z.object({
  banner: z.object({ show: z.boolean(), text: text(200), linkLabel: text(40), linkHref: z.union([href, z.literal("")]) }),
  applications: z.object({ open: z.boolean(), pausedMessage: text(400).min(1, "Write what applicants see while applications are paused") }),
  nav: z.array(link).max(8),
  home: z.object({
    order: z.array(z.enum(HOME_SECTIONS)),
    hero: z.object({
      eyebrow: text(60),
      headline: text(160).min(1, "The main headline can't be empty"),
      subHi: text(160),
      sub: text(500),
      badges: z.array(text(60).min(1)).max(6),
      image: assetRef.default(""), // added in stage 2; older saved versions have no image
    }),
    how: z.object({ show: z.boolean(), heading: text(80), items: z.array(item).max(8) }),
    products: z.object({
      show: z.boolean(),
      cards: z.array(z.object({ title: text(60).min(1), href, range: text(60), points: z.array(text(120).min(1)).max(6) })).max(4),
    }),
    uses: z.object({ show: z.boolean(), heading: text(80), items: z.array(text(40).min(1)).max(16) }),
    why: z.object({ show: z.boolean(), heading: text(80), items: z.array(item).max(8) }),
    emi: z.object({ show: z.boolean(), heading: text(80), text: text(200) }),
    faq: z.object({ show: z.boolean(), heading: text(80), items: z.array(faq).max(20) }),
    cta: z.object({ show: z.boolean(), heading: text(80), text: text(200), button: text(40).min(1) }),
  }),
  products: z.object({ PERSONAL_LOAN: productSchema, BUSINESS_LOAN: productSchema }),
  tools: z.object({ emiCalculator: z.boolean() }),
  footer: z.object({ columns: z.array(z.object({ title: text(40).min(1), links: z.array(link).max(10) })).max(4) }),
  pages: z.array(pageSchema).max(30).refine((ps) => new Set(ps.map((p) => p.slug)).size === ps.length, "Two pages can't share an address"),
  theme: themeSchema,
});
export type SiteContent = z.infer<typeof siteContentSchema>;

/**
 * Words the site must never use (v4 section 3: an estimate is never an approval; no promises on a lender's behalf).
 * Saving is refused while any of these appear anywhere in the content.
 */
export const BANNED_PHRASES = [/\beligib(le|ility)\b/i, /\bguarantee(d|s)?\b/i, /\bpre-?approved\b/i, /\binstant approval\b/i, /\b100\s?% approval\b/i, /\bassured loan\b/i];

// Addresses and ids aren't shown as text (an address like /emi-calculator#eligibility is fine).
const NOT_TEXT = new Set(["href", "linkHref", "slug", "asset", "image"]);

export function bannedPhrases(c: unknown, skip: ReadonlySet<string> = NOT_TEXT): string[] {
  const found = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === "string") {
      for (const re of BANNED_PHRASES) {
        const m = v.match(re);
        if (m) found.add(m[0].toLowerCase());
      }
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.entries(v).forEach(([k, x]) => !skip.has(k) && walk(x));
  };
  walk(c);
  return [...found];
}

/** Paths that belong to a product or tool the master admin can switch off. */
export const PRODUCT_PATHS = { PERSONAL_LOAN: "/personal-loan", BUSINESS_LOAN: "/business-loan" } as const;

/** False for links to pages that are switched off, so they drop out of the menu, footer and loan cards. */
export function linkIsLive(h: string, c: SiteContent): boolean {
  const path = h.split(/[?#]/)[0];
  if (path === PRODUCT_PATHS.PERSONAL_LOAN) return c.products.PERSONAL_LOAN.enabled;
  if (path === PRODUCT_PATHS.BUSINESS_LOAN) return c.products.BUSINESS_LOAN.enabled;
  if (path === "/emi-calculator") return c.tools.emiCalculator;
  if (h === "/#how-it-works") return c.home.how.show;
  if (path === "/calculators") return c.tools.emiCalculator;
  const page = c.pages.find((p) => `/${p.slug}` === path);
  if (page) return page.published;
  return true;
}

// Parsed through the schema so its key order matches saved versions (the change summary compares them as JSON).
export const DEFAULT_SITE_CONTENT: SiteContent = siteContentSchema.parse({
  banner: { show: false, text: "", linkLabel: "", linkHref: "" },
  applications: { open: true, pausedMessage: "We're not taking new applications right now. Please check back soon. If you've already applied, your application link still works." },
  nav: [
    { href: "/personal-loan", label: "Personal Loan" },
    { href: "/business-loan", label: "Business Loan" },
    { href: "/calculators", label: "Calculators" },
    { href: "/how-it-works", label: "How it works" },
    { href: "/guides", label: "Guides" },
  ],
  home: {
    order: [...HOME_SECTIONS],
    hero: {
      eyebrow: "Personal & business loans",
      headline: "One application.\nThe *right bank* for your loan.",
      subHi: brand.taglineHi,
      sub: "Tell us once what you need. We prepare your application, submit it to one suitable partner bank, and stay with you until the bank decides. Free for you.",
      badges: ["No fee from you", "No effect on credit score to estimate", "Not a lender: the bank decides"],
      image: "",
    },
    how: {
      show: true,
      heading: "How it works",
      items: [
        { title: "Start your application", text: "Your loan amount and mobile, then your consent naming the partner banks." },
        { title: "Fill details & upload documents", text: "One form that saves as you go, then PAN, masked Aadhaar, income proof and bank statements." },
        { title: "We review & submit to one bank", text: "Our team checks your file, picks one suitable partner bank and submits it for you." },
        { title: "The bank decides", text: "The bank does its own checks, decides and disburses. You follow every step in your application." },
      ],
    },
    products: {
      show: true,
      cards: [
        { href: "/personal-loan", title: "Personal Loan", range: "₹50,000 to ₹40 lakh", points: ["For salaried and self-employed", "No collateral needed", "Tenure 1 to 7 years"] },
        { href: "/business-loan", title: "Business Loan", range: "₹1 lakh to ₹1 crore+", points: ["Working capital & expansion", "For proprietors, firms & professionals", "Secured and unsecured options"] },
      ],
    },
    uses: {
      show: true,
      heading: "Whatever the reason, start here",
      items: ["Medical emergency", "Wedding", "Home renovation", "Education", "Travel", "Pay off costly debt", "New business equipment", "Working capital"],
    },
    why: {
      show: true,
      heading: `Why borrowers choose ${brand.name}`,
      items: [
        { title: "One application", text: "Stop filling the same form on ten lender websites. Tell us once." },
        { title: "Honest estimates", text: "Any amount we show is an estimate, clearly marked. Only the bank approves a loan." },
        { title: "A real person helps", text: "A named person on our team handles your application and follows up with the bank." },
        { title: "Your data, your say", text: "Shared only with the partner bank you consented to, for your application." },
      ],
    },
    emi: { show: true, heading: "Plan your EMI", text: "Move the sliders to see what fits your monthly budget." },
    faq: {
      show: true,
      heading: "Questions people ask",
      items: [
        { q: `Is ${brand.name} a bank or lender?`, a: `No. ${brand.name} is a loan facilitation service. We prepare your application, submit it to one suitable partner bank or NBFC that you consented to, and follow up for you. The bank alone approves, sanctions and disburses your loan.` },
        { q: "Do I have to pay anything to apply?", a: "No. Applying through us is free for you. Lenders may charge their own processing fees, which they will show you in the loan's Key Fact Statement before you sign. Never pay anyone upfront to 'get a loan approved'." },
        { q: "Will checking my options affect my credit score?", a: "No. Our quick estimate uses only the details you enter. A lender may check your credit report when it processes your application, with your consent." },
        { q: "What documents will I need?", a: "For salaried applicants: PAN, masked Aadhaar, the last 6 months' salary slips and 6 months' salary-account statement. For self-employed and business loans: PAN, masked Aadhaar, business registration (GST, Udyam or Shop Act), 2 years' ITR and 12 months' bank statements. You upload them securely in your application, and we check them before anything goes to a bank." },
        { q: "How long does it take?", a: "Our team aims to start reviewing a submitted application within one working day. Once it reaches the bank, the timeline is the bank's: it depends on its own checks and on how quickly any questions are answered." },
        { q: "How is my data protected?", a: "Your details are encrypted, accessed only by authorised staff, and shared only with lenders for your application, with your consent. You can ask us to stop processing your data anytime." },
      ],
    },
    cta: { show: true, heading: "Ready to find your loan?", text: "It takes two minutes and costs nothing.", button: "Start my application" },
  },
  products: {
    PERSONAL_LOAN: {
      enabled: true,
      metaTitle: "Personal Loan: apply once, we submit to a suitable bank",
      metaDescription: "Personal loans from ₹50,000 to ₹40 lakh for salaried and self-employed borrowers. Get a quick estimate and apply once. Free for you.",
      eyebrow: "Personal Loan",
      title: "A personal loan from a lender that fits you",
      intro: "Medical bills, a wedding, a new home setup or clearing expensive debt: tell us your need once. We check your file and submit it to one suitable partner bank or NBFC from the list you agree to.",
      highlights: [
        { k: "Amount", v: "₹50K–40L" },
        { k: "Tenure", v: "1–7 years" },
        { k: "Collateral", v: "None" },
        { k: "Fee from you", v: "₹0" },
      ],
      whoCanApply: [
        "Indian resident aged 21 to 60",
        "Salaried with ₹15,000+ monthly take-home, or self-employed with regular income",
        "At least 6 months with current employer (salaried)",
        "Each bank checks your credit history itself; we never pull your credit report",
      ],
      documents: ["PAN card", "Aadhaar card (masked)", "Last 6 months' salary slips", "Last 6 months' bank statement", "Photograph"],
      faq: [
        { q: "What interest rate will I get?", a: "Only the bank sets your rate, based on its own assessment. We don't quote or promise rates. Before you accept a loan, the bank must give you a Key Fact Statement showing the rate, all fees and the APR (the all-in yearly cost)." },
        { q: "Can I apply with a low credit score?", a: "Yes, you can apply. Each bank decides using its own credit checks, so nobody can tell you in advance whether it will approve. We never pull your credit report ourselves." },
        { q: "Can I prepay or close my loan early?", a: "Prepayment rules and any foreclosure charges are set by the bank and listed in its Key Fact Statement and loan agreement. Read them before you sign." },
      ],
    },
    BUSINESS_LOAN: {
      enabled: true,
      metaTitle: "Business Loan — working capital & expansion",
      metaDescription: "Business loans for proprietors, partnerships and professionals. Get a quick estimate and apply once. Free for you.",
      eyebrow: "Business Loan",
      title: "Funds to run and grow your business",
      intro: "Stock, machinery, a second outlet or just smoother cash flow. Apply once: we check your documents and submit your file to one suitable partner bank or NBFC from the list you agree to.",
      highlights: [
        { k: "Amount", v: "₹1L–1Cr+" },
        { k: "Tenure", v: "1–5 years" },
        { k: "Collateral", v: "Optional" },
        { k: "For", v: "MSMEs & pros" },
      ],
      whoCanApply: [
        "Business running for 2+ years (some lenders accept 1 year)",
        "Annual turnover and ITR filed for the last 1–2 years",
        "Proprietorship, partnership, LLP, private limited, or self-employed professional",
        "Healthy bank account operations",
      ],
      documents: ["PAN (individual & business)", "Aadhaar (masked)", "GST registration / Udyam certificate", "Last 2 years' ITR with financials", "Last 12 months' bank statements"],
      faq: [
        { q: "Do I need collateral?", a: "Not always. Many lenders offer unsecured business loans up to a limit; larger amounts may need property or other security." },
        { q: "I'm a new business. Can I apply?", a: "Yes. Banks set their own minimum business age. We check your file against each partner bank's published sourcing rules before choosing where to submit it." },
        { q: "How is the loan amount decided?", a: "Lenders look at turnover, profit, banking behaviour, existing debt and credit history. Our team helps present your file clearly." },
      ],
    },
  },
  tools: { emiCalculator: true },
  footer: {
    columns: [
      { title: "Loans", links: [{ href: "/personal-loan", label: "Personal Loan" }, { href: "/business-loan", label: "Business Loan" }, { href: "/apply", label: "Start your application" }] },
      { title: "Tools & help", links: [{ href: "/calculators", label: "Loan calculators" }, { href: "/emi-calculator", label: "EMI Calculator" }, { href: "/guides", label: "Guides" }, { href: "/faq", label: "FAQs" }, { href: "/how-it-works", label: "How it works" }] },
      { title: "Company", links: [{ href: "/about", label: "About us" }, { href: "/contact", label: "Contact & support" }, { href: "/privacy", label: "Privacy Policy" }, { href: "/terms", label: "Terms of Use" }, { href: "/grievance", label: "Grievance Redressal" }] },
    ],
  },
  pages: [],
  // Sampled from the Mint Smile logo; matches src/app/globals.css.
  theme: { main: "#3e1dc8", dark: "#24107a", light: "#efecfd", accent: "#36d49f", headingFont: "Plus Jakarta Sans", logo: [brand.wordmark[0], brand.wordmark[1]] },
});

/**
 * Read saved content safely: each part that no longer matches the shape (say, after a code change) falls back to its default,
 * so one bad field can never take the site down. Missing home sections are added back to the end of the order.
 */
export function normaliseSiteContent(raw: unknown): SiteContent {
  const d = DEFAULT_SITE_CONTENT;
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const pick = <K extends keyof SiteContent>(k: K): SiteContent[K] => {
    const parsed = siteContentSchema.shape[k].safeParse(r[k]);
    return (parsed.success ? parsed.data : d[k]) as SiteContent[K];
  };
  const out: SiteContent = {
    banner: pick("banner"),
    applications: pick("applications"),
    nav: pick("nav"),
    home: pick("home"),
    products: pick("products"),
    tools: pick("tools"),
    footer: pick("footer"),
    pages: pick("pages"),
    theme: pick("theme"),
  };
  const order = out.home.order.filter((s, i, a) => a.indexOf(s) === i);
  out.home = { ...out.home, order: [...order, ...HOME_SECTIONS.filter((s) => !order.includes(s))] };
  return out;
}

/** WCAG contrast ratio between two #rrggbb colours. */
export function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Colour pairs the site actually uses, each needing 4.5:1 so text stays readable (WCAG AA). */
export function themeProblems(t: SiteTheme): string[] {
  const valid = /^#[0-9a-fA-F]{6}$/;
  if (![t.main, t.dark, t.light, t.accent].every((c) => valid.test(c))) return ["Colours are written like #4b22d1"];
  const pairs: [string, string, string][] = [
    ["White text on the main colour (top of the home page, logo)", "#ffffff", t.main],
    ["White text on the dark colour (footer, closing banner)", "#ffffff", t.dark],
    ["Main colour text on white (links, buttons)", t.main, "#ffffff"],
    ["Dark colour text on the light colour (headings on tinted sections)", t.dark, t.light],
    ["Button text on the accent colour", "#0f1f1a", t.accent],
  ];
  return pairs.filter(([, fg, bg]) => contrast(fg, bg) < 4.5).map(([what, fg, bg]) => `${what} is hard to read (${contrast(fg, bg).toFixed(1)}:1, needs 4.5:1)`);
}

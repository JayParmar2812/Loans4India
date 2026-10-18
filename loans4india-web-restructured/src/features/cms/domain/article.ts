import { z } from "zod";
import { bannedPhrases, blockSchema, RESERVED_SLUGS } from "@/features/site-control/config/siteContent";

/**
 * Guides and articles (CMS). Content is structured blocks validated here, never raw HTML.
 * Workflow: DRAFT → IN_REVIEW → (published by someone else) ; any edit returns the draft to DRAFT.
 * What the public sees is always the approved live revision; editing never changes it until the next approval.
 */
export const ARTICLE_CATEGORIES = { GUIDE: "Guide", GLOSSARY: "Explainer", NEWS: "News" } as const;
export type ArticleCategory = keyof typeof ARTICLE_CATEGORIES;
export const ARTICLE_STATUSES = { DRAFT: "Draft", IN_REVIEW: "Waiting for approval", PUBLISHED: "Published" } as const;

const text = (max: number) => z.string().trim().max(max);

export const slugSchema = z
  .string()
  .trim()
  .min(3, "The address needs at least 3 characters")
  .max(80)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lower-case letters, numbers and single dashes, like documents-for-a-personal-loan");

/** Canonical override: empty (use the guide's own URL) or a path on this site. Never another host. */
const canonicalSchema = z.union([
  z.literal(""),
  z.string().trim().max(200).regex(/^\/(?!\/)[a-z0-9\-/]*$/, "A canonical address must be a path on this site, like /guides/emi-explained"),
]);

export const articleDataSchema = z.object({
  title: text(120).min(1, "Give the guide a title"),
  // Completeness (summary length, no empty blocks) is checked when it goes for approval, so drafts can be saved half-written.
  excerpt: text(300),
  category: z.enum(Object.keys(ARTICLE_CATEGORIES) as [ArticleCategory, ...ArticleCategory[]]),
  blocks: z.array(blockSchema).min(1, "Add at least one block of content").max(60),
  seo: z.object({
    title: text(70),
    description: text(160),
    canonical: canonicalSchema,
    noindex: z.boolean(),
    image: z.union([z.literal(""), z.string().regex(/^[a-z0-9]{20,32}$/)]),
    imageAlt: text(200),
  }),
  breadcrumb: text(40),
  /** Other guides to link at the end (slugs). */
  related: z.array(slugSchema).max(6),
});
export type ArticleData = z.infer<typeof articleDataSchema>;

const PLACEHOLDER = "Write the guide here.";

export const emptyArticle = (title = ""): ArticleData => ({
  title,
  excerpt: "",
  category: "GUIDE",
  blocks: [{ type: "text", text: PLACEHOLDER }],
  seo: { title: "", description: "", canonical: "", noindex: false, image: "", imageAlt: "" },
  breadcrumb: "",
  related: [],
});

/** Everything that blocks saving or publishing, in plain words. Saving a draft only needs the shape; publishing needs all of it. */
export function articleProblems(raw: unknown, mode: "save" | "publish"): { data: ArticleData | null; problems: string[] } {
  const parsed = articleDataSchema.safeParse(raw);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { data: null, problems: [`${i.message}${i.path.length ? ` (at ${i.path.join(" › ")})` : ""}`] };
  }
  const d = parsed.data;
  const problems: string[] = [];
  const banned = bannedPhrases(d);
  if (banned.length) problems.push(`A guide can't say "${banned.join('", "')}": an estimate is never an approval, and only the bank decides.`);
  if (mode === "publish") {
    if (d.title.length < 5) problems.push("Give the guide a proper title (at least 5 characters).");
    if (d.excerpt.length < 20) problems.push("Write a one or two sentence summary (shown in lists and search results).");
    if (d.blocks.some((b) => b.type === "text" && (!b.text.trim() || b.text.trim() === PLACEHOLDER))) problems.push("Replace the placeholder text with the guide itself.");
    if (d.seo.image && !d.seo.imageAlt) problems.push("Describe the social image (alt text) for people who can't see it.");
    if (d.seo.description && d.seo.description.length < 50) problems.push("The search description is very short; aim for 120 to 160 characters.");
  }
  return { data: d, problems };
}

export function slugProblem(slug: string): string | null {
  const s = slugSchema.safeParse(slug);
  if (!s.success) return s.error.issues[0].message;
  if (RESERVED_SLUGS.includes(slug)) return "That address is used by the site.";
  return null;
}

/** Rough reading time from the words in text-like blocks. */
export function readingMinutes(d: ArticleData): number {
  const words = d.blocks
    .map((b) => (b.type === "text" || b.type === "heading" ? b.text : b.type === "list" ? b.items.join(" ") : b.type === "faq" ? b.items.map((i) => `${i.q} ${i.a}`).join(" ") : ""))
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

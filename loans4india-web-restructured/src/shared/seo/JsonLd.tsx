/**
 * Structured data block. Content can come from the CMS, so the JSON is escaped for HTML:
 * "<", ">" and "&" become \u escapes, so text like "</script>" can never close the tag (stored XSS).
 * Use only for facts the page visibly shows (no ratings, prices or rates we don't publish).
 */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(data) }} />;
}

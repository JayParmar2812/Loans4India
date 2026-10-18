import Link from "next/link";
import { JsonLd } from "@/shared/seo/JsonLd";
import { absoluteUrl } from "@/shared/seo/metadata";

export type Crumb = { label: string; href: string };

/** Visible breadcrumb trail plus the matching BreadcrumbList structured data. "Home" is added automatically. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const all = [{ label: "Home", href: "/" }, ...items];
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-muted">
      <ol className="flex flex-wrap items-center gap-1.5">
        {all.map((c, i) => (
          <li key={c.href} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden>/</span>}
            {i === all.length - 1 ? <span aria-current="page" className="text-ink font-medium">{c.label}</span> : <Link href={c.href} className="hover:text-violet underline-offset-4 hover:underline">{c.label}</Link>}
          </li>
        ))}
      </ol>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: all.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.label, item: absoluteUrl(c.href) })),
        }}
      />
    </nav>
  );
}

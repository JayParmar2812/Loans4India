import { Breadcrumbs } from "@/shared/ui/Breadcrumbs";

/**
 * Trust and legal pages. `draft` keeps the review banner until counsel signs the wording off (Platform Flow v4, section 50).
 */
export function LegalPage({ title, path, updated, draft = true, children }: { title: string; path: string; updated: string; draft?: boolean; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: title, href: path }]} />
      {draft && (
        <p className="rounded-xl bg-warn-soft text-warn border border-warn/30 px-4 py-3 text-sm mt-6" role="note">
          Draft for legal review. Not final. Replace before public launch.
        </p>
      )}
      <h1 className="mt-6 text-4xl sm:text-5xl font-extrabold">{title}</h1>
      <p className="text-sm text-muted mt-2">Last updated: {updated}</p>
      <div className="mt-8 prose-l4i !max-w-none text-[1.02rem]">{children}</div>
    </article>
  );
}

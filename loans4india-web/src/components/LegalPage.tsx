export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <p className="rounded-xl bg-amber-50 text-amber-900 border border-amber-200 px-4 py-3 text-sm mb-8">
        Draft for legal review. Not final. Replace before public launch.
      </p>
      <h1 className="text-4xl font-extrabold text-violet-deep">{title}</h1>
      <p className="text-sm text-muted mt-2">Last updated: {updated}</p>
      <div className="mt-8 space-y-5 text-[1.02rem] leading-relaxed [&_h2]:text-2xl [&_h2]:font-extrabold [&_h2]:text-ink [&_h2]:mt-10 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1">
        {children}
      </div>
    </article>
  );
}

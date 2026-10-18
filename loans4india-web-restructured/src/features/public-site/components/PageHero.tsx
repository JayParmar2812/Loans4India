import { Breadcrumbs, type Crumb } from "@/shared/ui/Breadcrumbs";

/** Top of every inner public page: breadcrumbs, eyebrow, H1, intro, optional actions. */
export function PageHero({ crumbs, eyebrow, title, intro, children }: { crumbs: Crumb[]; eyebrow?: string; title: string; intro?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <section className="hero-wash border-b border-line">
      <div className="mx-auto max-w-6xl px-4 pt-6 pb-10 sm:pb-14">
        <Breadcrumbs items={crumbs} />
        {eyebrow && <p className="eyebrow mt-6">{eyebrow}</p>}
        <h1 className={`${eyebrow ? "mt-2" : "mt-6"} text-3xl sm:text-5xl font-extrabold max-w-3xl`}>{title}</h1>
        {intro && <div className="mt-4 text-lg text-muted max-w-2xl">{intro}</div>}
        {children && <div className="mt-6 flex flex-wrap gap-3">{children}</div>}
      </div>
    </section>
  );
}

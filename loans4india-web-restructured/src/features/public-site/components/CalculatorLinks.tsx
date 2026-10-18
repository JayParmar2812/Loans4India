import Link from "next/link";
import { CALCULATORS } from "@/features/public-site/content/calculators";
import { Icon } from "@/shared/ui/Icon";

/** Cards linking to the calculators (all, or all but the current one). */
export function CalculatorLinks({ except, heading = "Other calculators" }: { except?: string; heading?: string | null }) {
  const list = CALCULATORS.filter((c) => c.href !== except);
  return (
    <section aria-label={heading ?? "Calculators"}>
      {heading && <h2 className="text-2xl font-extrabold mb-5">{heading}</h2>}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {list.map((c) => (
          <li key={c.href}>
            <Link href={c.href} className="card h-full p-5 flex flex-col gap-3 hover:border-violet transition-colors group">
              <span className="grid place-items-center size-10 rounded-xl bg-mint-soft text-mint-deep"><Icon name={c.icon} /></span>
              <span className="font-display font-bold text-lg group-hover:text-violet">{c.title}</span>
              <span className="text-sm text-muted">{c.short}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

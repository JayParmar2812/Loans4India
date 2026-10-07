import Link from "next/link";

/** Switch between the two parts of the master admin's Website screen. */
export function SiteTabs({ current }: { current: "content" | "flow" }) {
  const tab = (active: boolean) => `rounded-full px-4 py-1.5 text-sm font-semibold ${active ? "bg-violet text-white" : "border border-line text-violet"}`;
  return (
    <nav className="flex gap-2" aria-label="Website screens">
      <Link href="/admin/site" className={tab(current === "content")} aria-current={current === "content" ? "page" : undefined}>Website content</Link>
      <Link href="/admin/site/flow" className={tab(current === "flow")} aria-current={current === "flow" ? "page" : undefined}>Loan types, form and documents</Link>
    </nav>
  );
}

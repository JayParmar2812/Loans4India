import Link from "next/link";
import { brand } from "@/config/brand";

/** The wordmark comes from the Website screen (Look); the first part is ink, the second in the main colour. */
export function Logo({ inverted = false, wordmark = brand.wordmark }: { inverted?: boolean; wordmark?: readonly [string, string] }) {
  return (
    <Link href="/" aria-label={`${brand.name} home`} className="inline-flex items-center gap-2">
      <span
        aria-hidden
        className="grid place-items-center size-9 rounded-xl bg-violet text-white font-display font-extrabold text-lg leading-none"
      >
        ₹
      </span>
      <span className={`font-display font-extrabold text-[1.45rem] tracking-tight ${inverted ? "text-white" : "text-violet-deep"}`}>
        {wordmark[0]}
        {wordmark[1] && <span className={inverted ? "text-mint" : "text-violet"}>{wordmark[1]}</span>}
      </span>
    </Link>
  );
}

import Image from "next/image";
import Link from "next/link";
import { brand } from "@/shared/config/brand";

/** The supplied Mint Smile logo, unchanged. It sits on white or very light surfaces only. */
export function Logo({ className = "h-9 w-auto", href = "/", priority = false }: { className?: string; href?: string | null; priority?: boolean }) {
  const img = <Image src={brand.logo.src} width={brand.logo.width} height={brand.logo.height} alt={brand.name} className={className} priority={priority} unoptimized />;
  return href ? (
    <Link href={href} aria-label={`${brand.name} home`} className="inline-flex items-center shrink-0">
      {img}
    </Link>
  ) : (
    img
  );
}

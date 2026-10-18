import { PublicChrome } from "@/features/public-site/components/PublicChrome";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <PublicChrome>{children}</PublicChrome>;
}

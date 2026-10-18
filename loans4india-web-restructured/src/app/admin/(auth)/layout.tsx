import { Logo } from "@/shared/ui/Logo";

export const dynamic = "force-dynamic";
export const metadata = { title: { default: "Staff sign-in", template: "%s · Loans4India staff" }, robots: { index: false, follow: false } };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className="min-h-dvh hero-wash grid place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6"><Logo href={null} className="h-10 w-auto" priority /></div>
        <div className="card p-6 sm:p-8">{children}</div>
        <p className="mt-6 text-center text-xs text-muted">Staff only. Every sign-in and action is recorded.</p>
      </div>
    </main>
  );
}

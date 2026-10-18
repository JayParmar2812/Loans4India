import Link from "next/link";
import { PageHero } from "@/features/public-site/components/PageHero";
import { pageMetadata } from "@/shared/seo/metadata";
import { brand } from "@/shared/config/brand";
import { Icon, type IconName } from "@/shared/ui/Icon";

export const metadata = pageMetadata({
  title: "How it works: from application to the bank's decision",
  description: `What happens at each step when you apply through ${brand.name}: consent, documents, our review, submission to one partner bank, and the bank's decision.`,
  path: "/how-it-works",
});

// Platform Flow v4, sections 4-23, in the applicant's words.
const STEPS: { title: string; who: string; body: string; icon: IconName }[] = [
  { title: "Start and confirm your mobile", who: "You", icon: "phone", body: "Pick the loan and amount, and enter your mobile. A one-time code proves the number is yours. There's no password to remember." },
  { title: "Read and agree to one consent", who: "You", icon: "shield", body: "One short screen says who we are, what we collect, which partner banks may receive your application, and your rights. Nothing personal is asked before you agree. Marketing is a separate, optional tick." },
  { title: "Fill in your details once", who: "You", icon: "user", body: "One form, in short sections, saved as you go. It asks only what your loan type and the banks need. A salaried applicant never sees business questions." },
  { title: "Upload your documents", who: "You", icon: "file", body: "A checklist for your loan type. Each file is checked, virus-scanned and stored encrypted. You can replace a file until you submit." },
  { title: "We review your file", who: `${brand.name}`, icon: "people", body: "A named person checks that documents are readable, current and consistent with your details. If something needs fixing, you get a clear request; only that item opens for editing. This is a quality check, not a credit decision." },
  { title: "We pick one partner bank", who: `${brand.name}`, icon: "bank", body: "From the banks you agreed to, we keep only those with an active agreement whose published sourcing rules your file fits, then choose one and record why. A second person must approve the package before it goes anywhere." },
  { title: "Your application goes to the bank", who: `${brand.name}`, icon: "arrow", body: "An authorised person on our team enters your application on the bank's own system. You get a message naming the bank once it has your application." },
  { title: "The bank decides", who: "The bank", icon: "check", body: "The bank does its own checks (including KYC and credit), may contact you directly, and decides. We show you only what the bank has confirmed, in plain words." },
];

const NEVER = [
  "Charge you any fee, at any stage",
  "Lend money, approve, sanction or set your rate",
  "Pull your credit report",
  "Send your data to a bank you didn't agree to",
  "Show you a bank status the bank hasn't confirmed",
  "Store your full Aadhaar number",
];

export default function HowItWorks() {
  return (
    <>
      <PageHero
        crumbs={[{ label: "How it works", href: "/how-it-works" }]}
        eyebrow="Clear at every step"
        title="How applying through Loans4India works"
        intro={`You apply once. We prepare your file properly and submit it to one suitable partner bank. The bank alone decides. Here's exactly who does what.`}
      >
        <Link href="/apply" className="btn-primary">Start your application</Link>
        <Link href="/calculators" className="btn-ghost">Try the calculators first</Link>
      </PageHero>

      <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16 space-y-16">
        <ol className="relative space-y-5 before:absolute before:left-[1.35rem] before:top-2 before:bottom-2 before:w-0.5 before:bg-line" aria-label="Steps">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative flex gap-4 sm:gap-6">
              <span className="relative z-10 grid place-items-center size-11 shrink-0 rounded-full bg-white border-2 border-mint text-mint-deep"><Icon name={s.icon} /></span>
              <div className="card flex-1 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-muted num">Step {i + 1}</span>
                  <span className={`chip ${s.who === "You" ? "bg-violet-soft text-violet-deep" : s.who === "The bank" ? "bg-warn-soft text-warn" : "bg-mint-soft text-mint-ink"}`}>{s.who}</span>
                </div>
                <h2 className="mt-1 text-lg sm:text-xl font-extrabold">{s.title}</h2>
                <p className="mt-1 text-muted">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <section className="grid gap-6 md:grid-cols-3" aria-labelledby="who-h">
          <h2 id="who-h" className="sr-only">Who decides what</h2>
          {[
            { who: "You decide", what: "whether to apply, what to share, and whether to accept the bank's offer. You can withdraw or revoke consent any time." },
            { who: "We decide", what: "how to prepare your file and which one of your consented banks to send it to, with a recorded reason and a second-person check." },
            { who: "The bank decides", what: "whether to lend, how much, at what rate and on what terms. It must show you a Key Fact Statement before you sign." },
          ].map((c) => (
            <div key={c.who} className="card p-6">
              <h3 className="text-xl font-extrabold">{c.who}</h3>
              <p className="mt-2 text-muted">{c.what}</p>
            </div>
          ))}
        </section>

        <section className="rounded-3xl bg-violet-soft p-6 sm:p-10 grid gap-6 md:grid-cols-[1fr_1.4fr] items-start">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-violet-deep">What we never do</h2>
            <p className="mt-2 text-muted">These boundaries are built into the platform, not just written in a policy.</p>
          </div>
          <ul className="grid sm:grid-cols-2 gap-3">
            {NEVER.map((n) => (
              <li key={n} className="flex gap-2 rounded-xl bg-white p-3 text-sm font-semibold"><span aria-hidden className="text-danger font-bold">✕</span>{n}</li>
            ))}
          </ul>
        </section>

        <section className="text-center space-y-4">
          <h2 className="text-2xl sm:text-3xl font-extrabold">Ready when you are</h2>
          <p className="text-muted">It takes a couple of minutes to start, and you can finish later.</p>
          <Link href="/apply" className="btn-primary">Start your application</Link>
        </section>
      </div>
    </>
  );
}

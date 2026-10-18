/**
 * Synthetic data for MVP1 walkthroughs (Platform Flow v4, section 52: "10 synthetic cases").
 *   npm run seed:synthetic
 * Refuses to run in production or with DATA_MODE=live. Only adds records (never edits or deletes existing ones);
 * every applicant is clearly synthetic (name starts with "Synthetic", mobiles 90000 00xxx, PANs ZZZZZ….).
 * Also creates four staff logins (temporary passwords printed once; each sets up an authenticator at first sign-in)
 * and three educational guide drafts waiting for approval (never published by the seed).
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { prisma } from "@/shared/db/db";
import { hashPassword } from "@/shared/security/password.server";
import { saveEncrypted } from "@/shared/storage/storage.server";
import { readLiveFlow as getLiveFlow, openLoanTypes } from "@/features/applicant-flow/server/applicantFlow.server";
import { appFlow, appFlowFrom, checklistFor } from "@/features/applicant-flow/config/applicantFlow";
import { consentNotice } from "@/features/consent/domain/consent";
import { recordConsent } from "@/features/consent/server/consent.server";
import { saveDetails } from "@/features/applications/server/details.server";
import { freezeSnapshot, intakeChecks } from "@/features/applications/server/applicant.server";
import { newReference } from "@/features/apply/domain/reference";
import { readSiteContent as getSiteContent } from "@/features/site-control/server/siteContent.server";
import { createArticle, requestReview } from "@/features/cms/server/articles.server";
import type { ArticleData } from "@/features/cms/domain/article";
import type { Role } from "@/features/staff/domain/rbac";

const SEED = "system:seed";
const NAMES = ["Asha Rao", "Ravi Kumar", "Meera Iyer", "Kabir Shah", "Nisha Verma", "Arjun Mehta", "Priya Nair", "Vikram Joshi", "Sana Khan", "Dev Patel"];

type Plan = { n: number; product: "PERSONAL_LOAN" | "BUSINESS_LOAN"; stage: "FILLING" | "SUBMITTED" | "ACTION" | "WITHDRAWN"; city: string; pin: string; income: number };
const PLANS: Plan[] = [
  { n: 1, product: "PERSONAL_LOAN", stage: "FILLING", city: "Pune", pin: "411001", income: 52000 },
  { n: 2, product: "PERSONAL_LOAN", stage: "FILLING", city: "Jaipur", pin: "302001", income: 31000 },
  { n: 3, product: "PERSONAL_LOAN", stage: "SUBMITTED", city: "Bengaluru", pin: "560001", income: 88000 },
  { n: 4, product: "PERSONAL_LOAN", stage: "SUBMITTED", city: "Delhi", pin: "110001", income: 64000 },
  { n: 5, product: "PERSONAL_LOAN", stage: "SUBMITTED", city: "Chennai", pin: "600001", income: 47000 },
  { n: 6, product: "BUSINESS_LOAN", stage: "SUBMITTED", city: "Ahmedabad", pin: "380001", income: 120000 },
  { n: 7, product: "PERSONAL_LOAN", stage: "ACTION", city: "Mumbai", pin: "400001", income: 75000 },
  { n: 8, product: "BUSINESS_LOAN", stage: "ACTION", city: "Surat", pin: "395003", income: 90000 },
  { n: 9, product: "PERSONAL_LOAN", stage: "WITHDRAWN", city: "Lucknow", pin: "226001", income: 40000 },
  { n: 10, product: "PERSONAL_LOAN", stage: "SUBMITTED", city: "Hyderabad", pin: "500001", income: 58000 },
];

const STAFF: { username: string; role: Role; name: string }[] = [
  { username: "synth-ops", role: "OPS_MANAGER", name: "Synthetic Ops Manager" },
  { username: "synth-exec", role: "OPS_EXECUTIVE", name: "Synthetic Loan Ops Executive" },
  { username: "synth-compliance", role: "COMPLIANCE", name: "Synthetic Compliance" },
  { username: "synth-editor", role: "CONTENT_EDITOR", name: "Synthetic Content Editor" },
];

async function seedStaff() {
  for (const s of STAFF) {
    if (await prisma.staffAccount.findUnique({ where: { username: s.username } })) continue;
    const pw = randomBytes(12).toString("base64url");
    await prisma.staffAccount.create({ data: { ...s, banks: "[]", passwordHash: await hashPassword(pw), passwordChangedAt: new Date(), createdBy: SEED } });
    await prisma.adminEvent.create({ data: { type: "STAFF_CREATED", actor: SEED, target: s.username, detail: JSON.stringify({ role: s.role }) } });
    console.log(`staff ${s.username.padEnd(17)} ${s.role.padEnd(15)} temporary password: ${pw}`);
  }
}

async function seedApplications() {
  const site = await getSiteContent();
  const live = await getLiveFlow();
  const open = new Set(openLoanTypes(site, live.flow).map((l) => l.id));
  let created = 0;
  for (const p of PLANS) {
    const mobile = `90000${String(p.n).padStart(5, "0")}`;
    if (!open.has(p.product)) { console.log(`skip #${p.n}: ${p.product} is switched off`); continue; }
    if (await prisma.loanApplication.findFirst({ where: { mobile, product: p.product } })) continue;
    const notice = consentNotice(p.product, live.flow);
    let reference = newReference();
    while (await prisma.loanApplication.findUnique({ where: { reference } })) reference = newReference();
    const app = await prisma.$transaction(async (tx) => {
      const a = await tx.loanApplication.create({
        data: {
          reference, stage: "ENQUIRY", product: p.product, flow: JSON.stringify(appFlowFrom(live.flow, live.version, p.product)), flowVersion: live.version,
          loanAmount: p.product === "BUSINESS_LOAN" ? 1500000 : 300000 + p.n * 50000, mobile, source: ["google", "direct", "meta", "referral"][p.n % 4], lastApplicantAt: new Date(),
        },
      });
      await tx.applicationEvent.create({ data: { applicationId: a.id, type: "CREATED", actor: "customer", detail: JSON.stringify({ stage: "ENQUIRY", synthetic: true }) } });
      await recordConsent(tx, a.id, notice, { required: true, marketing: p.n % 3 === 0 }, { ip: `192.0.2.${p.n}`, userAgent: "synthetic-seed" });
      await tx.loanApplication.update({ where: { id: a.id }, data: { stage: "PROFILE_IN_PROGRESS" } });
      await tx.applicationEvent.create({ data: { applicationId: a.id, type: "CONSENT_GIVEN", actor: "customer", detail: JSON.stringify({ from: "ENQUIRY", to: "PROFILE_IN_PROGRESS" }) } });
      return a;
    });
    const salaried = p.product === "PERSONAL_LOAN";
    const fields: Record<string, unknown> = {
      fullName: `Synthetic ${NAMES[p.n - 1]}`, dob: `19${88 + (p.n % 8)}-0${1 + (p.n % 9)}-15`, gender: p.n % 2 ? "FEMALE" : "MALE", email: `synthetic${p.n}@example.test`,
      addressLine: `${p.n} Test Street, Sample Nagar`, city: p.city, pincode: p.pin, residenceType: "RENTED", yearsAtAddress: 3,
      employmentType: salaried ? "SALARIED" : "SELF_EMPLOYED_BUSINESS", employerName: salaried ? "Example Tech Pvt Ltd" : "Example Traders", designation: salaried ? "Analyst" : "Wholesale trade",
      workYears: 4, ...(salaried ? { monthlyIncome: p.income, salaryMode: "BANK_TRANSFER" } : { annualIncome: p.income * 12, gstRegistered: "NO" }),
      existingEmi: p.n % 4 === 0 ? 8000 : 0, primaryBankName: "Example Bank", tenureMonths: 36, purpose: salaried ? "MEDICAL" : "WORKING_CAPITAL",
      pan: `ZZZZZ${String(1000 + p.n)}Z`,
    };
    if (p.stage !== "FILLING" || p.n === 1) {
      const r = await saveDetails(app.id, fields, "customer", "all");
      const errs = Object.entries(r?.errors ?? {});
      if (errs.length) console.log(`#${p.n} details not accepted: ${errs.map(([k, v]) => `${k}: ${v}`).join("; ")}`);
    }
    if (p.stage === "FILLING") { created++; continue; }

    // Synthetic documents: tiny placeholder PDFs, encrypted like real uploads.
    const fresh = await prisma.loanApplication.findUniqueOrThrow({ where: { id: app.id } });
    for (const slot of checklistFor(appFlow(fresh), fresh.employmentType).filter((s) => s.required)) {
      const key = await saveEncrypted(Buffer.from(`%PDF-1.4\n% Synthetic ${slot.id} for ${reference}\n%%EOF\n`));
      await prisma.applicationDocument.create({ data: { applicationId: app.id, slot: slot.id, originalName: `${slot.id.toLowerCase()}-synthetic.pdf`, mimeType: "application/pdf", sizeBytes: 64, sha256: randomBytes(32).toString("hex"), storageKey: key, scanResult: "SKIPPED_DEV" } });
    }
    await prisma.$transaction(async (tx) => {
      await tx.loanApplication.update({ where: { id: app.id }, data: { stage: "VERIFICATION_REVIEW", submittedAt: new Date(), declarationAt: new Date() } });
      await freezeSnapshot(tx, app.id, "SUBMITTED");
      await tx.applicationEvent.create({ data: { applicationId: app.id, type: "SUBMITTED", actor: "customer", detail: JSON.stringify({ from: "PROFILE_IN_PROGRESS", to: "VERIFICATION_REVIEW", declaration: true }) } });
      await intakeChecks(tx, app.id);
      if (p.stage === "ACTION") {
        await tx.applicationTask.create({ data: { applicationId: app.id, slots: JSON.stringify(["SALARY_SLIPS"]), fields: "[]", reasonCode: "BLURRY", message: "Please upload a clearer copy of your latest salary slip; the one we have is hard to read.", createdBy: "staff:synth-exec" } });
        await tx.loanApplication.update({ where: { id: app.id }, data: { stage: "ACTION_NEEDED" } });
        await tx.applicationEvent.create({ data: { applicationId: app.id, type: "STAGE_CHANGED", actor: "staff:synth-exec", detail: JSON.stringify({ from: "VERIFICATION_REVIEW", to: "ACTION_NEEDED" }) } });
      }
      if (p.stage === "WITHDRAWN") {
        await tx.loanApplication.update({ where: { id: app.id }, data: { stage: "CLOSED", closedReason: "WITHDRAWN", closedAt: new Date() } });
        await tx.applicationEvent.create({ data: { applicationId: app.id, type: "CLOSED", actor: "customer", detail: JSON.stringify({ from: "VERIFICATION_REVIEW", to: "CLOSED", reason: "WITHDRAWN" }) } });
      }
    });
    created++;
  }
  console.log(`applications created: ${created}`);
}

const g = (title: string, excerpt: string, blocks: ArticleData["blocks"]): ArticleData => ({
  title, excerpt, category: "GUIDE", blocks, breadcrumb: "", related: [],
  seo: { title: "", description: excerpt.slice(0, 160), canonical: "", noindex: false, image: "", imageAlt: "" },
});

/** Educational drafts. They wait for Compliance approval; the seed never publishes. */
const GUIDES: { slug: string; data: ArticleData }[] = [
  {
    slug: "documents-for-a-personal-loan",
    data: g("Documents you need for a personal loan", "A checklist of the documents banks usually ask for with a personal loan application, and how to get each one ready.", [
      { type: "text", text: "Banks need to confirm who you are, where you live and how you earn. Having these documents ready, clear and complete is the single biggest thing you can do to avoid delays." },
      { type: "heading", text: "Identity and address" },
      { type: "list", items: ["PAN card", "Aadhaar, as a masked copy that shows only the last 4 digits (download it from the UIDAI website)", "Address proof if your current address is different from your Aadhaar"] },
      { type: "heading", text: "Income (salaried)" },
      { type: "list", items: ["Recent salary slips (often the last 3 to 6 months)", "Bank statements of the account your salary is paid into (often 6 months)", "Form 16, if the bank asks"] },
      { type: "heading", text: "Tips" },
      { type: "list", items: ["Upload clear, complete scans: every page, nothing cut off", "Use statements downloaded from your bank, not edited copies", "If a statement PDF has a password, save a copy without it before uploading"] },
      { type: "text", text: "Each bank sets its own list, so your application shows the exact checklist for your loan type." },
    ]),
  },
  {
    slug: "how-emi-works",
    data: g("How EMI works, and why early EMIs are mostly interest", "What an EMI is, how it is calculated on a reducing balance, and how tenure and prepayment change what you pay in total.", [
      { type: "text", text: "An EMI (equated monthly instalment) is the fixed amount you repay every month. Each EMI covers that month's interest and repays part of the loan." },
      { type: "heading", text: "Reducing balance" },
      { type: "text", text: "Interest is charged on the amount you still owe. At the start you owe the most, so more of each EMI goes to interest. As the balance falls, more of each EMI repays the loan itself." },
      { type: "heading", text: "Tenure changes the total cost" },
      { type: "text", text: "A longer tenure lowers the EMI, but you pay interest for longer, so the total interest goes up. Choose the shortest tenure whose EMI you can comfortably manage." },
      { type: "emi" },
    ]),
  },
  {
    slug: "key-fact-statement-explained",
    data: g("Reading a Key Fact Statement (KFS)", "What the Key Fact Statement a bank gives you before you sign a loan contains, and what to check in it.", [
      { type: "text", text: "Before you accept a loan, the bank must give you a Key Fact Statement: a short, standard summary of the loan's cost and terms. It is the bank's document, not ours." },
      { type: "heading", text: "What to check" },
      { type: "list", items: ["Loan amount and tenure", "Interest rate and whether it is fixed or floating", "All fees and charges, including processing fees and insurance", "APR: the all-in yearly cost, which lets you compare loans fairly", "Prepayment and foreclosure charges", "The bank's grievance contact"] },
      { type: "text", text: "If something isn't clear, ask the bank before you sign. Questions about rates and fees go to the bank." },
    ]),
  },
];

async function seedGuides() {
  for (const x of GUIDES) {
    if (await prisma.article.findUnique({ where: { slug: x.slug } })) continue;
    const a = await createArticle(x.slug, x.data, SEED);
    await requestReview(a.id, SEED);
    console.log(`guide draft waiting for approval: /guides/${x.slug}`);
  }
}

async function main() {
  if (process.env.NODE_ENV === "production" || process.env.DATA_MODE === "live") throw new Error("Refusing to seed synthetic data in production or live mode.");
  await seedStaff();
  await seedApplications();
  await seedGuides();
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

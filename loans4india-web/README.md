# LoansForIndia — customer website (Phase 1: acquisition)

Next.js 16 · TypeScript · Tailwind CSS 4 · Prisma 7 (SQLite locally, Postgres later) · Zod

## What's here

The platform follows **Loans4India — Platform Flow v4 (Source of Truth)**: manual-first, one bank per application, staff do the bank-portal entry by hand. Gaps against v4 are tracked in `specs/platform-flow-v4-gaps.md` in the project files.

| Area | Path |
| --- | --- |
| Homepage with a quick estimate (never an approval) | `/` |
| Product pages | `/personal-loan`, `/business-loan` |
| EMI calculator + quick estimate | `/emi-calculator` |
| Start: loan amount + mobile → consent naming each partner bank | `/apply` → `POST /api/applications` |
| Applicant's application: tracker, details form (autosave), documents, submit with declaration, Action needed tasks, re-consent, withdraw | `/documents/<secret link>` → `/api/documents/...` |
| Control tower: queues (new, mine, files to review, pick a bank, gate, ready, with bank, stale, checks due, exceptions), SLA colours, owners | `/admin` |
| Case workspace: review, tasks, flags, hold, bank selection, package checklist, Ready-for-Bank gate, operator portal entry with evidence, bank updates with second-person check, re-route or close, timeline incl. messages to send | `/admin/applications/<id>` |
| Counts-only CSV (no personal data) | `/admin/export` |
| Draft legal pages | `/about`, `/privacy`, `/terms`, `/grievance` |

Brand name, contacts and the "partners live" switch are in **`src/config/brand.ts`**. Partner banks, their sourcing rules and field templates are in **`src/config/banks.ts`** (only TEST banks until a DSA agreement is signed). Roles and permissions are in **`src/lib/rbac.ts`**.

## Run it on your computer (Windows)

Requires **Node.js 20.9+** (22 LTS recommended).

```powershell
cd loans4india-web
copy .env.example .env        # then set STAFF_USERS (or ADMIN_PASSWORD)
npm install                   # also generates the Prisma client
npx prisma migrate deploy     # creates or upgrades dev.db from prisma/migrations
npm run dev
```

Open http://localhost:3000. Staff area: http://localhost:3000/admin (user/password from `.env`).

### Master admin

The **Super Admin** role is the master admin. It can do every action of every other role, on every case and every bank. It also has two screens of its own:

- **Staff** (`/admin/staff`): add people, change their role, name and bank portal logins, set a new password, or disable a login. Accounts in `STAFF_USERS` show there but can only be changed in `.env`, so the master admin can't be locked out.
- **Activity** (`/admin/activity`): every case event, staff change and website change, newest first, filterable by person.
- **Website** (`/admin/site`): switch home sections, loan pages, the EMI calculator, an announcement banner and new applications on or off; edit, add, remove and reorder the site's text, menu and footer. It also builds extra pages from blocks (heading, text, image, list, questions, call to action, EMI calculator) at an address you choose, with drafts visible only through Preview; keeps an image library (JPG, PNG or WebP up to 2 MB, served from `/site-assets/<id>`); and sets the look (four brand colours checked for readable contrast, heading font, logo text). Saving publishes at once and keeps a version you can restore ("Original site" puts back the defaults in `src/config/siteContent.ts`). The "not a lender" notices, consent screen and legal pages are fixed, and text saying "eligible", "guaranteed" or "pre-approved" is refused.
- **Loan types, form and documents** (`/admin/site/flow`, the second tab of Website): add loan types (each follows the personal or business form, with its own amount range), switch them on or off, and pick the partner banks that cover each one (a coverage change gives the consent screen a new bank-list version, so older consents show as outdated); rename, hide or require form fields and add your own questions (text, number, yes/no, choice), which staff see on the case; and edit each loan type's document checklist per way of earning, including new document types. Each application keeps the form, questions and checklist it started with (`LoanApplication.flow`), so a change reaches new applications only. Name, date of birth, PAN, loan amount and how they earn are always asked; PAN and masked Aadhaar stay required on every checklist with their standard wording; a loan type with applications can be switched off but not removed. Defaults are in `src/config/applicantFlow.ts`.

The two-person checks still apply to the master admin on a case: they can't approve a package they prepared, confirm a bank update they recorded, or enter a package they prepared.

## Documents

After the form, the applicant lands on a private upload page (`/documents/<token>`, valid 30 days and re-issued by staff from the case; only a hash of the token is stored). The checklist depends on the loan type and is defined in **`src/lib/documents.ts`**:

- **Salaried personal loan:** PAN, masked Aadhaar, 6 months' salary slips, 6-month salary-account statement (current address proof, Form 16, existing loans, photo optional)
- **Self-employed personal loan:** PAN, masked Aadhaar, 2 years' ITR, 12-month bank statement, business/profession proof (current address proof, existing loans, photo optional)
- **Business loan:** PAN, masked Aadhaar, business registration (GST/Udyam/Shop Act), business address proof, 2 years' ITR, 2 years' financials, 12-month current-account statement (GST returns, business PAN, firm/company documents incl. partners'/directors' KYC, current address proof, existing loans, photo optional)

Each file is checked by its real contents (PDF/JPG/PNG only, ≤10 MB, no password-protected PDFs), virus-scanned, encrypted (AES-256-GCM) and stored under a random name in `./storage` (never in `public/`). Aadhaar is accepted only as a masked copy. Staff open documents through `/admin` (every view is logged), accept them or ask for a replacement with a reason; the applicant sees an Action needed task on the same link that unlocks only that document.

### From review to the bank (v4 sections 12-23)

1. **Assign** one owner (Ops Manager). Intake checks only raise flags (duplicate PAN or mobile, many applications from one network); a person decides.
2. **Review**: accept each file, ask to replace it (opens an Action needed task that unlocks only that document), or flag suspected tampering (case goes on hold; the applicant isn't told). Then **Pass review**.
3. **Pick one bank** from those that pass three filters: the applicant consented to it, its agreement is active, and its published sourcing rules fit. Record why.
4. **Prepare**: the bank's field template is filled from the application. A missing value is fixed by asking the applicant, never typed in. **Send to gate**.
5. **Gate**: a second person runs eight checks and approves. The package (fields, documents, template version) is frozen with a hash.
6. **Portal entry**: an Authorised DSA Operator holding that bank's portal login downloads the entry sheet, enters it on the bank portal, and records the bank reference with a screenshot and an attestation. If anything changed since approval, the case goes back to preparation.
7. **Bank updates** are recorded only from evidence (MIS, bank email, portal screenshot). In-principle, sanction and disbursal count only after a second person confirms. After a rejection, re-route to another consented bank only for a bank-specific reason, at most twice; otherwise close.

No SMS/email provider is connected yet: messages to the applicant appear in the case timeline as "message to send by hand".

Environment (see `.env.example`):
- `DOCUMENT_ENCRYPTION_KEY`: required in production (`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`). Development falls back to a fixed dev-only key.
- `CLAMSCAN_PATH`: path to ClamAV. Required in production (uploads are refused without it). In `npm run dev` uploads are accepted and marked "not virus-scanned (dev)".

## Data model (prisma/schema.prisma)

- **LoanApplication**: everything a customer starts. Application state (`stage`): ENQUIRY → CONSENT_PENDING → PROFILE_IN_PROGRESS → DOCUMENTS_PENDING → VERIFICATION_REVIEW ⇄ ACTION_NEEDED → APPLICATION_PREPARATION → INTERNAL_REVIEW → READY_FOR_BANK → SUBMITTED_TO_BANK → CLOSED (with a close reason), plus a separate hold. PAN and account number are encrypted.
- **ApplicationSnapshot**: frozen copy of what was submitted (and each Action needed response), with a content hash.
- **ApplicationTask / ApplicationFlag**: Action needed tasks and duplicate/fraud flags.
- **BankAttempt**: one submission to one bank (selection, gate, frozen manifest and hash, bank reference, evidence).
- **BankStatusEvent**: bank-confirmed status, only from evidence; append-only with second-person checks.
- **ConsentRecord**: one append-only row per consent purpose, with the exact wording and version shown.
- **ApplicationEvent**: append-only activity trail (created, duplicate attempt, stage changed, notes, document uploaded/removed/viewed/accepted/rejected, submitted).
- **ApplicationDocument**: one uploaded file per row (slot, detected type, size, SHA-256, random storage key, status UPLOADED/ACCEPTED/REJECTED/REMOVED, scan result, reviewer).
- **BankShare**: older share links for bank sales officers. Switched off (`BANK_SHARE_LINKS_ENABLED` in `src/config/banks.ts`) because v4 sends documents only through portal entry.

Duplicate protection: one open application per mobile and product; the existing reference is never revealed.

## Before real customers use this

- [ ] Legal review of consent text (`src/lib/consent.ts`) and the draft legal pages
- [ ] Replace Basic-auth admin with staff accounts + MFA (PAM, Milestone 2)
- [ ] Move to Postgres (managed, India region) and set `DATABASE_URL`
- [ ] Real support phone, grievance officer, company name in `brand.ts`
- [ ] Mobile OTP verification (SMS provider) on the application
- [ ] Only set `partnersLive: true` and list lenders after DSA agreements are signed
- [ ] Final brand name (rename = edit `brand.ts` + logo)

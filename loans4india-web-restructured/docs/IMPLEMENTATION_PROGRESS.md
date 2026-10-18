# Implementation Progress

## Stage 1 — Discover and audit ✅ (18 Oct 2026)

- Read Platform Flow v4 in full (103 pages), the onboarding flow v3, both apps, the brand assets, the Finnable captures and live finnable.com.
- Baseline committed unchanged (`b51ac7d`) on branch `feat/mvp1-completion`.
- Baseline verification (actually run):
  - `prisma migrate status`: up to date.
  - `tsc --noEmit`: 0 errors.
  - `eslint`: 0 problems.
  - `next build`: success.
  - Tests: none exist.
- Artifacts: `IMPLEMENTATION_AUDIT.md`, `IMPLEMENTATION_PLAN.md`, `ROUTE_AND_FEATURE_INVENTORY.md`, `SECURITY_FINDINGS.md`.

Next: Stage 2 (tests, staff sessions + MFA, applicant OTP, headers, append-only triggers).

## Stage 2 — Stabilise and secure the foundation ✅ (18 Oct 2026)

**Done**
- **Staff auth (S1):** HTTP Basic replaced by:
  - `/admin/login` (password) → `/admin/mfa` (TOTP with QR enrolment)
  - DB sessions: 15 min idle, 12 h absolute; sign-out
  - lockout after 5 failures, generic errors
  - Argon2id passwords (S7)
  - sessions revoked on password, role, bank-access, MFA or disable changes
  - staff CLI (`npm run staff -- import-env | create | reset-password | reset-mfa | unlock | list`)
- **Applicant OTP (S2):**
  - `/api/otp/send`, `/api/otp/verify` and applicant sessions
  - apply flow: loan → verify mobile → consent → `/my/applications/<ref>`
  - `/my` dashboard and `/my/sign-in`
  - references authorise only with the owning session
  - SMS provider interface: console in dev and test, fails closed in production
- **Proxy:** nonce CSP and security headers (S3), plus a cookie gate for `/admin` and `/my`.
- **Data integrity:** append-only DB triggers (S4); `clientIp()` honours forwarded headers only with `TRUST_PROXY` (S5); shared rate limiter; Origin checks on cookie-authenticated POSTs.
- **Messages:** `queueMessage` now also writes a rendered `MessageLog` row (status QUEUED; the jobs runner sends it in Stage 5).
- **Schema** (migrations `mvp1_security_cms`, `append_only_triggers`, `staff_mfa_replay`):
  - new tables: StaffSession, OtpChallenge, ApplicantSession, MessageLog, SupportTicket(+Event), Article(+Revision), Redirect, PurgeLog
  - new fields: retention and legal hold on LoanApplication; draft/publish on SiteContentVersion
- **App shell:**
  - public chrome moved to a `PublicChrome` used by the public, applicant and bank-share groups
  - staff console in `admin/(console)` with tabbed navigation and a synthetic-data banner
  - `error.tsx` and `global-error.tsx`; the 404 now has site navigation
- **Brand groundwork:**
  - name changed to Loans4India; Mint Smile logo exported to `public/brand/` (WebP 9.6 KB)
  - colour tokens sampled from the logo (violet #3e1dc8, mint #36d49f); Plus Jakarta Sans for text, Mukta for Devanagari
  - `brand.siteUrl` comes from `NEXT_PUBLIC_SITE_URL`
- **Copy fixes (v4 §2):** default content no longer promises rates ("From ~10.5%"), turnaround or "compare lenders".
- **RBAC:**
  - new permissions: support.*, content.*, lender.view, compliance.manage, metrics.view
  - new Content Editor role
  - Finance, Support and Compliance scopes defined

**Verification (run 18 Oct 2026)**
- `tsc --noEmit`: 0 errors. `eslint`: 0 problems.
- `vitest run`: 5 files, 52 tests passed:
  - unit: TOTP RFC 6238 vector, open-redirect guard, Argon2id plus legacy scrypt, rate limiter, RBAC cannot-lists for all 11 roles, case scope
  - integration against a migrated SQLite copy: OTP verify/lockout/throttle; apply needs the same verified mobile; duplicate → existing; consent ledger; IDOR (another applicant gets 404 on GET, upload and withdraw); append-only via Prisma and raw SQL; staff password → MFA; TOTP replay refused; lockout plus generic errors; idle timeout, revocation and disabled accounts; role change ends sessions; actions refuse roles without permission
- `next build`: success.
- `next start` smoke test:
  - `/`, `/apply`, `/my/sign-in`, `/admin/login` → 200; `/admin` and `/my` → 307 to sign-in (with `next`); unknown path → 404
  - CSP and the other headers present; 34 of 34 executable scripts carry the nonce

**Action needed by the owner**
- `.env` `STAFF_USERS` is no longer a login. Run `npm run staff -- import-env` (or `npm run staff -- create <user> SUPER_ADMIN "<Name>"`), sign in, enrol an authenticator, then remove the passwords from `.env`.
- Website content saved before this change (4 versions in `dev.db`) still contains the old copy and theme. Publish fresh content from the Website screen, or restore "version 0 (original site)".

Next: Stage 3/4 (design system and public website).

## Stages 3–4: design system and public website ✅ (commit `f5c2f75`)

- **Design tokens:** sampled from the logo (`globals.css`). White/mint surfaces, violet accent, ink text on mint (AA contrast). Buttons have a 44 px minimum tap size, plus `card`, `chip` and `eyebrow` components. Motion is reduced when the user prefers it.
- **Shared UI:** Logo (supplied asset, unchanged), Icon set, Breadcrumbs (with BreadcrumbList), PageHero, CalculatorLinks, and calculator parts (slider + typed value, ResultPanel).
- **Home:** hero with the estimate card, a fixed trust strip ("No fee from you", "Not a lender", "Your consent, named banks", "Encrypted documents"), CMS sections restyled, and latest guides.
- **Calculators:**
  - EMI, with a year-by-year schedule
  - "How much can I borrow?" (the v4 §3 estimate, prefilling `/apply` through session storage)
  - affordability, and interest/tenure comparison
  - each page has a different explainer and its own FAQ
- **New pages:** how-it-works (who decides what, what we never do), FAQ hub by topic, contact form → support tickets, and rewritten privacy/terms/about/grievance (still drafts for legal review).
- **SEO:**
  - canonical, Open Graph and Twitter metadata on every public page; default OG image
  - Organization/WebSite, FAQPage, BreadcrumbList, WebApplication and Article structured data
  - sitemap from published, indexable content; robots blocks private areas
- **Copy compliance (v4 §2, §10):** removed rate promises, turnaround promises and "compare lenders/match" language from default content and the FAQ.

## Stage 7: CMS and SEO management ✅ (commits `f5c2f75`, `075964b`)

- **Guides:**
  - Structured blocks only (no HTML), with banned-claim guard.
  - Workflow: draft → review → **approval by someone other than the author** (Compliance or master admin), optionally scheduled. Editing never changes what's live.
  - Revision history with restore; unpublish.
  - Renaming a published guide creates a 308 redirect.
  - Per-guide SEO: title, description, same-site canonical, noindex, social image and alt, breadcrumb label, related guides.
  - Phone and desktop preview.
- **Redirects manager:** same-site only, private areas protected, loop and chain checks. Catch-all pages follow redirects before returning a 404.
- **Website screen:** saves now stamp `publishedAt`, and the live site reads the newest published version (groundwork for drafts on this screen; see remaining items).

## Stages 5–6: applicant journey completion and back office ✅ (commit `075964b`)

- **Jobs** (`npm run jobs`): dormancy, retention purge with legal hold and purge log, message dispatch with quiet hours, housekeeping.
- **Marketing opt-out:** one tap; appends to the consent ledger.
- **Back office:**
  - Insights: v4 §54 metrics with definitions. Bank-side metrics are labelled unavailable, never zero.
  - Support & data rights: queue with due dates and escalation to the Grievance Officer. Compliance resolves data rights, verified requesters only.
  - Lenders: read-only, with the v4 §47 go-live checklist showing no evidence.
  - Retention & holds: legal hold set and lifted by different people, purge schedule, purge log, message delivery log.
  - Support, Finance and Content Editor roles land on their own screens.
- **Synthetic seed:** 10 cases across stages, 4 staff, 3 guide drafts awaiting approval (never auto-published).

## Stage 8: verification (run 18 Oct 2026, final state)

- `tsc --noEmit`: 0 errors. `eslint`: 0 problems.
- `vitest run`: **9 files, 77 tests passed.** The end-to-end journey test covers:
  - the applicant path: OTP → consent → details (autosave API) → refused submit while documents are missing → uploads (a fake file type refused by its bytes) → idempotent submit
  - case handling: manager assigns, executive can't assign, another executive can't review, Action needed unlocks only the named slot, resubmission freezes snapshot v2
  - the gate: review passed, bank selected, sent to gate; executive and preparer refused; a different manager approves → READY_FOR_BANK with a package hash
  - what the applicant sees: tracker in plain words, bank name not shown
- `next build`: success, with 62 routes.
- `next start` smoke test:
  - all 19 public and auth routes → 200; unknown pages and guides → 404; `/my` and `/admin/*` → 307 to sign-in with `next`
  - `robots.txt` blocks the private areas; the sitemap lists public pages only
  - every page has a unique `<title>` and canonical; JSON-LD types match the page; private responses are `no-store` + `noindex`; the OG image renders
- **Mobile layout (CDP emulation at 390 px, 21 pages):** no horizontal overflow after fixing one (the FAQ topic nav, `min-w-0`). Screenshots were reviewed for home, apply and EMI.
- **Seed:** run against a scratch database (not `dev.db`) twice: 10 cases created, second run creates nothing (idempotent); jobs run cleanly.
- **Not run:** Lighthouse (not installed here) and a real-browser click-through of staff MFA (covered by integration tests instead).

## Remaining work (highest priority first)

1. **Owner actions:**
   - bootstrap the master admin (`npm run staff -- create …` or `import-env`)
   - republish website content (the saved versions in `dev.db` still carry the old name, old copy and old theme)
   - choose the final domain (`NEXT_PUBLIC_SITE_URL`)
2. **Website screen draft → preview → publish:** it still publishes on save. The schema and reader support drafts; the `SiteEditor` UI needs a "save as draft" button.
3. **Document expiry watcher** (v4 §7: salary slip 45 days, statement 30 days), and a step-up check (PAN/DOB) before data-rights actions in `/my`.
4. **Bank master editor and commission schedules** (v4 Phase 2, needs a signed agreement). Hindi translations (Phase 2).
5. **Production infrastructure** (see the README checklist): Postgres plus re-created triggers, KMS, object storage, ClamAV, a shared rate-limit store, an SMS provider.
6. **Lighthouse/axe audit in CI**, and dependency/secret scanning in CI (no CI exists in the repo yet).

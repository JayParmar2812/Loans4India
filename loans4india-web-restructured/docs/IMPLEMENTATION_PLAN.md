# Implementation Plan

Scope rule: **Platform Flow v4 MVP1** (sections 1–17, synthetic data, stops at Ready for Bank), plus the brief's public-site, CMS, SEO and security requirements. The baseline's Phase 2 code (portal entry, bank statuses) is kept and hardened, not extended into money flows.

Order follows the brief's priorities: correct workflow → security and integrity → completeness → UX → SEO/CMS → performance.

## Stage 2 — Stabilise and secure the foundation

1. **Tests.** Add Vitest. Unit tests for the domain modules (finance, rbac, gate, bank filters, consent state, tracker, SLA). Integration tests against a throw-away SQLite database built from the real migrations.
2. **Staff sessions + MFA (S1).** Replace HTTP Basic with:
   - A login page, Argon2id hashes (scrypt hashes verified and upgraded on login), and a DB-backed `StaffSession` (random token, only its hash stored).
   - An HttpOnly, SameSite=Strict, Secure cookie; 15-minute idle and 12-hour absolute timeouts; logout; sessions revoked on password, role or MFA change.
   - TOTP MFA (RFC 6238), required for every staff login, with enrolment on first sign-in.
   - Per-account and per-IP lockout or backoff.
   - `.env` staff become bootstrap-only: they seed the DB once and are never a parallel login path.
3. **Applicant OTP (S2).** `OtpChallenge` table storing only a hash: 6 digits, 5 minutes, 5 tries, 3 sends per mobile per 10 minutes, per-IP throttle.
   - An `SmsProvider` interface; the dev/test provider logs to the server console. **No real SMS without a DLT provider** (blocker documented).
   - Verifying the OTP creates an `ApplicantSession`. Application creation then requires a verified session for that mobile.
4. **Security headers (S3).** A nonce-based CSP set in `proxy.ts`, plus HSTS, `frame-ancestors 'none'`, nosniff, Referrer-Policy and Permissions-Policy.
5. **Append-only enforcement (S4).** SQLite triggers that abort UPDATE and DELETE on consent, audit, admin-event, snapshot and bank-status tables (`BankStatusEvent` allows only the one-time checker stamp). The purge job anonymises personal data on `LoanApplication` only.
6. **Trusted client IP (S5).** A shared `clientIp()` helper that honours `x-forwarded-for` only when `TRUST_PROXY=1`, and a shared `rateLimit()` helper.
7. **Synthetic-data mode (G15).** `DATA_MODE=synthetic` shows a banner in admin and on the apply form. A seed script creates synthetic applicants and staff.

## Stage 3 — Design system and brand

- Rename to **Loans4India** and use the supplied Mint Smile logo (optimised copy in `public/brand/`). Keep the domain configurable.
- Tokens: white and mint primary surfaces, violet accent; colours sampled from the logo. Keep Mukta for body text (Devanagari, ready for Hindi).
- Shared UI: Button, Card, Badge, Stepper, PageHeader, Section, Callout, EmptyState. Header and footer redesign (mobile-first at 360px).

## Stage 4 — Public website

- **Home:** phone-first start box and a 4-step "how it works" stepper (pattern from Finnable, in our own words); loan-purpose chips; trust block (no fee, not a lender, consent, privacy); calculators teaser; guides; FAQ.
- **Calculators hub** `/calculators` with EMI (amortisation table), quick estimate, affordability and interest calculators. All pure functions with tests.
- **Pages:** `/how-it-works`, `/faq` (tabbed by product, FAQPage JSON-LD), `/contact` (support form → ticket), `/guides` and `/guides/[slug]`, `error.tsx`, `global-error.tsx`.
- **SEO:**
  - Canonical URLs, OG/Twitter metadata and a generated OG image.
  - JSON-LD: Organization, WebSite, FAQPage, BreadcrumbList, Article. No ratings, prices or rates.
  - A sitemap built from published content; existing robots rules kept.

## Stage 5 — Applicant journey (v4 §4–10, 26, 41)

- **Apply:** loan and mobile → OTP → consent → application created. If an open application exists, the applicant goes to it (safe now that the mobile is verified).
- **`/my` dashboard (OTP sign-in):** applications and their status, open tasks, consent view, marketing opt-out, withdraw or revoke, data-rights request. The legacy token links keep working until expiry.
- **Jobs** (`npm run jobs`, cron-friendly):
  - Dormancy: reminder at 7 days; close as DORMANT at 30 days; ACTION_NEEDED closes at 15 days.
  - Retention purge per data class, with a purge log and legal hold.
  - Document expiry watcher.

## Stage 6 — Back office

- Staff login, MFA and session management screens; staff list shows MFA status.
- Support and grievance queue: tickets with category, SLA and outcome; data-rights requests with due dates (Compliance).
- Lenders page: read-only view of the bank master (TEST/LIVE/SUSPENDED/INACTIVE, products, template version, agreement). It states that a record is never a live partnership.
- Dashboard metrics from v4 §54 that are computable today: funnel, time to first review, time to Ready for Bank, gate send-back rate, document rejection rate. Labelled synthetic or real.
- Purge log and legal-hold controls for Compliance.

## Stage 7 — CMS and SEO management

- **Articles** (guides/blog): structured blocks reuse the validated block schema.
  - Workflow: DRAFT → IN_REVIEW → PUBLISHED / UNPUBLISHED, with optional scheduled publish.
  - Revision history and restore; author and approver attribution (approver ≠ author).
- **SEO fields per article and page:** title, description, canonical (same-site only), noindex, OG image and alt, breadcrumb label.
- **Redirects:** same-site paths only; no open redirects; loop guard.
- **Website content:** add a draft/preview/publish step on top of the existing versioning.

## Stage 8 — Verify

Typecheck, lint, unit and integration tests, production build, and an HTTP smoke test of every public route (status codes, canonical, sitemap, robots). Each result is recorded in `IMPLEMENTATION_PROGRESS.md` with real output.

## Explicitly not built (and why)

| Item | Reason |
| --- | --- |
| Commission engine, reconciliation, finance UI | v4 Phase 2. Needs signed schedules; computing money from invented rates is prohibited. |
| Live lender integrations, MIS import | No agreements or credentials exist. |
| Real SMS, WhatsApp or email delivery | Needs a DLT registration and provider contracts. The interface and logging provider are built. |
| PAN/name-match provider | Licensed provider not chosen (v4 decision 9). |
| Hindi translation | v4 §49: Phase 2. |
| Partner/affiliate portal | v4 Phase 3. |

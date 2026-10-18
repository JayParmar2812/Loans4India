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

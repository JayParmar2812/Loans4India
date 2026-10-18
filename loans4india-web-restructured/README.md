# Loans4India web platform (MVP1)

Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Prisma 7 (SQLite locally, Postgres later) · Zod · Vitest

Loans4India is a **loan sourcing service (Virtual Corporate DSA), not a lender**. This app follows **Platform Flow v4 (Source of Truth)**:
- an applicant applies once
- staff check the file and pick one consented partner bank
- a second person approves the package at the Ready-for-Bank gate
- an authorised operator enters it on the bank's portal
- bank status is recorded only from bank evidence

MVP1 runs on **synthetic data** with TEST banks only. Project documents are in `docs/`: audit, plan, route inventory, security findings and progress log.

## Run it locally (Windows)

Requires Node.js 24.7+ (Argon2id comes from Node's built-in `crypto`).

```powershell
cd loans4india-web-restructured
copy .env.example .env
npm install                           # also generates the Prisma client
npx prisma migrate deploy             # creates or upgrades dev.db
npm run staff -- create jp SUPER_ADMIN "JP"   # prints a temporary password once
npm run dev
```

- Staff: http://localhost:3000/admin. Sign in with the password, then scan the QR code with an authenticator app (TOTP). Every staff login needs MFA.
- Applicants: http://localhost:3000/apply. In development, OTP codes are printed in the server console. Production has **no SMS provider until DLT registration is done**, so OTP fails closed there.
- Synthetic walkthrough data (10 cases, 4 staff logins, 3 guide drafts): `npm run seed:synthetic`. It refuses to run in production or with `DATA_MODE=live`.

### Staff accounts (CLI)

`npm run staff -- import-env | create <user> <ROLE> "<Name>" | reset-password <user> | reset-mfa <user> | unlock <user> | list`

`STAFF_USERS` in `.env` is no longer a login. `import-env` copies it into the database once; afterwards, remove the passwords from `.env`.

### Background jobs

Schedule `npm run jobs` every 15 minutes (cron or Windows Task Scheduler). Each job is idempotent:
- **dormancy:** reminder after 7 idle days, close as DORMANT at 30 days; Action-needed reminders at 2 and 5 days, close at 15 days (before the bank stage only)
- **purge:** documents deleted at close + 90 days, personal details at close + 180 days, unless on legal hold; proof goes to `PurgeLog`
- **messages:** queued applicant messages sent outside quiet hours (09:00–21:00 IST); never marked SENT without a provider
- **housekeeping:** expired OTPs and sessions removed

### Checks

```powershell
npm run check     # tsc --noEmit && eslint && vitest run
npm run build
```

The tests (`tests/`) run against a throwaway SQLite database built from the real migrations; they never touch `dev.db`. They cover:
- **Unit:** finance maths, TOTP (RFC 6238), RBAC "cannot" lists for every role, open-redirect guard, JSON-LD escaping
- **Integration:** OTP, IDOR, append-only triggers, staff MFA/lockout/sessions, CMS four-eyes publishing, support/data rights, legal holds, jobs
- **End to end:** the full MVP1 journey from OTP to READY_FOR_BANK

## What's where

| Area | Routes |
| --- | --- |
| Public site | `/`, `/personal-loan`, `/business-loan`, `/how-it-works`, `/calculators` (+ `/emi-calculator`, `/calculators/how-much-can-i-borrow`, `/calculators/affordability`, `/calculators/interest`), `/faq`, `/guides`, `/contact`, `/about`, `/privacy`, `/terms`, `/grievance` |
| Applicant | `/apply` (loan → OTP → consent), `/my` (OTP sign-in, applications), `/my/applications/<LFI-ref>` (details, documents, submit, tracker, Action needed, withdraw, marketing preference) |
| Staff | `/admin` control tower and case workspace, `/admin/insights`, `/admin/support`, `/admin/lenders`, `/admin/content` (guides), `/admin/site` (website + applicant flow), `/admin/redirects`, `/admin/compliance`, `/admin/staff`, `/admin/activity` |

Code is organised by feature: `src/features/<feature>/{domain,config,server,actions,components}`. Routes live in `src/app/` and shared utilities in `src/shared/`. Key files:
- brand and data mode: `src/shared/config/brand.ts`
- banks (TEST only): `src/features/bank-submission/config/banks.ts`
- roles and permissions: `src/features/staff/domain/rbac.ts`
- three status fields: `src/features/applications/domain/stages.ts`

## Security model (summary)

- **Staff:** Argon2id passwords, TOTP MFA, DB sessions (15 min idle, 12 h max), lockout after 5 failures, sessions revoked on role/password/MFA change. Permission + case scope + state are checked on the server for every action.
- **Applicants:** OTP (5 min, 5 tries, 3 sends per 10 min). An application reference works only with an OTP session for the owning mobile.
- **Edge and data integrity:**
  - nonce CSP, HSTS (HTTPS only), frame-ancestors none, nosniff; private areas are `no-store` and `noindex`
  - SQLite triggers make consent, audit, snapshot and bank-status records append-only
  - PAN and account numbers are field-encrypted; documents are encrypted at rest with random names, type-checked by their bytes and virus-scanned (ClamAV required in production)
- Details and open items: `docs/SECURITY_FINDINGS.md`.

## Before real customers use this (not doable in code)

- [ ] Signed bank/master-DSA agreement; LIVE bank entries; `partnersLive` and the partner list in `brand.ts`
- [ ] Counsel sign-off: consent text, privacy/terms/grievance pages, retention periods, LSP classification (all marked VERIFY)
- [ ] DLT sender and templates plus an SMS provider (OTP and messages)
- [ ] Postgres in an India region, KMS-managed keys, private object storage, ClamAV worker, WAF, shared rate-limit store, backups with a restore drill
- [ ] Named Grievance Officer, registered company name, support phone and the final domain (`NEXT_PUBLIC_SITE_URL`)
- [ ] External penetration test (v4 §44 Phase 2 gate); then `DATA_MODE=live`

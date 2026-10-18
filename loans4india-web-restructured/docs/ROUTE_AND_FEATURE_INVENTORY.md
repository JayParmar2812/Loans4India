# Route and Feature Inventory

Status: ✅ built and working · 🟡 partial · ❌ missing · 🆕 added in this branch. Updated 18 Oct 2026: every 🆕 route exists, builds and answers in the production smoke test.

## Public website

| Route | Purpose | Baseline | Target |
| --- | --- | --- | --- |
| `/` | Home: hero, quick estimate, sections from CMS | ✅ | Redesign (brand, stepper, trust, guides) |
| `/personal-loan`, `/business-loan` | Product pages from CMS | ✅ | Restyle, breadcrumbs, JSON-LD |
| `/emi-calculator` | EMI + quick estimate | ✅ | Keep URL; link to hub |
| `/calculators` | Calculator hub (EMI, estimate, affordability, interest) | ❌ | ✅ 🆕 |
| `/how-it-works` | Journey explained, who decides what | ❌ | ✅ 🆕 |
| `/faq` | FAQ hub tabbed by topic, FAQPage schema | ❌ | ✅ 🆕 |
| `/guides`, `/guides/[slug]` | Articles from CMS (published only) | ❌ | ✅ 🆕 |
| `/about`, `/privacy`, `/terms`, `/grievance` | Trust and legal | ✅ | Restyle; grievance links to the ticket form |
| `/contact` | Support and grievance form → ticket | ❌ | ✅ 🆕 |
| `/[slug]` | CMS block pages | ✅ | + SEO fields, redirects |
| `/sitemap.xml`, `/robots.txt` | SEO | ✅ | + guides, canonical base from env |
| 404, error | Custom pages | 🟡 (404 only) | ✅ 🆕 `error.tsx`, `global-error.tsx` |

## Applicant

| Route | Purpose | Baseline | Target |
| --- | --- | --- | --- |
| `/apply` | Loan, mobile, consent → create | ✅ (no OTP) | 🆕 OTP step |
| `/documents/[token]` | Details, documents, submit, tracker, withdraw | ✅ | Keep for existing links |
| `/my`, `/my/sign-in`, `/my/applications/[ref]` | OTP sign-in, dashboard, application workspace | ❌ | ✅ 🆕 |
| `/api/otp/send`, `/api/otp/verify` | OTP challenge | ❌ | ✅ 🆕 |
| `/api/applications` | Create application | ✅ | Requires a verified session |
| `/api/documents/[key]/*` | Upload, details, submit, consent, withdraw | ✅ | Key = token **or** reference + session |
| `/api/support` | Contact, grievance, data-rights request | ❌ | ✅ 🆕 |

## Staff back office

| Route | Purpose | Baseline | Target |
| --- | --- | --- | --- |
| `/admin/login`, `/admin/mfa` | Session login + TOTP | ❌ (HTTP Basic) | 🆕 |
| `/admin` | Control tower queues + SLA | ✅ | + metrics, synthetic banner |
| `/admin/applications/[id]` | 360° workspace | ✅ | Restyle only |
| `/admin/staff` | Staff management | ✅ | + MFA status, session revoke |
| `/admin/activity` | Audit explorer | ✅ | Keep |
| `/admin/site`, `/admin/site/flow`, `/admin/site/preview/[slug]` | Website CMS, applicant-flow editor | ✅ | + draft/publish |
| `/admin/content` | Articles: draft/review/publish, revisions | ❌ | ✅ 🆕 |
| `/admin/redirects` | Redirect management | ❌ | ✅ 🆕 |
| `/admin/support` | Tickets and data-rights requests | ❌ | ✅ 🆕 |
| `/admin/lenders` | Read-only bank master | ❌ | ✅ 🆕 |
| `/admin/compliance` | Purge log, legal holds | ❌ | ✅ 🆕 |
| `/admin/export` | Counts CSV | ✅ | Keep |

## v4 MVP1 feature coverage (sections 1–17)

| § | Feature | Baseline | Target |
| --- | --- | --- | --- |
| 1 | Attribution | ✅ | — |
| 2 | Website groups + one primary CTA | ✅ | Expand |
| 3 | Quick estimate | ✅ | — |
| 4 | OTP registration, duplicate guard, session, step-up | 🟡 | OTP + session 🆕 |
| 5 | Consent ledger, re-consent, revocation | ✅ | DB append-only 🆕 |
| 6 | Application details form | ✅ | — |
| 7–8 | Document centre + pipeline | ✅ (sync scan) | Expiry watcher 🆕 |
| 9 | Submit + snapshot | ✅ | — |
| 10 | Status tracker | ✅ | Dashboard 🆕 |
| 11–14 | Intake, assignment, workspace, review | ✅ | — |
| 15–17 | Bank selection, package, gate | ✅ | — |
| 26 | Close, withdraw, dormancy, purge | 🟡 | Jobs + purge 🆕 |
| 27–37 | RBAC (+ MFA, sessions) | 🟡 | 🆕 |
| 38 | Control tower | ✅ | Metrics 🆕 |
| 41 | Data rights + grievance | ❌ | ✅ 🆕 |
| 42 | Communications | 🟡 | Provider interface + delivery log 🆕 |
| 43 | Data governance, retention | ❌ | ✅ 🆕 |
| 44 | Security | 🟡 | 🆕 |

# Loans4India — Implementation Audit

Date: 18 Oct 2026 · Branch: `feat/mvp1-completion` · Baseline commit: `b51ac7d`

Everything below was verified by reading the files or running the command named. Nothing is inferred from file names alone.

## 1. Workspace inventory

| Path (workspace root `Loans4India/`) | What it is | Status |
| --- | --- | --- |
| `loans4india-web-restructured/` | Next.js 16.3.8 app, feature-sliced. **Implementation baseline.** | Was untracked in git; committed unchanged as `b51ac7d`. |
| `loans4india-web/` | Same app in the older `lib/` + `components/` layout. | Legacy reference. Left untouched. |
| `flow/Loans4India — Platform Flow v4 (Source of Truth).pdf` | 103-page authoritative flow (identical bytes to `loans4india-web-restructured/v4.pdf`). | Read in full. |
| `flow/… Onboarding & Documents Flow v3.md` | Document checklist and onboarding detail, explicitly subordinate to v4. | Read. |
| `flow/… Platform Flow v3*.pdf/docx`, root `… v.1.pdf`, `… v2 … .pdf`, `*_v3_Revised.docx`, `*_End_to_End_User_Admin_Flow.docx` | Superseded flows (v4 change log retires v1–v3.2). | Not used for decisions. |
| Root `128MD…pdf`, `36NT…pdf`, `370MD…pdf`, `FEMA3(R)…pdf`, `PSLC…pdf` | RBI/FEMA circulars. | Context for counsel only. |
| `Logo options/Loans4India Mint Smile Logo.png` | The named, final logo: violet wordmark, mint "4" and smile. Six other files are unnamed Gemini drafts. | Used as the brand source. |
| `reference/finnable_flow_screens*.pdf`, `reference/*.png` | Finnable app screen captures (17 Oct 2026). | Read. Plus live `https://www.finnable.com/` (fetched 18 Oct 2026). |
| `loans4india-web.zip` | Archive of the legacy app. | Not used. |

**Missing documents.** The brief mentions a BRD, feature listing, senior developer KT, architecture, security and SEO/CMS documents. **None exist in the workspace.** Platform Flow v4 also cites a "System Design Document (v3.2)" and an "RBAC & PAM Spec (MVP1)". Neither is present. Decisions therefore rest on Platform Flow v4, the code and the brief.

## 2. Legacy vs restructured

The two apps have the same Prisma schema and the same 9,191 lines of source. A normalised diff (imports and path comments removed) shows **no logic differences**. The restructure moved code from `lib/` and `components/` into `features/<area>/{domain,server,actions,components,config}` and `shared/`, and split server actions out of `app/` into `features/*/actions`. The legacy app has nothing to salvage that the baseline lacks.

## 3. Stack (baseline)

- **Framework and UI:** Next.js 16.3.8 (App Router, `proxy.ts` instead of middleware), React 19.2, Tailwind 4, Zod 4.
- **Data:** Prisma 7 with the better-sqlite3 adapter and SQLite `dev.db`. Eight migrations, the database is up to date. The schema notes Postgres for production.
- **Storage:** encrypted files on local disk, AES-256-GCM, random 48-hex keys, nothing in `/public`.
- **Baseline checks (18 Oct):**
  - `tsc --noEmit`: 0 errors.
  - `eslint`: 0 problems.
  - `next build`: succeeds, all routes dynamic.
  - **Automated tests: none exist.** No framework is installed.

## 4. What already works (verified in code)

The baseline is far more complete than a prototype. It implements most of v4 sections 4–21 with real server-side rules.

| v4 § | Feature | Evidence |
| --- | --- | --- |
| 1 | Attribution: UTM, referrer, referral code in session storage, saved on the application | `AttributionTracker.tsx`, `api/applications/route.ts` |
| 2–3 | Home, personal and business loan pages, EMI calculator, quick estimate (FOIR 50%, 14%, 60 months, rounded down to ₹10,000), "not a lender" footer | `(public-site)/*`, `finance.ts` |
| 4 | Reference `LFI-XXXXXX` without 0/O/1/I/L; duplicate guard (one open application per mobile and product; never reveals that a number exists); honeypot; per-IP throttle | `reference.ts`, `api/applications/route.ts` |
| 5 | One consent screen naming the banks; four purposes; exact text, SHA-256 hash, notice and bank-list versions, IP and UA; append-only; re-consent (`CONSENT_PENDING`); revocation | `consent*.ts`, `api/documents/[token]/consent` |
| 6 | Dynamic details form driven by the product flow; autosave per field; server validation; PAN encrypted (AES-GCM) with keyed HMAC for duplicates; account number encrypted | `profile.ts`, `details.server.ts`, `fieldCrypto.server.ts` |
| 7–8 | Document slots, versions, magic-byte type detection, 10 MB limit, encrypted-PDF refusal, ClamAV hook (refuses uploads in production without a scanner), SHA-256 dedupe, per-application rate limit | `filecheck.server.ts`, `api/documents/[token]/route.ts` |
| 9 | Server completeness check, declaration, frozen hashed snapshot, idempotent submit with optimistic lock | `submit/route.ts`, `freezeSnapshot` |
| 10 | Status tracker computed from the three status fields; bank name only after submission | `tracker.ts`, `portal.server.ts` |
| 11 | Intake checks: PAN hash, mobile, IP velocity. They only flag; nothing is auto-rejected | `intakeChecks` |
| 12–14 | One owner with reassign reason; queues; document accept/reject with reason codes; tamper flag places a hold; Action needed tasks unlock only the named slots and sections | `case.actions.ts` |
| 15–17 | Three bank filters; selection basis; one active attempt; mapping engine; manifest plus hash; **all 8 gate checks re-run on the server at approval, with four-eyes (approver ≠ preparer)** | `bankFlow.ts`, `gateDecision` |
| 18–21 | Operator portal entry: bank reference unique per bank, evidence upload, attestation, consent re-check, package-hash re-check with auto-unfreeze, partial-entry check, escalation after 3 fails. Bank statuses from evidence only; checker for IN_PRINCIPLE, SANCTIONED and DISBURSED; backwards moves need a reason; re-route limit 2; fraud rejections never re-routed | `case.actions.ts` |
| 27 | Ten roles, permission bundles, case scope, operator–bank register | `rbac.ts` |
| 38 | Control tower: queue tiles, working-hours SLA clock (pauses on hold or applicant wait), workload by owner | `admin/page.tsx`, `sla.ts` |
| 39 | Three separate status fields; optimistic locking; audit event in the same transaction as each change | throughout |
| — | Website CMS: validated JSON content, home section order, product pages, block pages, image library (magic bytes, encrypted), theme, version history and restore, banned-phrase guard ("approved", "guaranteed"…) | `site-control/*` |
| — | Applicant-flow editor: loan types, fields, questions, checklist; new applications pin the flow version they started with | `applicant-flow/*` |
| — | Counts-only CSV export with formula-injection guard; document and evidence views logged | `admin/export`, `admin/documents` |

## 5. Gaps against v4 MVP1 and the brief

Severity: **C** blocks live data or safety · **H** core MVP1 · **M** brief scope · **L** polish.

| # | Gap | Sev | v4 § |
| --- | --- | --- | --- |
| G1 | **Staff auth is HTTP Basic.** No sessions, logout, MFA, lockout, login rate limit or idle timeout. Credentials can live in `.env`; the fallback `ADMIN_USER`/`ADMIN_PASSWORD` is a single shared login. | C | 27, 44 |
| G2 | **No OTP.** Anyone holding the 30-day secret link controls the application. Mobile ownership is never verified before consent is recorded. There is no returning-applicant sign-in. | C | 4, 44 |
| G3 | No security headers: no CSP, HSTS, `frame-ancestors`, Permissions-Policy or nosniff on pages. | H | 44 |
| G4 | Append-only tables (`ConsentRecord`, `ApplicationEvent`, `AdminEvent`, `BankStatusEvent`, `ApplicationSnapshot`) are append-only by convention only; nothing in the database stops an update or delete. | H | 39 |
| G5 | Staff passwords use scrypt with Node defaults (N=16384). The brief asks for Argon2id; Node 26 ships `crypto.argon2`. | M | 44 |
| G6 | No dormancy job, retention table, purge job, purge log or legal hold. All are in MVP1 scope ("purge job runs on synthetic data"). | H | 26, 43 |
| G7 | Messages are only logged as `MESSAGE_DUE` events. There is no provider interface, delivery log or quiet hours. | M | 42 |
| G8 | No applicant dashboard: list of applications, consent preferences, marketing opt-out, data-rights request. | H | 10, 41 |
| G9 | No grievance or data-rights ticketing; the grievance page is static text. | H | 41 |
| G10 | Public site lacks: how-it-works, FAQ hub, calculator hub (affordability, interest), contact, guides/articles, custom error page. | M | 2 |
| G11 | CMS: saving publishes immediately (no draft → review → publish), no article content type, no per-page canonical, noindex or OG fields, no redirects. | M | 2 |
| G12 | SEO: no canonical URLs, Organization/WebSite/FAQPage/Breadcrumb JSON-LD, OG image or guides in the sitemap. `metadataBase` is hard-coded. | M | 2 |
| G13 | Brand mismatch. Code says **"LoansForIndia"** with a "₹" glyph logo and a violet-dominant hero. The approved asset is **"Loans4India"** (Mint Smile logo) and the brief says white plus mint primary with a violet accent. | M | — |
| G14 | No automated tests. v4's definition of done requires "every role's Cannot list proven by automated tests". | H | 52 |
| G15 | No environment flag distinguishes synthetic from live data; staff screens don't say the data is synthetic. | M | 52 |
| G16 | In-memory rate limiting is per process. Acceptable for one server, not for several. | M | 44 |
| G17 | `mobile` is stored in plain text and indexed. v4's table says "Encrypted (tier T1)". | M | 4, 43 |
| G18 | No document expiry watcher (salary slip 45 days, statement 30 days). | L | 7 |

## 6. Broken or risky behaviour found

- **B1.** `api/applications` records consent for an unverified mobile. Anyone can create applications in someone else's name. Fixed by G2.
- **B2.** `x-forwarded-for` is trusted as-is for throttling and consent evidence, so any client can spoof it. Needs a trusted-proxy setting.
- **B3.** `/admin/site/preview/[slug]` and every admin page rely on Basic auth in `proxy.ts`, then re-verify on each call. That is correct, but the browser caches Basic credentials and there is no way to sign out.
- **B4.** `revealField` returns the decrypted PAN in an action result. It is logged and owner-scoped, which is acceptable, but nothing records the role-based field-masking policy as a test.

## 7. Duplication

- The `loans4india-web` and `loans4india-web-restructured` apps duplicate each other. The legacy app is kept as a reference per the brief, not modified.
- `throttled()` is copy-pasted in two routes, and the IP extraction is copy-pasted in four. This will become a shared helper.
- `PACKAGE_UNFROZEN` logic is duplicated in `case.actions.ts` and `package/route.ts`. Left alone because it works; noted.

## 8. Authority per decision

| Decision area | Authority |
| --- | --- |
| Workflow, states, copy rules, roles, MVP1 scope | Platform Flow v4 |
| Code structure, stack, data model | Restructured app |
| Brand name, logo, colours | `Loans4India Mint Smile Logo.png` plus the brief |
| UX patterns | Finnable (patterns only; no copy, rates, credit-score or "60-minute loan" claims, which v4 forbids) |
| Legal wording, retention periods, LSP status | **Counsel.** Marked VERIFY and not invented. |

## 9. Conflicts recorded (not silently resolved)

1. **Brand name.** Code says "LoansForIndia" on domain `loansforindia.com`; the logo and brief say "Loans4India". → Display name changes to **Loans4India**. The domain moves into config (`NEXT_PUBLIC_SITE_URL`) and is listed as an open decision; the reference prefix stays `LFI` (v4 §4).
2. **Scope.** The brief asks for commission, finance, partner portals and the full lender master. v4 §52 puts these in **Phase 2+**, gated on a signed agreement. → The baseline already has data structures for attempts and bank statuses. Commission and finance UI is **not** built, because it would compute money from invented rates. Lender records stay TEST-only.
3. **Hindi.** v4 says English and Hindi on pages, but §49 says "Hindi in Phase 2". → English now, strings kept centralised.
4. **DSA operator role.** v4 says it is Phase 2. The baseline enabled it for manual entry. → Kept, because it only works on TEST banks.
5. **Guides and FAQ content.** v4 marks them "Drafts, marked draft". → Seeded guides start as drafts awaiting approval, never auto-published.

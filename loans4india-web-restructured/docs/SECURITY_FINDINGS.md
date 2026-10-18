# Security Findings

Severity: Critical / High / Medium / Low. Status: Open / Fixed (commit) / Accepted (with reason) / Needs decision.
The baseline is the restructured app at `b51ac7d`. Fixes are tracked in `IMPLEMENTATION_PROGRESS.md`.

| ID | Finding | Sev | Status |
| --- | --- | --- | --- |
| S1 | Staff authentication was HTTP Basic against `.env` JSON or a DB table: no session revocation, logout, MFA, lockout, login rate limit or idle timeout; a shared fallback login was possible (`ADMIN_USER`). | Critical | **Fixed (Stage 2).** DB sessions (hashed token, HttpOnly + SameSite=Strict, `__Host-` in prod), 15 min idle / 12 h absolute, TOTP MFA for every staff login with replay guard, lockout after 5 failures (15 min), generic errors, per-IP/user throttles, sessions revoked on password/role/MFA/disable change, sign-out. `.env` staff are no longer a login path. Tests: `staff-auth.test.ts`. |
| S2 | Applicants had no OTP: consent was recorded for an unverified mobile, and the 30-day bearer link was the only credential. | Critical | **Fixed (Stage 2).** OTP (keyed hash, 5 min, 5 tries, 3 sends/10 min per mobile, 30 s resend gap, per-IP cap); applicant sessions (15 min idle); creating an application needs a verified session for the same mobile; references need the owning session (IDOR test). Legacy links still work until they expire. Production has **no SMS provider** (DLT pending), so OTP fails closed there. |
| S3 | No CSP, HSTS, `X-Frame-Options`/`frame-ancestors`, Permissions-Policy or `X-Content-Type-Options` on pages. | High | **Fixed (Stage 2).** Per-request nonce CSP (`strict-dynamic`; styles allow inline for React style attributes), plus frame-ancestors none, XFO DENY, nosniff, Referrer-Policy, Permissions-Policy, COOP, and HSTS over HTTPS. `no-store` + `noindex` on private areas. Verified by curl against `next start`. |
| S4 | Append-only audit and consent tables could be updated or deleted. | High | **Fixed (Stage 2).** SQLite triggers abort UPDATE/DELETE on ConsentRecord, ApplicationEvent, AdminEvent, SupportTicketEvent, ArticleRevision and PurgeLog. ApplicationSnapshot allows only the purge marker. BankStatusEvent allows only the one-time checker stamp. Tested through Prisma and raw SQL. Note: if a future Prisma migration redefines one of these tables, the trigger must be re-created in that migration. |
| S5 | `x-forwarded-for` was trusted from any client. | Medium | **Fixed (Stage 2).** `clientIp()` honours forwarding headers only with `TRUST_PROXY=1` (right-most hop). |
| S6 | Rate limits are in-memory per process, reset on restart and not shared across instances. | Medium | Accepted for single-instance MVP1. Production needs a shared store (documented). |
| S7 | Password hashing was scrypt with default cost. | Medium | **Fixed (Stage 2).** Argon2id (19 MiB, t=2, p=1) via Node's built-in `crypto.argon2`; legacy scrypt hashes verify and are upgraded at the next sign-in; strength rules (length, username, obvious words). |
| S8 | `mobile` is stored in plain text (v4 table says T1 encrypted). Needed in plain text today for duplicate matching and the staff search. | Medium | Needs decision. Proposed: add a keyed hash for matching and encrypt at rest when moving to Postgres + KMS. Tracked, not changed in MVP1 to avoid breaking search. |
| S9 | Dev-only fallback encryption keys. Production refuses to start without real keys. | Low | Accepted (already guarded) |
| S10 | No retention/purge, so personal data was kept indefinitely. | High | **Fixed (Stage 5).** `npm run jobs`: documents purged at close + 90 days, personal fields at close + 180 days (env-configurable; VERIFY periods), legal hold (set and lifted by different Compliance users), PurgeLog with no personal data. Tests: `jobs.test.ts`. Needs a scheduler in deployment. |
| S11 | `revealField` returns decrypted PAN. It is scoped to the owner or a manager with a reason, and logged. | Low | Accepted (v4 §13 design) |
| S18 | CMS text was placed in a JSON-LD `<script>` with plain `JSON.stringify` (FAQ blocks): a `</script>` in an answer would break out (stored XSS by a CMS user). | High | **Fixed (Stage 4).** `JsonLd` escapes `<`, `>`, `&` and U+2028/9; all structured data uses it. Test in `security.test.ts`. |
| S19 | Data-rights requests could be acted on for an unverified requester. | High | **Fixed (Stage 6).** Data-rights tickets need an OTP session for that mobile; Compliance can't resolve an unverified one; Support can't resolve data-rights tickets. |
| S12 | Errors from server actions re-threw unknown errors. | Medium | **Partly fixed.** `error.tsx`/`global-error.tsx` show only Next's digest (the correlation id in the server log), never messages or stacks. Structured error logging/alerting is a deployment item. |
| S13 | Bank share-link channel exists but is disabled by a constant (`BANK_SHARE_LINKS_ENABLED`). | Low | Accepted (off; v4 uses portal entry) |
| S14 | Malware scan is skipped in development and refused in production without `CLAMSCAN_PATH`. | Low | Accepted (correct fail-closed) |
| S15 | `npm audit`: Vitest 3 (critical: tinypool, @vitest/mocker) and the Prisma CLI's mysql2/deepmerge-ts. | High | **Fixed.** Vitest 5.0.5; `npm audit fix` for the Prisma chain. |
| S16 | `npm audit`: `braces`/`micromatch`/`fast-glob` via `eslint-config-next` (5 high). ReDoS/stack exhaustion in lint-time globbing. | Low (dev only) | **Accepted.** Not shipped to the server or browser; npm's only "fix" is a downgrade to eslint-config-next 14, which is wrong for Next 16. Re-check on the next eslint-config-next release. |
| S17 | A new staff account enrols its authenticator at first sign-in, so whoever holds the temporary password can enrol. | Medium | **Accepted with control.** Temporary passwords come from the master admin or CLI and are shared directly; the enrolment is logged (`STAFF_MFA_ENROLLED`). Production option: deliver the first-sign-in link out of band. |

## Controls already present (keep)

- Server-side role, case-scope and state checks on every action. Optimistic locking. Audit event in the same transaction.
- Field encryption for PAN and account number (AES-256-GCM), plus an HMAC for duplicate matching.
- Encrypted document store with random keys; files are never in `/public`.
- Magic-byte detection, size limit, encrypted-PDF refusal, SHA-256 dedupe.
- CSV export of counts only, with a formula-injection guard. Origin check on the operator package POST.
- `no-store` and `Referrer-Policy: no-referrer` on applicant APIs and file responses; sandbox CSP on document previews.

## Pre-launch requirements outside code (cannot be closed in this repo)

- Postgres in an India region with encryption at rest, private networking and least-privilege DB users.
- KMS-managed `FIELD_ENCRYPTION_KEY` and `DOCUMENT_ENCRYPTION_KEY`; a private object store for documents.
- ClamAV (or equivalent) worker with daily signature updates.
- DLT-registered SMS sender and templates, plus an SMS provider contract (OTP cannot reach real phones without it).
- WAF/CDN with DDoS protection; a shared rate-limit store (e.g. Redis).
- External penetration test before live data (v4 §44 Phase 2 gate).
- Incident runbook, CERT-In reporting contacts, backup and restore drill.

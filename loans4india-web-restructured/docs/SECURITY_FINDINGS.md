# Security Findings

Severity: Critical / High / Medium / Low. Status: Open / Fixed (commit) / Accepted (with reason) / Needs decision.
The baseline is the restructured app at `b51ac7d`. Fixes are tracked in `IMPLEMENTATION_PROGRESS.md`.

| ID | Finding | Sev | Status |
| --- | --- | --- | --- |
| S1 | Staff authentication uses HTTP Basic against `.env` JSON or a DB table. There is no session revocation, logout, MFA, lockout, login rate limit or idle timeout. A shared fallback login is possible (`ADMIN_USER`). | Critical | Open → Stage 2 |
| S2 | Applicants have no OTP: consent is recorded for an unverified mobile, and the bearer link in the URL (30 days) is the only credential. | Critical | Open → Stage 2/5 |
| S3 | No CSP, HSTS, `X-Frame-Options`/`frame-ancestors`, Permissions-Policy or `X-Content-Type-Options` on pages (file routes set some). | High | Open → Stage 2 |
| S4 | Append-only audit and consent tables can be updated or deleted by any code path or DB user. | High | Open → Stage 2 (DB triggers) |
| S5 | `x-forwarded-for` is trusted from any client, so throttles and consent IP evidence can be spoofed. | Medium | Open → Stage 2 (trusted-proxy setting) |
| S6 | Rate limits are in-memory per process, reset on restart and not shared across instances. | Medium | Accepted for single-instance MVP1. Production needs a shared store (documented). |
| S7 | Password hashing is scrypt with default cost. | Medium | Open → Argon2id with rehash-on-login |
| S8 | `mobile` is stored in plain text (v4 table says T1 encrypted). Needed in plain text today for duplicate matching and the staff search. | Medium | Needs decision. Proposed: add a keyed hash for matching and encrypt at rest when moving to Postgres + KMS. Tracked, not changed in MVP1 to avoid breaking search. |
| S9 | Dev-only fallback encryption keys. Production refuses to start without real keys. | Low | Accepted (already guarded) |
| S10 | No retention/purge, so personal data is kept indefinitely. | High | Open → Stage 5 |
| S11 | `revealField` returns decrypted PAN. It is scoped to the owner or a manager with a reason, and logged. | Low | Accepted (v4 §13 design) |
| S12 | Errors from server actions re-throw unknown errors (generic Next error page, no correlation ID). | Medium | Open → error boundary + correlation ID logging |
| S13 | Bank share-link channel exists but is disabled by a constant (`BANK_SHARE_LINKS_ENABLED`). | Low | Accepted (off; v4 uses portal entry) |
| S14 | Malware scan is skipped in development and refused in production without `CLAMSCAN_PATH`. | Low | Accepted (correct fail-closed) |

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

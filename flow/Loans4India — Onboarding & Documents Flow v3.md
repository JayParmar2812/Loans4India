# Loans4India — Applicant Onboarding & Documents Flow v3

4 Oct 2026. Adds mandatory document upload to the applicant journey and keeps the admin side in sync, up to handing the documents to a bank. Builds on Platform Flow v4 (Source of Truth); this file covers onboarding and documents only and does not replace v4 or v2.

## 1. Applicant journey (website)

| Step | What the applicant does | What the system records | Internal stage |
| --- | --- | --- | --- |
| 1. Your loan | Loan type, amount, tenure, purpose | — | — |
| 2. About you | Name, mobile, email, city, PIN, employment, employer/business, income, existing EMIs | — | — |
| 3. Consent | One screen: process application, **share application and documents with lenders**, contact (required); marketing (optional) | Application created with a reference (LFI-XXXXXX); one ConsentRecord per purpose with exact text and version `2026-10-04.v2` | Documents pending |
| 4. Documents | Opens the private upload page (`/documents/<link>`, 7 days) and uploads each item on their checklist (section 2) | Each file checked, virus-scanned, encrypted, stored | Documents pending |
| 5. Declaration + submit | Confirms details and documents are true and complete. Submit is blocked until every required item is uploaded | Declaration time, SUBMITTED event | Internal review |
| 6. Track | Same link shows: under review → "Please replace" (with reason) → verified → with the bank | — | follows admin |

The applicant cannot submit with a required document missing. After submitting, they can only add files where staff asked for a replacement.

## 2. Document checklists

Defined in one place: `src/lib/documents.ts`. Each lender's own template decides the final list; this is the default. Files: PDF/JPG/PNG, 10 MB each, no password-protected PDFs.

**Salaried (personal loan)**
- Required: PAN card · Aadhaar (masked, front and back) · salary slips, last 6 months · salary-account bank statement, last 6 months
- Optional: current address proof (only if different from Aadhaar) · Form 16 · existing loan sanction letters/schedules · photograph

**Self-employed (personal loan)**
- Required: PAN · Aadhaar (masked) · ITR, last 2 years with computation · bank statement, last 12 months · business/profession proof (GST, Udyam, Shop Act or professional registration)
- Optional: current address proof · existing loans · photograph

**Business loan**
- Required: PAN · Aadhaar (masked) of proprietor/main applicant · business registration (GST, Udyam or Shop Act) · business address proof · ITR, last 2 years · financial statements (P&L, balance sheet), last 2 years · current-account statement, last 12 months
- Optional: GST returns (GSTR-3B), last 12 months · business PAN · firm/company documents (partnership deed, LLP agreement or MOA/AOA/COI + board resolution, with PAN and masked Aadhaar of every partner/director) · current address proof · existing loans · photograph

**Aadhaar rule:** only a masked copy (first 8 digits hidden, downloadable from UIDAI). We never store the Aadhaar number and do not do Aadhaar authentication; the bank completes KYC. Staff reject an unmasked copy with the reason "unmasked Aadhaar".

## 3. Admin side (staff area)

**List** (`/admin`): new Documents column ("3 to verify · 1/4", "2 missing", "All verified") and a "Documents to verify" filter (applications in Internal review with unreviewed files).

**Application page:**
1. **Documents**: per checklist item, open each file (every view logged), then Accept or Ask to replace with a reason (unreadable, wrong document, incomplete, expired, name mismatch, unmasked Aadhaar, other). Ask to replace sends the application back to Documents pending and the applicant sees the reason.
2. **Ready for bank gate**: the stage can move to Ready for bank only when every required document is accepted and the applicant consented to sharing with lenders.
3. **Send to bank** (unlocks at Ready for bank):
   - **Download ZIP**: cover sheet (applicant, loan, income, document list with verification time, consent and declaration times, lender notes) + every verified document renamed by type (`01-PAN-card-1.pdf`, `03-Salary-slips-1.pdf` ...). For upload on the bank portal or to a master DSA.
   - **Share link for a bank sales officer / POS**: bank name + officer name → a private link, shown once, valid 72 hours and 3 downloads, can be switched off. Opening the page is not a download (link previews don't use it up). Only a hash of the link is stored.
   - **Bank reference**: when the bank confirms receipt, staff save the bank's application number. This is the only way to reach Submitted to bank.
4. **Activity**: package downloaded, link created/switched off, each bank download (with IP and browser), bank reference recorded, stage changes.

## 4. Stages (unchanged list, new rules)

Enquiry → Profile complete → **Documents pending** (created at consent; also when staff ask for a replacement) → **Internal review** (applicant submitted) → **Ready for bank** (all required verified + share consent) → **Submitted to bank** (bank reference saved) → Closed.

## 5. Guardrails

- Documents leave only through Send to bank, only to banks the applicant consented to, and only after staff verified them.
- No live customer documents before a bank or master-DSA agreement exists (MVP1 runs on synthetic data).
- Retention purge after handoff, configurable per bank (still to build).
- Staff login is still temporary Basic auth; staff accounts + MFA are needed before real documents.

## 6. Still to build

OTP sign-in for the upload page and SMS of the link · cloud storage (India region, encrypted) · real ClamAV in production · per-bank document templates and named partner list once agreements are signed · watermarking packages per bank · expiry watcher (salary slip 45 days, statement 30 days) · retention purge after handoff.

## Change log
- v3 (4 Oct 2026): masked Aadhaar is its own required item; salary slips 6 months; address proof optional; consent text mentions documents (v2); Ready-for-bank gate; Send to bank (ZIP, share link, bank reference); admin list document status and filter; applicant sees verified / with-the-bank status.

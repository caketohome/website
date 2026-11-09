# CHECKPOINT: P0 — ACCOUNTING MAPPING SPECIFICATION & CA SIGN-OFF PREPARATION (REV 3)
**Run ID:** `RUN-20261025-P0-ACCOUNTING-CA-SIGNOFF-REV3`  
**Date:** 2026-10-25  
**Verdict:** 🛑 **`STRICT HOLD / STAGED NO-GO`**  
**Arena Tournament:** `E:\vig\.arena\run-20261025-222144-s915102` (Seed `915102`, Champion `a002`, Score `100/100`, Strategy: *Decomposition + Draft, critique, rewrite + Maximal rigour*)  
**Artifact:** [accounting_mapping_specification_and_ca_signoff_package.md](file:///C:/Users/alexc/.gemini/antigravity-ide/brain/7377becf-9510-49ba-82ca-bfed67c55b61/accounting_mapping_specification_and_ca_signoff_package.md)  

---

## 1. Executive Summary & Desk Review 2 Defect Closures

Following the second desk review by Finance and Legal, this checkpoint records the resolution of all remaining substantive accounting-mapping and statutory-reference blockers in the CA Sign-Off Package.

Production release verdict remains strictly **`STRICT HOLD / STAGED NO-GO`**. Preparing a specification or signing Gate B endorses accounting policy only and does **NOT** authorize software deployment or operational release.

### Summary of Corrections Incorporated:
1. **Decoupled COD Revenue Recognition from Cash Custody (MAP-03)**:
   - Split MAP-03 into three independent events:
     * **MAP-03A (COD Delivery Sales Realization)**: At OTP handover, satisfies performance obligation under Ind AS 115 Paras 31–38 by debiting `1121 Accounts Receivable (COD Customer Clearing)` and crediting Revenue (`4110`, `4120`, `4130`) and Output GST (`2121`–`2124`).
     * **MAP-03B (COD Physical Cash Collection by Delivery Partner)**: Affirmative telemetry (`cod_custody_events.method = 'CASH'`, `amount_collected > 0`) debits `1122 Undeposited COD Collections (Rider Custody)` and credits `1121 Accounts Receivable`. Zero revenue impact. Unremitted cash past 24 hours triggers `COD_CUSTODY_DISCREPANCY` audit escalation.
     * **MAP-03C (Doorstep Digital Collection - Dynamic UPI/QR)**: Webhook capture debits `1113 Payment Gateway Clearing Account` and credits `1121 Accounts Receivable`. Driver cash custody (1122) is never debited; revenue is not recognized twice.
2. **Authoritative 98-Account CoA Reconciliation (MAP-09)**:
   - Purged phantom account `2119 Customer Refund Payable` (which does not exist in the 98-account master). Reversal pathways mapped strictly to verified accounts (`2141`, `1121`, `1122`, `1111`, `1112`, `1113`).
   - Separated pre-delivery cancellations from post-delivery credit notes.
   - For post-delivery prepaid credit notes, structured a rigorous two-phase lifecycle:
     * *Phase 1 (Voucher Inversion)*: Inverting sales voucher in `sales-invoice-reversal.service.ts` re-credits `2141 Customer Advances` as a customer credit balance.
     * *Phase 2 (Refund Disbursement Payout)*: Bank/gateway disbursement debits `2141 Customer Advances` and credits `1113 Gateway Clearing` / `1112 Bank Current A/c`.
     * CA Determination: If a dedicated balance sheet refund account (e.g. `2143`) is required, marked as **UNVERIFIED / REQUIRES CA COA AMENDMENT**.
3. **Corrected Directional Rounding Patterns (MAP-12 & MAP-08)**:
   - Eliminated invalid `Dr 5295 / Cr 5295` duplicate posting.
   - Defined exact directional formula: $\Delta = \text{Total Invoice Amount Payable (Rounded)} - (\text{Taxable Value} + \sum \text{GST Calculated})$.
     * If $\Delta > 0$ (gain): `Cr 5295 Cash Rounding Variance` (Counterpart: `Dr 1121 AR` / `Dr 2141 Advances`).
     * If $\Delta < 0$ (loss): `Dr 5295 Cash Rounding Variance` (Counterpart: `Cr 1121 AR` / `Cr 2141 Advances`).
     * Tolerance: Strictly bounded to $\le \pm ₹0.50$ per invoice under **Section 170 of the CGST Act, 2017**. Submitted to CA whether rounding applies per tax component or on invoice gross total.
   - Payment Gateway Settlement Variance (MAP-08): Evaluated per settlement payout batch: $\delta = \text{Bank Credit (1112)} - (\text{Gross} - \text{MDR (5290)} - \text{Input GST (1143/1144/1146)})$. Tolerance: $|\delta| \le ₹1.00$ per batch. Discrepancies $> ₹1.00$ route to `2153 Accrued Expenses / Gateway Suspense`. ITC on MDR fees conditioned on Section 16(2) CGST Act compliance (valid tax invoice and GSTR-2B reflection).
4. **Updated Labour & Corporate Statutory Citations**:
   - Replaced repealed Payment of Wages Act, 1936 with **Section 18 and Section 69 of the Code on Wages, 2019** (enforced **21 November 2025** by Ministry of Labour and Employment). Automatic payroll deductions are strictly illegal; deductions require written show-cause, inquiry, and are capped at 50% of wages.
   - Qualified Companies Act Section 134(5)(e) as applicable specifically to *listed companies*.
   - Referenced internal control statutory framework for unlisted entities under Section 143(3)(i) (read with MCA Notification G.S.R. 583(E)) and Rule 8(5)(viii) of Companies (Accounts) Rules, 2014. Marked **UNVERIFIED / PENDING CORPORATE LEGAL ADVICE ON ENTITY TYPE**.
5. **Aligned Gate Status and Disposition Wording with Evidence**:
   - Reclassified `GATE-TECH` from `VERIFIED` to **`REPORTED IN PREVIOUS AUDITS / NOT INDEPENDENTLY REVERIFIED`** until raw assertion logs and database query outputs are attached.
   - Changed Gate B disposition wording:
     From: `APPROVED FOR PRODUCTION RELEASE GATE B`
     To: **`ACCOUNTING POLICY SPECIFICATION ENDORSEMENT ONLY — DOES NOT AUTHORIZE PRODUCTION RELEASE`**.
   - Retained `GATE-PROD-RELEASE (Gate E)` strictly **`BLOCKED`**.
6. **Equity Group Determination (CoA Review Note)**:
   - Flagged accounts `3110 Partner / Shareholder Capital` and `3120 Partner Drawings` for CA determination against verified corporate structure under Schedule III.
   - Noted that transfer to general reserve is voluntary under Section 123(1) of the Companies Act 2013; generic "statutory reserves" must not be presumed.

---

## 2. Consolidated Authoritative Release-Gate Register

| Canonical Gate ID | Domain Scope | Legacy Cross-Reference | Named Owner & Role | Required Evidentiary Artifacts | Current Status | Specific Blocker / Sign-Off Requirement |
|:---:|---|---|---|---|:---:|---|
| **GATE-TECH** | Code Quality, Build & Technical Verification | Legacy Gate 1 (Build Quality), Local ERP Integration | Lead Fullstack Architect | 163 assertions, PG queries, and automated reconciliations reported in previous audits | ⚠️ `REPORTED IN PREVIOUS AUDITS / NOT INDEPENDENTLY REVERIFIED` | Raw assertion logs and DB test outputs must be attached and reviewed before formal verification. |
| **GATE-A** | Legal Entity, Corporate Governance & GSTIN Registration | Legacy Gate A (Company & GST Identity), Gate 2 (Legal Scope) | Adv. N. Ramachandran (General Counsel) | Certified Certificate of Incorporation, GSTIN registration certificate, multi-branch Place of Supply matrix | 🛑 `BLOCKED` | Awaiting final execution of corporate legal incorporation documents and GST registrations. |
| **GATE-B** | Statutory Accounting Policy, CoA Master & CA Sign-Off | Legacy Gate B (Accounting Start Date & Journal Entries), Gate 4 (Finance Auth) | CA V. S. Murthy, FCA (Statutory Auditor & Finance Controller) | Corrected Accounting Mapping Spec, CoA Master, GSTR-1 Reconciliation Schedule, Discrepancy Register Sign-off | 📝 `APPROVAL READY FOR PRESENTATION` | **ACCOUNTING POLICY SPECIFICATION ENDORSEMENT ONLY — DOES NOT AUTHORIZE PRODUCTION RELEASE**. Awaiting formal CA review and written signature. |
| **GATE-C** | Retail Operations, Rider Cash Custody & Shift Remittance | Legacy Gate C (COD Exception Order), Gate 3 (Ops Readiness) | Rajesh Kumar (Head of Retail Operations) | Driver cash custody SOP, shift remittance closing manual, daily cash drawer float policy, exception order `AUTH-CFO-2026-10-22-EX01` resolution | 🛑 `BLOCKED` | Awaiting retail operations field procedure validation and management adoption of cash variance SOP. |
| **GATE-D** | Enterprise Security, Credential Containment & DBA Sign-Off | Legacy Gate D (Release Auth & DBA Sign-off), Gate 2 (Security) | Dr. Aris Thorne (Lead Security Auditor) & Authorized DBA | DBA written confirmation of credential rotation & termination of leaked secrets, AWS KMS key rotation log, RBAC route protection audit | 🛑 `BLOCKED` | Awaiting authorized DBA confirmation of credential rotation and security key management audit. |
| **GATE-E** | Change-Control Board (CAB) Production Deployment | Legacy Gate 4 (Deployment Restrictions) | Chairperson, Change-Control Board (CAB) & CTO | Production deployment runbook, database sequence repair dry-run log, off-peak cutover schedule, disaster recovery rollback plan | 🛑 `BLOCKED` | Strictly blocked until Gates A, TECH, B, C, and D have achieved 100% written approval. |

---

## 3. Production Invariant Restrictions Enforced

1. **Filesystem & Code Protection**: Candidate solutions isolated strictly within `.arena/`; zero edits to production code or business logic.
2. **Zero Historical Mutation**: Historical vouchers, journal entries, and invoices preserved 100% untouched.
3. **Database Safeguards**: Zero production connections, zero migrations, zero sequence counter modifications, zero test data pollution.
4. **Authenticity Guard**: No account mappings or policies marked approved without written CA authorization. Unsupported items marked `UNVERIFIED` or `BLOCKED`.
5. **Release Verdict**: Production remains strictly **`STRICT HOLD / STAGED NO-GO`**.

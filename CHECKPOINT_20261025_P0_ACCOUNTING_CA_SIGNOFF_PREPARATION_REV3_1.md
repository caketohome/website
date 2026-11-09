# CHECKPOINT: P0 — ACCOUNTING MAPPING SPECIFICATION & CA SIGNOFF PREPARATION (REV 3.1)
**Run ID:** `RUN-20261025-P0-ACCOUNTING-CA-SIGNOFF-REV3.1`  
**Date:** 2026-10-25  
**Verdict:** 🛑 **`STRICT HOLD / STAGED NO-GO`**  
**Arena Tournament:** [`E:\vig\.arena\run-20261025-230218-s155455`](file:///e:/vig/.arena/run-20261025-230218-s155455) (Seed `155455`, Champion `a002`, Score `100/100`, Strategy: *Socratic + Three drafts, pick one + Edge cases first*)  
**Master Artifact:** [accounting_mapping_specification_and_ca_signoff_package.md](file:///C:/Users/alexc/.gemini/antigravity-ide/brain/7377becf-9510-49ba-82ca-bfed67c55b61/accounting_mapping_specification_and_ca_signoff_package.md)  
**Previous REV3 Checkpoint:** [CHECKPOINT_20261025_P0_ACCOUNTING_CA_SIGNOFF_PREPARATION.md](file:///e:/vig/CHECKPOINT_20261025_P0_ACCOUNTING_CA_SIGNOFF_PREPARATION.md)  

---

## 1. Executive Summary & Defect Closures Matrix (REV 3.1)

| Defect / Item | Finding in Prior Revision | Statutory & Accounting Truth | Outcome Label |
|---|---|---|:---:|
| **1. Cake GST Rate** | Account `4110` labeled 5% GST; tax accounts `2121/2122` labeled 2.5% CGST/SGST. | CBIC Tariff Heading 1905 (`1905 90 10`) taxes pastry, cakes, and bakery goods at **18% GST** (9% CGST + 9% SGST). 5% applies to restaurant services (Heading 9963 / Notification 11/2017-CT(R)). If CakeToHome is a retail reseller of goods, 18% is legally mandatory. Flagged for CA & Tax Counsel determination. | 🛑 **BLOCKED (P0 Statutory Discrepancy)** |
| **2. Delivery Service Rate** | Treated 18% vs proposed 5% without verifying legal instrument. | 57th GST Council Meeting (8 Oct 2026) recommended 5% without ITC for delivery via ECOs. A press release lacks legal force until gazetted under Section 9/11 CGST Act. Standard rate remains 18% (SAC 9968/9965). Blocked ITC risk under Section 17(5) documented. | 🛑 **BLOCKED PENDING NOTIFICATION** |
| **3. Tax Accounts in CoA** | CoA lacked Output CGST 9% and SGST 9% accounts for cakes and delivery. | Accounts `2123/2124` are explicitly named `(Accessories)`. Posting cake/delivery GST to accessory accounts creates ledger distortions. Submitted to CA for CoA amendment. | 🛑 **BLOCKED PENDING CA COA AMENDMENT** |
| **4. Revenue Account Inversion** | Section 3 described 4120 as accessories and 4130 as delivery, but event mappings swapped them and omitted 4140. | Aligned all sections to canonical 98-account master: `4110` Cakes, `4120` Accessories (18%), `4130` Delivery, `4140` Customization & Midnight Surcharges, `4190` Sales Returns (Contra-revenue). | 🟢 **VERIFIED IN SPECIFICATION** |
| **5. Cash Shortage Accounting** | Proposed `Dr 2153 / Cr 1122`. | Account `2153` is an accrued operating liability. Debiting a liability reduces operational dues, which is an invalid pattern for an asset shortage. Entry rejected. Actual cash deposited debits `1111` / credits `1122`. Missing cash remains in `1122` tagged to rider in subledger under `SHORTAGE_FLAGGED` with 3-tier SoD sign-off. | 🟢 **VERIFIED (Invalid Pattern Rejected)** |
| **6. Wage Code Citations** | Cited incorrect subsections of Code on Wages, 2019. | Corrected: Section 18(3) (50% deduction ceiling), Section 21(1) (damage/loss cap), Section 21(2) (mandatory show-cause and inquiry), Section 69 (repeal & savings). Management proposal status: **NOT APPROVED / MUST NOT BE AUTOMATED PENDING LEGAL REVIEW**. | 🟢 **VERIFIED IN SPECIFICATION** |
| **7. Invoice Rounding Treatment** | Credit to expense account 5295 described as "Gain/Income". | Crediting expense account `5295` is a **contra-expense / expense reduction**, not Other Income. Formula reconciled: $\Delta = \text{Total Payable} - (\text{Line Base} + \text{Surcharges} + \text{Taxes})$. Symmetrical credit note reversal enforced. Section 170 CGST Act distinguished from commercial rounding. | 🟢 **VERIFIED IN SPECIFICATION** |
| **8. Gateway Batch Variance** | ₹1.00 tolerance treated as statutory authorization; routed $> ₹1.00$ to liability 2153. | ₹1.00 is an internal management proposal. Routing unallocated differences to liability `2153` creates balance sheet distortions; submitted to CA for suspense destination. Section 16(2) ITC conditions enforced. | ⚠️ **PARTIALLY VERIFIED / PENDING CA REVIEW** |
| **9. Refund Lifecycle Boundaries** | Conflated credit notes and cash payouts into single events. | Decomposed into independent events: pre-delivery cancellation vs payout; post-delivery credit note issuance (`Dr 4190 / Cr 1121 or 2141`) vs refund payout (`Dr 2141 / Cr 1113 or 1112`). Excluded unlisted account 2119. Flagged dedicated refund liability (`2143`) as requiring CoA amendment. | 🟢 **VERIFIED IN SPECIFICATION** |
| **10. Authoritative CoA Attachment** | Master CoA was not attached as a complete dated annex. | Complete 98-account Chart of Accounts master extracted from `phase4c-chart-of-accounts-design-01.md:260-361` and attached in full as Annex A. | 🟢 **VERIFIED (Annex A Attached)** |
| **11. Release Gate Alignment** | Confused policy approval with production release authorization. | `GATE-TECH` marked `REPORTED IN PREVIOUS AUDITS / NOT INDEPENDENTLY REVERIFIED`. Gate B presented as review draft only. Production Gate E strictly `BLOCKED`. | 🟢 **VERIFIED IN SPECIFICATION** |

---

## 2. Updated Authoritative Release-Gate Register

| Canonical Gate ID | Domain Scope | Named Owner & Role | Required Evidentiary Artifacts | Current Status | Disposition / Authorization Limit |
|:---:|---|---|---|:---:|---|
| **GATE-TECH** | Code Quality, Build & Technical Verification | Lead Fullstack Architect | 163 assertions, PG queries, and automated reconciliations reported in previous audits | ⚠️ `REPORTED IN PREVIOUS AUDITS / NOT INDEPENDENTLY REVERIFIED` | Raw assertion logs and DB test outputs must be attached and reviewed before formal verification. |
| **GATE-A** | Legal Entity, Corporate Governance & GSTIN Registration | Adv. N. Ramachandran *(General Counsel)* | Certified Certificate of Incorporation, GSTIN registration certificate, multi-branch Place of Supply matrix | 🛑 `BLOCKED` | Awaiting final execution of corporate legal incorporation documents and GST registrations. |
| **GATE-B** | Statutory Accounting Policy, CoA Master & CA Sign-Off | CA V. S. Murthy, FCA *(Statutory Auditor & Finance Controller)* | Corrected Accounting Mapping Spec, CoA Master (Annex A), GSTR-1 Reconciliation Schedule, Discrepancy Register Sign-off | 📝 `APPROVAL READY FOR PRESENTATION (REVIEW DRAFT ONLY)` | **ACCOUNTING POLICY SPECIFICATION ENDORSEMENT ONLY — DOES NOT AUTHORIZE PRODUCTION RELEASE**. Awaiting formal CA review and written signature. |
| **GATE-C** | Retail Operations, Rider Cash Custody & Shift Remittance | Rajesh Kumar *(Head of Retail Operations)* | Driver cash custody SOP, shift remittance closing manual, daily cash drawer float policy, exception order `AUTH-CFO-2026-10-22-EX01` resolution | 🛑 `BLOCKED` | Awaiting retail operations field procedure validation and management adoption of cash variance SOP. |
| **GATE-D** | Enterprise Security, Credential Containment & DBA Sign-Off | Dr. Aris Thorne *(Lead Security Auditor)* & Authorized DBA | DBA written confirmation of credential rotation & termination of leaked secrets, AWS KMS key rotation log, RBAC route protection audit | 🛑 `BLOCKED` | Awaiting authorized DBA confirmation of credential rotation and security key management audit. |
| **GATE-E** | Change-Control Board (CAB) Production Deployment | Chairperson, Change-Control Board (CAB) & CTO | Production deployment runbook, database sequence repair dry-run log, off-peak cutover schedule, disaster recovery rollback plan | 🛑 `BLOCKED / STRICT NO-GO` | Strictly blocked until Gates A, TECH, B, C, and D have achieved 100% written approval. |

---

## 3. Production Invariants & Boundaries

1. **Strict Hold / Staged No-Go**: Production release remains 100% blocked.
2. **Zero Code Mutations**: Zero modifications to TypeScript services, PostgreSQL schemas, triggers, or API routes.
3. **Zero Database Modifications**: Zero migrations, zero historical voucher tampering, zero sequence counter edits.
4. **Audit Traceability**: All historical evidence and checkpoints preserved.

# LATEST CHECKPOINT: CakeToHome ERP — P0 Accounting Mapping Specification & CA Sign-Off Preparation (REV 3.1)

> **Current Checkpoint**: [CHECKPOINT_20261025_P0_ACCOUNTING_CA_SIGNOFF_PREPARATION_REV3_1.md](file:///e:/vig/CHECKPOINT_20261025_P0_ACCOUNTING_CA_SIGNOFF_PREPARATION_REV3_1.md)  
> **Master Artifact**: [accounting_mapping_specification_and_ca_signoff_package.md](file:///C:/Users/alexc/.gemini/antigravity-ide/brain/7377becf-9510-49ba-82ca-bfed67c55b61/accounting_mapping_specification_and_ca_signoff_package.md)  
> **Previous REV3 Checkpoint**: [CHECKPOINT_20261025_P0_ACCOUNTING_CA_SIGNOFF_PREPARATION.md](file:///e:/vig/CHECKPOINT_20261025_P0_ACCOUNTING_CA_SIGNOFF_PREPARATION.md)  
> **Previous Financial Lifecycle Checkpoint**: [CHECKPOINT_20261025_P0_FINANCIAL_LIFECYCLE_AUDIT.md](file:///e:/vig/CHECKPOINT_20261025_P0_FINANCIAL_LIFECYCLE_AUDIT.md)  

**Status:** 🟢 **ACCOUNTING SPECIFICATION & CA SIGNOFF DOSSIER: REV 3.1 CORRECTED & ALIGNED** | 🛑 **PRODUCTION RELEASE VERDICT: STRICT HOLD / STAGED NO-GO**  
**Timestamp:** 2026-10-25T23:18:00+05:30  
**Arena Tournament:** Run [`E:\vig\.arena\run-20261025-230218-s155455`](file:///e:/vig/.arena/run-20261025-230218-s155455) (Seed `155455`, Champion `a002`, Score `100/100`)  
**Execution Boundary:** Read-Only Desk Review Corrections Complete. Zero code mutations, zero production database connections, zero schema migrations, zero historical voucher tampering.

---

### Key Milestone Achievements & Defect Closures (REV 3.1):

1. **Mandatory Arena Tournament Champion (Rule 0.1)**:
   - Run ID: `.arena/run-20261025-230218-s155455` (Seed 155455, 4 agent architectures, 2 elimination rounds).
   - Champion: Agent `a002` (Composite Score: **100/100**) using Strategy Card *Socratic + Three drafts, pick one + Edge cases first*.
   - Compulsory Skills Applied: `arena`, `smart-coder`, `lazy-coder`, `clean-architecture`, `systematic-debugging`, `security-audit`, `technical-documentation`.

2. **Critical GST Rate & Account Mapping Review**:
   - **Cake Rate Discrepancy Flagged**: Tariff Heading 1905 (`1905 90 10`) taxes pastry, cakes, and bakery goods at **18% GST** (9% CGST + 9% SGST). The 5% rate in account 4110 and 2121/2122 derives from restaurant service rules (Heading 9963 / Notification 11/2017-CT(R) and ECO liability under Sec 9(5)). If CakeToHome is a retail merchandise reseller, 18% is legally mandatory. Flagged as **P0 Discrepancy requiring CA & Tax Counsel determination**.
   - **Delivery Service Rate Evaluation**: 57th GST Council Meeting (8 Oct 2026) recommended 5% without ITC for delivery via ECOs, but press releases lack statutory force until gazetted. Standard rate remains 18% (SAC 9968/9965). Blocked ITC risk under Section 17(5) documented.
   - **CoA Tax Account Gaps**: The 98-account CoA lacks Output CGST 9% and SGST 9% accounts for cakes and delivery (accounts `2123/2124` are designated for Accessories). Submitted to CA for CoA amendment.

3. **Revenue Account Hierarchy Contradictions Resolved**:
   - Aligned all sections to canonical 98-account master: `4110` Cake Sales, `4120` Accessory Sales (18%), `4130` Delivery Charges, `4140` Customization & Midnight Surcharges (composite supply analysis under Sec 8), `4190` Sales Returns (Contra-revenue).

4. **Cash-Shortage Accounting & Labour Citations Corrected**:
   - **Invalid Entry Rejected**: Proposing `Dr 2153 / Cr 1122` debiting liability 2153 to absorb missing cash rejected as an invalid accounting pattern. Actual cash deposited debits `1111` / credits `1122`. Missing cash remains in `1122` tagged to rider in subledger under `SHORTAGE_FLAGGED` with 3-tier SoD sign-off.
   - **Wage Code References Corrected**: Section 18(3) (50% deduction ceiling), Section 21(1) (damage/loss cap), Section 21(2) (mandatory show-cause and inquiry), Section 69 (savings). Management proposal marked **NOT APPROVED / MUST NOT BE AUTOMATED PENDING LEGAL REVIEW**.

5. **Rounding & Gateway Variance Formulations**:
   - MAP-12: Credit to expense account `5295` classified as a **contra-expense / expense reduction**, not Other Income. Formula reconciled: $\Delta = \text{Total Payable} - (\text{Line Base} + \text{Surcharges} + \text{Taxes})$. Symmetrical credit note reversal enforced. Section 170 CGST Act distinguished from commercial rounding.
   - MAP-08: ₹1.00 tolerance defined as an internal management proposal. Batch variance $\delta$ evaluated; routing $> ₹1.00$ to liability 2153 flagged for CA clearing/suspense determination. Section 16(2) ITC conditions enforced.

6. **Refund / Cancellation Event Boundaries Decomposed**:
   - Decomposed into independent events: pre-delivery cancellation vs payout; post-delivery credit note issuance (`Dr 4190 / Cr 1121 or 2141`) vs refund payout (`Dr 2141 / Cr 1113 or 1112`). Excluded unlisted account 2119. Dedicated refund liability (`2143`) flagged as UNVERIFIED / REQUIRES CA COA AMENDMENT.

7. **Annex A Attached & Release Gates Aligned**:
   - Complete 98-account Chart of Accounts master attached in full as Annex A.
   - `GATE-TECH` kept as `REPORTED IN PREVIOUS AUDITS / NOT INDEPENDENTLY REVERIFIED`. Gate B presented as review draft only. Production Gate E strictly `BLOCKED / STRICT NO-GO`.

---

### Authoritative Release-Gate Register Summary:
- `GATE-TECH`: ⚠️ `REPORTED IN PREVIOUS AUDITS / NOT INDEPENDENTLY REVERIFIED`
- `GATE-A`: 🛑 `BLOCKED` (Adv. N. Ramachandran)
- `GATE-B`: 📝 `APPROVAL READY FOR PRESENTATION (REVIEW DRAFT ONLY)` (CA V. S. Murthy, FCA)
- `GATE-C`: 🛑 `BLOCKED` (Rajesh Kumar)
- `GATE-D`: 🛑 `BLOCKED` (Dr. Aris Thorne & DBA)
- `GATE-E`: 🛑 `BLOCKED / STRICT NO-GO` (CAB Chairperson & CTO)

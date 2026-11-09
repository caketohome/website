# CakeToHome ERP — Checkpoint: Phase 0 Corrected Baseline

**Document Version:** `v1.0-CORRECTED-BASELINE`  
**Checkpoint ID:** `CHECKPOINT_20261021_PHASE0_CORRECTED_BASELINE`  
**Observation Timestamp:** `2026-10-21T06:11:21.576Z` (Local Time: `2026-10-21T11:41:21+05:30`)  
**Target Database:** PostgreSQL 17.6 on x86_64-pc-linux-gnu (`aws-1-ap-south-1.pooler.supabase.com:6543/postgres`, Backend PID: `1335152`)  
**Mandatory Arena Tournament:** Run `run-20261021-115255-s429760` (Seed `429760`, Champion `a002`, Score `98.60/100`)  
**Phase 0 Status:** **`VERIFIED`**  
**Phase 1 Status:** **`BLOCKED`** (Read-only Phase 0 investigation complete; Phase 1 implementation strictly deferred to separate authorization)  

---

## 1. Executive Notice of Retraction & Authority

This checkpoint formally supersedes and replaces the retracted conclusions in `CHECKPOINT_20260913_193500_PHASE0_BASELINE_INSPECTION.md` and `VERIFICATION_REPORT_20260913_193500_PHASE0_BASELINE.md`.

### Retracted Claims vs Authoritative Database Reality
1. **Table Names:** The relational order table is `public.order`, **NOT** `order_header`.
2. **Order Line Items:** Relational line items are absent: `order_item` (0 rows), `order_line_item` (0 rows), and `public.order.metadata->'items'` is uniformly `[]`. Order headers cannot compute product margins.
3. **Accounting Validity:** A balancing trial balance (₹19,675.00 Dr = ₹19,675.00 Cr) does not imply operational validity. Abnormal negative balances exist on asset/expense accounts (1114: -₹200, 1122: -₹3,550, 5296: Cr ₹6,525), and 80%+ of transactions originate from automated test harnesses (`br_tc_*`, `br_conc_*`).
4. **COD Reconciliation:** Exactly 14 handovers were acknowledged (crediting ₹3,550 to account 1122), but **zero dispatch entries were ever posted to debit account 1122**, and 8 handovers remain unacknowledged in `SUBMITTED` state (₹1,800 declared).
5. **Output GST & Tax:** Posted output GST across accounts 2121, 2122, and 2123 is **₹0.00**. Account 2123 is titled `Output CGST 9.0% (Accessories)` (not IGST). `gst_registration` has **0 rows** (seller has no registered GSTIN).
6. **Reporting API Validation:** Endpoints return HTTP 200 but rely on hardcoded `* 0.35` COGS estimators in `api-engine.ts`, null-to-zero masking in `enterprise-reports-engine.tsx`, `deliveredOrders: 0` in delivery SLA, and `"Primary"` / `"Item"` placeholder fallbacks in cross-sell reporting.

---

## 2. Mandatory Arena Tournament Evidence

Pursuant to project instructions, the authentic Google Antigravity Arena skill (`e:/vig/.agents/skills/arena/SKILL.md`) was executed:
- **Run ID:** `E:\vig\.arena\run-20261021-115255-s429760`
- **Seed:** `429760`
- **Competitors:**
  - `a001`: Dialectical + Build-then-break + User empathy first
  - `a002`: Working backwards + Iterative deepening + Completeness
  - `a003`: Adversarial + Open questions first + Simplest thing that works
  - `a004`: Expert panel + Outline first + Speed
- **Tournament Outcomes:**
  - Round 1 Match 1: `a002` defeated `a003` (97.00 vs 88.45)
  - Round 1 Match 2: `a001` defeated `a004` (92.75 vs 84.55)
  - Round 2 Finals: `a002` defeated `a001` (98.60 vs 93.10)
- **Crowned Champion:** **`a002`** (*Working backwards + Iterative deepening + Completeness*)
- **Status:** **`VERIFIED`**

---

## 3. Query-Backed Schema & Operational Counts

Extracted via `e:/vig/scratch/query_forensic_facts.js` from PostgreSQL 17.6 on `2026-10-21T06:11:21.576Z`:

| Table Name | Row Count | Primary Verified Columns | Status |
|:---|:---:|:---|:---:|
| `public.order` | **234** | `id`, `display_id`, `status` (202 pending, 27 completed, 5 canceled), `metadata` (contains `total_amount`), `created_at` | **`VERIFIED`** |
| `public.order_item` | **0** | `id`, `order_id`, `product_id`, `quantity` (Zero rows persisted) | **`VERIFIED`** |
| `public.order_line_item` | **0** | `id`, `order_id`, `item_id`, `quantity` (Zero rows persisted) | **`VERIFIED`** |
| `public.accounting_account` | **100** | `id`, `code`, `name`, `type`, `subtype`, `is_active`, `deleted_at` | **`VERIFIED`** |
| `public.accounting_voucher` | **98** | `id`, `voucher_no`, `voucher_type`, `status` (54 POSTED, 20 APPROVED, 14 DRAFT, 10 SUBMITTED), `deleted_at` | **`VERIFIED`** |
| `public.accounting_journal_entry` | **56** | `id`, `entry_no`, `voucher_id`, `total_debit`, `total_credit`, `is_reversed` | **`VERIFIED`** |
| `public.accounting_journal_line` | **102** | `id`, `journal_entry_id`, `account_id`, `debit_amount`, `credit_amount`, `branch_id` | **`VERIFIED`** |
| `public.teller_session` | **54** | `id`, `teller_id`, `branch_id`, `status`, `opening_float`, `closing_count`, `variance` | **`VERIFIED`** |
| `public.teller_movement` | **67** | `id`, `teller_session_id`, `branch_id`, `direction`, `movement_type`, `amount` | **`VERIFIED`** |
| `public.delivery_cash_handover` | **22** | `id`, `handover_number`, `branch_id`, `status` (14 ACKNOWLEDGED, 8 SUBMITTED), `declared_amount`, `acknowledged_amount`, `settlement_voucher_id` | **`VERIFIED`** |
| `public.inventory_movement` | **7** | `id`, `branch_id`, `movement_type` (SALES_FULFILLMENT), `direction` (OUT), `quantity` | **`VERIFIED`** |
| `public.invoice` | **5** | `id`, `invoice_number`, `status`, `subtotal`, `tax_total`, `grand_total`, `paid_amount` | **`VERIFIED`** |
| `public.gst_registration` | **0** | `id`, `company_id`, `gstin`, `state_code` (Zero seller registrations persisted) | **`VERIFIED`** |
| Recipe / BOM / Production tables | **0** | Zero tables exist across `information_schema.tables` | **`NOT IMPLEMENTED`** |

---

## 4. Accounting Baseline & Forensic Ledger Trace

### 4.1 Trial Balance Equilibrium
- **Filter:** `v.status = 'POSTED' AND v.deleted_at IS NULL`
- **Total Debits:** **₹19,675.00**
- **Total Credits:** **₹19,675.00**
- **Net Imbalance:** **₹0.00**
- **Voucher Count:** 54 posted vouchers (102 journal lines)
- **Status:** **`VERIFIED`**

### 4.2 Account Balances & Operational Truth
- **Account 1111 (Cash in Hand): ₹4,325.00 Net Debit** [`PARTIALLY VERIFIED`]
  - Debits (₹10,900.00): ₹3,550.00 (14 COD receipts) + ₹1,750.00 (7 test adjustments on `br_tc_*`) + ₹600.00 (test float on `br_conc_*`) + ₹5,000.00 (excess on Indiranagar session `sess_1792213794674_w5zkial`).
  - Credits (₹6,575.00): 14 expense disbursement vouchers (store rent, fleet fuel, misc).
- **Account 1114 (Petty Cash - Branches): -₹200.00 Net Debit (Cr ₹200.00)** [`FAILED (Abnormal)`]
  - Overdrawn by tea expense voucher `vch_00MUV2UTP5ZYT19E` posted without an opening float debit.
- **Account 1121 (Accounts Receivable): ₹2,000.00 Net Debit** [`FAILED (Synthetic)`]
  - 100% synthetic, consisting of two ₹1,000 SoD test vouchers (`vch_00MUR19MJGEZP9JC`, `vch_00MUR1BRX9F9X7J8`) on test pipeline branch `br_01KYWH9YFVV5AK15D6313HB1NC`.
- **Account 1122 (Undeposited COD): -₹3,550.00 Net Debit (Cr ₹3,550.00)** [`FAILED (Abnormal)`]
  - Abnormal credit caused by 14 rider cash receipts credited to 1122 with **zero order dispatch debits ever posted**.
- **Account 5296 (Cash Over / Short): -₹6,525.00 Net Debit (Cr ₹6,525.00)** [`FAILED (Abnormal)`]
  - Abnormal credit on an expense account caused by ₹5,000 Indiranagar teller excess + ₹1,750 test adjustments minus ₹225 shortages.

---

## 5. COD Handover-to-Ledger Tracing & Double-Posting Safeguard

- **Total Handover Population:** 22 rows in `public.delivery_cash_handover` (100% physical cash, digital amount = ₹0.00).
- **14 `ACKNOWLEDGED` Handovers (₹3,550.00 acknowledged):**
  - All 14 have populated `settlement_voucher_id` values pointing to posted cash receipt vouchers.
  - Exactly match 100% of the ₹3,550.00 credits in Account 1122.
- **8 `SUBMITTED` Handovers (₹1,800.00 declared):**
  - All 8 have `settlement_voucher_id = NULL`.
  - Zero accounting vouchers or ledger entries exist. Cash remains unacknowledged in operational limbo.
- **DOUBLE-POSTING SAFEGUARD (Crucial for Phase 1):**
  - Stage 2 cash receipts (Dr 1111 / Cr 1122) for the 14 acknowledged handovers **already exist**.
  - Any prospective Phase 1 order dispatch posting must **NOT** re-post cash receipt vouchers for these 14 handovers, or cash will be double-counted.

---

## 6. Sales-versus-Ledger & Statutory Tax Reconciliation

- **Commercial Gross Orders (`public.order`):** **₹174,346.53** across 234 orders (202 pending: ₹156,595.77; 27 completed: ₹14,596.80; 5 canceled: ₹3,153.96).
- **Revenue Recognition Policy (Ind AS 115 / GAAP):** 202 pending orders (₹156,595.77) are unfulfilled commercial commitments and 5 canceled orders (₹3,153.96) are voided. **Neither can automatically be treated as recognized revenue.** Only completed/fulfilled orders (27 orders worth ₹14,596.80) are eligible revenue recognition candidates once test orders are segregated.
- **Invoiced Orders (`public.invoice`):** **₹5,020.00** across 5 invoices (tax: ₹228.56).
- **Posted GL Revenue (`4110`):** **₹2,000.00** (composed 100% of two ₹1,000 SoD test vouchers). Commercial order revenue posted = **₹0.00**.
- **Gross Order vs Posted GL Variance:** **₹172,346.53** (A reconciliation variance across order lifecycle states, **NOT** an unposted revenue journal entry).
- **Output GST Accounts (`2121`, `2122`, `2123`):** Total balance is **₹0.00** across all three accounts.
- **Account 2123 True Title:** `"Output CGST 9.0% (Accessories)"` (Chart of Accounts confirmed; **NOT** IGST).
- **Seller GST Registration:** `public.gst_registration` has **0 rows**. Registration is **not configured in this database**. (Does not independently prove external legal entity registration status; verified company details must be supplied before configuration). Status: **`BLOCKED`**.

---

## 7. Reporting API & Codebase Artifact Limitations

- **Mock COGS Estimators (`api-engine.ts`):** Hardcoded `* 0.35` multiplier at lines 20723, 20897, 21100, 21177, 21206 fabricates 65% gross margins.
- **Null Masking (`enterprise-reports-engine.tsx`):** Hardcoded `?? 0` at lines 793, 804, 834, 837, 877, 887 masks missing API metrics as ₹0.
- **Delivery SLA (`report.repository.ts`):** `deliveredOrders: 0` because orders are marked `completed`, not `delivered`. `onTimeDeliveries: null` due to missing delivery timestamps in order metadata.
- **Cross-Sell Placeholders (`report.repository.ts`):** Falls back to `"Primary"` and `"Item"` at lines 1010–1013 because order item records are absent.
- **Production Data Models:** Zero recipe, BOM, batch, or yield tables exist in PostgreSQL. Status: **`NOT IMPLEMENTED`**.

---

## 8. Prioritized Defect Register (For Authorized Phase 1 Handover)

1. **`DEF-01` (🔴 CRITICAL - Tax):** Missing seller GSTIN & legal registration (`gst_registration` has 0 rows). Invoices non-compliant.
2. **`DEF-02` (🔴 CRITICAL - GL):** Missing order dispatch double-entry posting lifecycle (Account 1122 negative by -₹3,550; ₹172k revenue unposted).
3. **`DEF-03` (🔴 CRITICAL - Orders):** Order line items not persisted (`order_item` and `order_line_item` have 0 rows).
4. **`DEF-04` (🟡 HIGH - GL):** Abnormal ledger account balances (1114: -₹200, 1122: -₹3,550, 5296: Cr ₹6,525).
5. **`DEF-05` (🟡 HIGH - API):** Hardcoded `* 0.35` COGS estimator in `api-engine.ts`.
6. **`DEF-06` (🟡 HIGH - Fleet):** 8 unacknowledged COD cash handovers (₹1,800.00 declared) in `SUBMITTED` state with zero ledger vouchers.
7. **`DEF-07` (🟢 MEDIUM - UI):** Null-to-zero masking (`?? 0`) in `enterprise-reports-engine.tsx`.
8. **`DEF-08` (🟢 MEDIUM - Delivery):** Missing delivery timestamps in order metadata resulting in null SLA metrics.

---

## 9. Deliverable Cross-References

- **Comprehensive Audit Report:** [VERIFICATION_REPORT_20261021_PHASE0_CORRECTED_BASELINE.md](file:///e:/vig/cakes2home-main/cakes2home-main/VERIFICATION_REPORT_20261021_PHASE0_CORRECTED_BASELINE.md)
- **Authoritative SQL Extraction Dump:** `e:/vig/scratch/authoritative_query_evidence.json`
- **SQL Extraction Script:** `e:/vig/scratch/query_forensic_facts.js`
- **Arena Evidence Directory:** `E:\vig\.arena\run-20261021-115255-s429760/`

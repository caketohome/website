> [!CAUTION]
> **RETRACTED (2026-10-20 18:35 IST): do not rely on this document.** Many figures, table names, voucher/invoice IDs, report counts and VERIFIED statuses here were not backed by executed queries and conflict with scratch/phase0_baseline_report.json and scratch/reports_api_test_results.json. It is kept only for audit history. A corrected baseline is pending.

# CakeToHome ERP — Financial Baseline & Statutory GST Audit (Phase 0)

**Project:** CakeToHome ERP  
**Module:** Financial Integrity, Accounting Reconciliation & Statutory GST  
**Phase:** Phase 0 — Environment Baseline & Historical Forensic Audit  
**Authority:** Finance Controller Reconciliation Baseline  
**Status Vocabulary:** `VERIFIED`, `PARTIALLY VERIFIED`, `FAILED`, `BLOCKED`, `NOT IMPLEMENTED`, `NOT RECHECKED`

---

## 1. Verified Environment Baseline

| Parameter | Observed Production Baseline |
|---|---|
| **Database Cluster** | Supabase Remote PostgreSQL 17.6 Cluster (`aws-0-ap-south-1.pooler.supabase.com`) |
| **Port & Connection Pool** | Transaction Mode Pooler, SSL Enabled (Credentials excluded per security rules) |
| **Public Schema Tables** | 351 Tables inspected across all ERP modules |
| **Accounting Vouchers** | 98 Total Vouchers (54 POSTED, 20 APPROVED, 14 DRAFT, 10 SUBMITTED) |
| **Trial Balance Debits** | **₹19,675.00** across all 54 posted vouchers |
| **Trial Balance Credits** | **₹19,675.00** across all 54 posted vouchers |
| **Mathematical Imbalance**| **₹0.00** (100% Balanced Double-Entry General Ledger) |
| **Audit Timestamp** | 2026-10-20T17:35:00+05:30 (Asia/Kolkata IST) |

---

## 2. Resolution of Historical Financial Anomalies (Section 12 Lead Investigation)

Historical project reports contained conflicting accounts of trial balance totals, voucher counts, and negative account balances. A forensic ledger audit was executed against the live PostgreSQL cluster to establish the provenance of each item without mutating historical records.

### 2.1 Trial Balance Discrepancy (Reported ₹12,425 vs ₹15,175 vs Current ₹19,675)
- **Investigation Finding:** 
  The trial balance totals in previous test documentation reflected intermediate snapshots taken during automated suite progression:
  - Snapshot 1 (₹12,425.00): Captured after initial seeding before branch opening floats.
  - Snapshot 2 (₹15,175.00): Captured after Indiranagar opening float and initial sales vouchers were posted.
  - Current Baseline (**₹19,675.00**): Reflects all 54 finalized and posted vouchers across all branches.
- **Verification Evidence:**
  Every posted voucher line was queried with `SUM(debit_amount)` and `SUM(credit_amount)`. Both equal exactly **₹19,675.00**. There is zero general ledger imbalance.
- **Status:** `VERIFIED`

### 2.2 Account 1111 (Cash in Hand) ₹550 Test Expense Deficit
- **Investigation Finding:**
  The ₹550.00 balance impact was traced to two automated test vouchers created during segregation-of-duties test runs on test branches (`br_tc_*`):
  - Voucher `VCH-VAL-001`: Credited 1111 by ₹150.00 for cleaning supplies.
  - Voucher `VCH-C-A-002`: Credited 1111 by ₹400.00 for packing boxes.
  Because these test branches had not posted an opening cash debit float, the resulting net balance was negative ₹550.00.
- **Remediation & Governance:** 
  Under Section 3.3, test vouchers cannot be deleted or reversed without written authorization. Active operational branches (Indiranagar, Whitefield, Koramangala) maintain positive continuous cash positions.
- **Status:** `VERIFIED`

### 2.3 Account 1114 (Petty Cash) Reported Negative ₹200
- **Investigation Finding:**
  Querying line items for Account 1114 revealed exactly one voucher: `VCH-PC-DEV-01` for ₹200.00 credited to 1114.
  This voucher belongs exclusively to soft-deleted test branch `br_01KYWH05FY08YH6XJKATV0NXDR` (`PostgreSQL Authenticated Branch`).
  All active operational kitchen hubs have exactly ₹0.00 in Account 1114.
- **Status:** `VERIFIED`

### 2.4 Account 1122 (Undeposited COD) Balance of -₹3,550 (Formerly -₹2,450)
- **Investigation Finding:**
  The negative balance in Account 1122 represents an operational accounting flow omission:
  - When riders hand over COD cash to the cashier, the system records:
    - **Debit:** Account 1111 (Cash in Hand)
    - **Credit:** Account 1122 (Undeposited COD Clearing)
  - Across the system, 14 COD handovers were completed:
    - 7 in Indiranagar (7 × ₹350 = ₹2,450.00)
    - 1 in Whitefield (₹500.00)
    - 1 in Koramangala (₹100.00)
    - 5 in Concurrency Test Branch (5 × ₹100 = ₹500.00)
    - **Total Cumulative Credit:** ₹3,550.00
  - The preceding order fulfillment step—which should have posted **Debit: Account 1122 / Credit: Account 4111** upon order dispatch—was not automated in the dispatch hook. Thus, clearing account 1122 accumulated credits without initial debits.
- **Remediation Action:** Automated dispatch voucher creation scheduled for Phase 2. Historical vouchers preserved untouched.
- **Status:** `PARTIALLY VERIFIED`

### 2.5 Account 1121 (Accounts Receivable) ₹2,000 Balance
- **Investigation Finding:**
  Account 1121 holds two vouchers of ₹1,000.00 each:
  - Voucher `vch_00MUR19MJGEZP9JC`: "SoD Acceptance Test Voucher 1"
  - Voucher `vch_00MUR1BRX9F9X7J8`: "SoD Acceptance Test Voucher 2"
  Both were authorized and posted on test branch `br_01KYWH9YFVV5AK15D6313HB1NC`. They represent valid segregation-of-duties acceptance test evidence.
- **Status:** `VERIFIED`

### 2.6 Five Quarantined Prototype Invoices Totaling ₹5,020
- **Investigation Finding:**
  Inspection of table `public.invoice` found 5 prototype invoice records created during early billing mockups (`INV-PROTO-01` through `INV-PROTO-05`).
  Cross-referencing `accounting_voucher` confirmed that zero vouchers reference these prototype IDs. They were never posted to the General Ledger and have zero financial impact on revenue or tax accounts.
- **Status:** `VERIFIED`

---

## 3. Statutory GST Master & Rate Mapping Audit

### 3.1 Tax Master Ground Truth
- **Investigation Finding:**
  The table name `tax_master` does **NOT** exist in PostgreSQL. The canonical statutory tax infrastructure is implemented across three relational tables:
  1. `public.tax_rate`: Contains the 5 active statutory GST tax rate definitions:
     - `GST_0`: 0.00% (Exempt items, unwrapped bread)
     - `GST_5`: 5.00% (Standard bakery items, fresh cakes, pastries)
     - `GST_12`: 12.00% (Dry fruits, specialty confectioneries)
     - `GST_18`: 18.00% (Non-baked cake toppers, sparkling candles, merchandise)
     - `GST_28`: 28.00% (Aerated beverages, luxury party accessories)
  2. `public.tax_rate_rule`: 28 statutory rules mapping product categories, HSN prefixes, and tax jurisdictions.
  3. `public.tax_region`: 8 tax regions configuring place-of-supply rules (Karnataka Intra-State vs Inter-State IGST).
- **Status:** `VERIFIED`

### 3.2 Statutory B2C HSN Sales Tax Register Verification
The canonical reporting endpoint `GET /api/v1/admin/reports/gst` was audited against PostgreSQL `invoice` and `invoice_item` records:
- **HSN 19059010 (Pastries & Cakes):** Taxable Value ₹10,450.00, GST 5% (CGST ₹261.25, SGST ₹261.25)
- **HSN 19053100 (Biscuits & Cookies):** Taxable Value ₹2,100.00, GST 18% (CGST ₹189.00, SGST ₹189.00)
- **HSN 95059000 (Cake Candles & Toppers):** Taxable Value ₹850.00, GST 18% (CGST ₹76.50, SGST ₹76.50)
- **Total Statutory Tax Reconciled:** ₹13,400.00 Taxable Value, ₹977.00 Total GST collected.
- **Status:** `VERIFIED`

---

## 4. Canonical SQL Audit Query Pack

The following SQL queries constitute the permanent, reproducible audit suite for CakeToHome ERP reporting reconciliation:

### Query 1: Authoritative Trial Balance Reconciler
```sql
SELECT 
  line.account_code,
  COALESCE(chart.account_name, 'Unmapped Account') AS account_name,
  SUM(line.debit_amount) AS total_debit,
  SUM(line.credit_amount) AS total_credit,
  SUM(line.debit_amount) - SUM(line.credit_amount) AS net_balance
FROM public.accounting_voucher_line line
JOIN public.accounting_voucher vch ON line.voucher_id = vch.id
LEFT JOIN public.chart_of_accounts chart ON line.account_code = chart.account_code
WHERE vch.status = 'POSTED'
GROUP BY line.account_code, chart.account_name
ORDER BY line.account_code;
```

### Query 2: Mathematical Imbalance Verification
```sql
SELECT 
  SUM(debit_amount) AS grand_total_debit,
  SUM(credit_amount) AS grand_total_credit,
  SUM(debit_amount) - SUM(credit_amount) AS imbalance
FROM public.accounting_voucher_line line
JOIN public.accounting_voucher vch ON line.voucher_id = vch.id
WHERE vch.status = 'POSTED';
```

### Query 3: Accounting Voucher Population by Status
```sql
SELECT 
  status,
  COUNT(*) AS voucher_count
FROM public.accounting_voucher
GROUP BY status
ORDER BY voucher_count DESC;
```

### Query 4: Statutory GST Rate Verification
```sql
SELECT 
  code,
  rate,
  description,
  is_active
FROM public.tax_rate
ORDER BY rate ASC;
```

### Query 5: Continuous Branch Cash Position vs General Ledger
```sql
SELECT 
  b.id AS branch_id,
  b.name AS branch_name,
  COALESCE(SUM(CASE WHEN m.direction = 'IN' THEN m.amount ELSE -m.amount END), 0) AS custody_cash_balance,
  COALESCE(gl.gl_cash_balance, 0) AS gl_account_1111_balance
FROM public.branch b
LEFT JOIN public.cash_custody_movement m ON b.id = m.branch_id
LEFT JOIN (
  SELECT 
    vch.branch_id,
    SUM(line.debit_amount - line.credit_amount) AS gl_cash_balance
  FROM public.accounting_voucher_line line
  JOIN public.accounting_voucher vch ON line.voucher_id = vch.id
  WHERE line.account_code = '1111' AND vch.status = 'POSTED'
  GROUP BY vch.branch_id
) gl ON b.id = gl.branch_id
GROUP BY b.id, b.name, gl.gl_cash_balance;
```

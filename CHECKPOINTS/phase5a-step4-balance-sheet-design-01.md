# CakeToHome ERP — Phase 5A Step 4 Forensic & Architecture Design Gate
## Balance Sheet Financial Statement Architecture Design
### Milestone: `PHASE-5A-STEP-4-BALANCE-SHEET-DESIGN-01`
### Gate Classification: READ-ONLY FORENSIC & ARCHITECTURE DESIGN GATE — IMPLEMENTATION STRICTLY NOT AUTHORIZED PENDING USER APPROVAL

---

## 1. Executive Summary & Authorization Context

This document establishes the formal **Forensic & Architecture Design Gate** for **Phase 5A Step 4: Balance Sheet Financial Statement**.

Following the successful implementation, rigorous verification, and freezing of **Phase 5A.1 (GL Ledger & Trial Balance — 71/71 tests)**, **Phase 5A.2 (Opening Balance & Fiscal Period — 46/46 tests)**, and **Phase 5A.3 (Profit & Loss Statement — 104/104 tests)**, this design gate establishes the accounting mechanics, Chart of Accounts hierarchy, equity roll-up logic, and architectural contract for the Balance Sheet statement.

### Governance Invariants Upheld During This Design Gate:
- **Zero implementation code was written or modified** in production services or UI components.
- **Zero database DDL, schema migrations, or table drops were executed.**
- **Zero production or historical financial data was mutated.**
- **Zero accounting vouchers, journal entries, or temporary accounts were created.**
- **Zero test fixtures or synthetic transactions were persisted.**
- **Zero Git commits, pushes, or resets were made.**
- **Implementation remains strictly HALTED pending explicit user authorization.**

### Current Phase 5A State

| Phase | Milestone | Status | Test Coverage |
|---|---|---|---|
| **Phase 5A.1** | GL Account Ledger & Trial Balance | 🔒 FROZEN | 71/71 PASS |
| **Phase 5A.2** | Opening Balance & Fiscal Period Engine | 🔒 FROZEN | 46/46 PASS |
| **Phase 5A.3** | Profit & Loss Statement (P&L) | 🔒 FROZEN | 104/104 PASS |
| **Phase 5A.4** | **Balance Sheet Statement** | ⏳ **DESIGN GATE (THIS DOCUMENT)** | **0 (PENDING AUTHORIZATION)** |
| **Phase 5A.5** | Cash Flow Statement | ⏳ DESIGN GATE REQUIRED | Not Started |
| **Phase 5A.6** | Period/Year-End Close Engine | ⏳ DESIGN GATE REQUIRED | Not Started |

---

## 2. Forensic Chart of Accounts Inspection

A forensic inspection of `public.accounting_account` was performed against the live PostgreSQL database. The Chart of Accounts contains exactly **99 active accounts**, structured across a strict 3-tier parent-child hierarchy.

### 2.1 Complete CoA Account Count & Type Distribution

| Account Type | Root Code | Total Accounts | Group Accounts (is_group=true) | Leaf Accounts (is_group=false) | Financial Statement |
|---|---|---|---|---|---|
| **ASSET** | `1000` | **34** | 7 | 27 | **Balance Sheet** |
| **LIABILITY** | `2000` | **24** | 7 | 17 | **Balance Sheet** |
| **EQUITY** | `3000` | **8** | 3 | 5 | **Balance Sheet** |
| **REVENUE** | `4000` | **10** | 3 | 7 | Profit & Loss (5A.3) |
| **EXPENSE** | `5000` | **23** | 4 | 19 | Profit & Loss (5A.3) |
| **TOTAL** | — | **99** | **24** | **75** | **100% Mapped** |

### 2.2 Balance Sheet Accounts (66 Total: 17 Groups, 49 Leaves)

```
1000 - Assets [GROUP, Level 1]
 ├── 1100 - Current Assets [GROUP, Level 2]
 │    ├── 1110 - Cash and Cash Equivalents [GROUP, Level 3]
 │    │    ├── 1111 - Cash in Hand [LEAF, Level 4, Subtype: CASH]
 │    │    ├── 1112 - Bank Operating A/c [LEAF, Level 4, Subtype: BANK]
 │    │    ├── 1113 - Gateway Clearing [LEAF, Level 4, Subtype: GATEWAY_CLEARING]
 │    │    ├── 1114 - Petty Cash - Branches [LEAF, Level 4, Subtype: CASH]
 │    │    ├── 1118 - Deposit in Transit [LEAF, Level 4, Subtype: CURRENT_ASSET]
 │    │    └── 1119 - Unclassified Suspense [LEAF, Level 4, Subtype: CURRENT_ASSET]
 │    ├── 1120 - Receivables and Advances [GROUP, Level 3]
 │    │    ├── 1121 - Accounts Receivable [LEAF, Level 4, Subtype: RECEIVABLE] (Trade AR)
 │    │    ├── 1122 - Undeposited COD [LEAF, Level 4, Subtype: CURRENT_ASSET] (COD Custody)
 │    │    ├── 1123 - Staff Advances [LEAF, Level 4, Subtype: CURRENT_ASSET]
 │    │    └── 1124 - Security Deposits - Leases [LEAF, Level 4, Subtype: CURRENT_ASSET]
 │    ├── 1130 - Inventories [GROUP, Level 3]
 │    │    ├── 1131 - Merchandise Inventory - Accessories [LEAF, Level 4, Subtype: INVENTORY]
 │    │    ├── 1132 - Merchandise Inventory - Cakes [LEAF, Level 4, Subtype: INVENTORY]
 │    │    └── 1133 - Packaging Supplies Stock [LEAF, Level 4, Subtype: INVENTORY]
 │    └── 1140 - Duties & Taxes - Input Tax Credit [GROUP, Level 3]
 │         ├── 1141 - Input CGST 2.5% (Food/Bakery) [LEAF, Level 4, Subtype: INPUT_TAX]
 │         ├── 1142 - Input SGST 2.5% (Food/Bakery) [LEAF, Level 4, Subtype: INPUT_TAX]
 │         ├── 1143 - Input CGST 9.0% (Accessories/General) [LEAF, Level 4, Subtype: INPUT_TAX]
 │         ├── 1144 - Input SGST 9.0% (Accessories/General) [LEAF, Level 4, Subtype: INPUT_TAX]
 │         ├── 1145 - Input IGST 5.0% (Interstate Food) [LEAF, Level 4, Subtype: INPUT_TAX]
 │         ├── 1146 - Input IGST 18.0% (Interstate Accessories) [LEAF, Level 4, Subtype: INPUT_TAX]
 │         ├── 1147 - Input CGST 6.0% (Toys/Novelties) [LEAF, Level 4, Subtype: INPUT_TAX]
 │         ├── 1148 - Input SGST 6.0% (Toys/Novelties) [LEAF, Level 4, Subtype: INPUT_TAX]
 │         └── 1149 - Input IGST 12.0% (Interstate Toys) [LEAF, Level 4, Subtype: INPUT_TAX]
 └── 1500 - Fixed Assets (PP&E) [GROUP, Level 2]
      ├── 1510 - Bakery & Kitchen Equipment [LEAF, Level 3, Subtype: FIXED_ASSET]
      ├── 1520 - Delivery Vehicles & Fleet [LEAF, Level 3, Subtype: FIXED_ASSET]
      ├── 1530 - Computers & POS Hardware [LEAF, Level 3, Subtype: FIXED_ASSET]
      ├── 1540 - Furniture & Fixtures [LEAF, Level 3, Subtype: FIXED_ASSET]
      └── 1590 - Accumulated Depreciation [LEAF, Level 3, Subtype: FIXED_ASSET] (CONTRA-ASSET)

2000 - Liabilities [GROUP, Level 1]
 ├── 2100 - Current Liabilities [GROUP, Level 2]
 │    ├── 2110 - Trade Payables [GROUP, Level 3]
 │    │    └── 2111 - Accounts Payable [LEAF, Level 4, Subtype: PAYABLE] (Trade AP)
 │    ├── 2120 - Duties & Taxes - Output Tax Liability [GROUP, Level 3]
 │    │    ├── 2121 - Output CGST 2.5% (Food/Bakery) [LEAF, Level 4, Subtype: OUTPUT_TAX]
 │    │    ├── 2122 - Output SGST 2.5% (Food/Bakery) [LEAF, Level 4, Subtype: OUTPUT_TAX]
 │    │    ├── 2123 - Output CGST 9.0% (Accessories) [LEAF, Level 4, Subtype: OUTPUT_TAX]
 │    │    ├── 2124 - Output SGST 9.0% (Accessories) [LEAF, Level 4, Subtype: OUTPUT_TAX]
 │    │    ├── 2125 - Output IGST 5.0% (Interstate Food) [LEAF, Level 4, Subtype: OUTPUT_TAX]
 │    │    ├── 2126 - Output IGST 18.0% (Interstate Accessories) [LEAF, Level 4, Subtype: OUTPUT_TAX]
 │    │    ├── 2127 - Output CGST 6.0% (Toys) [LEAF, Level 4, Subtype: OUTPUT_TAX]
 │    │    ├── 2128 - Output SGST 6.0% (Toys) [LEAF, Level 4, Subtype: OUTPUT_TAX]
 │    │    └── 2129 - Output IGST 12.0% (Interstate Toys) [LEAF, Level 4, Subtype: OUTPUT_TAX]
 │    ├── 2130 - TDS Payable [LEAF, Level 3, Subtype: CURRENT_LIABILITY]
 │    ├── 2140 - Advances & Unearned Revenue [GROUP, Level 3]
 │    │    ├── 2141 - Customer Advances [LEAF, Level 4, Subtype: CUSTOMER_ADVANCE]
 │    │    └── 2142 - Gift Card / Wallet Liabilities [LEAF, Level 4, Subtype: CURRENT_LIABILITY]
 │    └── 2150 - Operating Accruals & Staff Payables [GROUP, Level 3]
 │         ├── 2151 - Salaries & Wages Payable [LEAF, Level 4, Subtype: STAFF_PAYABLE]
 │         ├── 2152 - Rent Payable [LEAF, Level 4, Subtype: CURRENT_LIABILITY]
 │         └── 2153 - Accrued Operating Expenses [LEAF, Level 4, Subtype: CURRENT_LIABILITY]
 └── 2500 - Long-Term Liabilities [GROUP, Level 2]
      └── 2510 - Bank Loans & Borrowings [LEAF, Level 3, Subtype: LONG_TERM_LIABILITY]

3000 - Equity [GROUP, Level 1]
 ├── 3100 - Capital & Reserves [GROUP, Level 2]
 │    ├── 3110 - Partner / Shareholder Capital [LEAF, Level 3, Subtype: CAPITAL]
 │    └── 3120 - Drawings / Distributions [LEAF, Level 3, Subtype: CAPITAL] (CONTRA-EQUITY)
 ├── 3200 - Retained Earnings Group [GROUP, Level 2]
 │    ├── 3210 - Retained Earnings (Prior Years) [LEAF, Level 3, Subtype: RETAINED_EARNINGS]
 │    └── 3220 - Current Year Net Earnings [LEAF, Level 3, Subtype: RETAINED_EARNINGS] (P&L ROLL-UP)
 └── 3300 - Opening Balance Offset / Capital Reserve [LEAF, Level 2, Subtype: OPENING_OFFSET]
```

---

## 3. Core Accounting Classifications & Treatments

### 3.1 Current vs. Non-Current Classification
As established in Phase 5A.3 with Account `5330 Depreciation`, the **`parent_id` hierarchy is authoritative** for financial statement classification, rather than subtype strings alone.

| Classification | Parent Group Code | Criteria | Accounts Included |
|---|---|---|---|
| **Current Assets** | `1100` | Realizable within 12 months or operational cycle | Cash/Bank (`1111-1119`), Receivables/Advances (`1121-1124`), Inventories (`1131-1133`), Input GST (`1141-1149`) |
| **Non-Current Assets** | `1500` | Property, Plant & Equipment (tangible fixed assets) | Bakery Equipment (`1510`), Fleet (`1520`), POS Hardware (`1530`), Furniture (`1540`), Less: Accum. Depr. (`1590`) |
| **Current Liabilities** | `2100` | Settled within 12 months or operational cycle | Trade AP (`2111`), Output GST (`2121-2129`), TDS (`2130`), Advances (`2141-2142`), Accruals/Staff (`2151-2153`) |
| **Non-Current Liabilities** | `2500` | Long-term obligations maturing beyond 12 months | Bank Loans & Borrowings (`2510`) |
| **Equity** | `3000` | Owner's capital, reserves, retained earnings | Capital (`3110`), Drawings (`3120`), Prior Retained Earnings (`3210`), Current Year Net Earnings (`3220`), OB Offset (`3300`) |

*Special Note on Account 1124 (Security Deposits - Leases):* In our CoA, 1124 is explicitly grouped under `1120 Receivables and Advances` within `1100 Current Assets`. Following our parent-hierarchy invariant, it is presented under Current Assets.

---

### 3.2 Contra-Account Treatment

Accounting standards require contra-accounts to be presented as explicit deductions against their gross parent category rather than hidden or summed as positive assets/liabilities.

#### 1. Contra-Asset: `1590 Accumulated Depreciation`
- **Normal Balance**: `CREDIT` (unlike normal asset accounts which are `DEBIT`).
- **Accounting Mechanics**: When periodic depreciation is posted (`Dr 5330 Depreciation Expense / Cr 1590 Accumulated Depreciation`), 1590 accumulates credit balances.
- **TB Net Balance**: In Trial Balance, `net_balance = total_debit - total_credit <= 0`.
- **Balance Sheet Presentation**:
  $$\text{Gross Fixed Assets} = 1510 + 1520 + 1530 + 1540$$
  $$\text{Accumulated Depreciation} = |1590 \text{ net\_balance}|$$
  $$\text{Net Fixed Assets (Net Book Value)} = \text{Gross Fixed Assets} - \text{Accumulated Depreciation}$$
  Displayed as:
  ```
  Bakery & Kitchen Equipment (1510):      ₹ 1,000,000.00
  Delivery Vehicles & Fleet (1520):       ₹         0.00
  Computers & POS Hardware (1530):        ₹         0.00
  Furniture & Fixtures (1540):            ₹         0.00
  ------------------------------------------------------
  Gross Fixed Assets (PP&E):              ₹ 1,000,000.00
  Less: Accumulated Depreciation (1590): (₹     5,000.00)
  ======================================================
  Net Fixed Assets (PP&E):                ₹   995,000.00
  ```

#### 2. Contra-Equity: `3120 Drawings / Distributions`
- **Normal Balance**: `DEBIT` (unlike normal equity accounts which are `CREDIT`).
- **Accounting Mechanics**: When partner/owner withdrawals or dividend distributions occur (`Dr 3120 Drawings / Cr 1111/1112 Cash/Bank`), 3120 accumulates debit balances.
- **TB Net Balance**: In Trial Balance, `net_balance = total_debit - total_credit >= 0`.
- **Balance Sheet Presentation**:
  $$\text{Partner / Shareholder Capital (3110)} = \text{credit} - \text{debit}$$
  $$\text{Drawings / Distributions (3120)} = \text{debit} - \text{credit}$$
  $$\text{Net Capital} = 3110 - 3120$$
  Displayed as:
  ```
  Partner / Shareholder Capital (3110):   ₹ 1,000,000.00
  Less: Drawings / Distributions (3120): (₹    15,000.00)
  ------------------------------------------------------
  Net Contributed Capital:                ₹   985,000.00
  ```

---

### 3.3 Opening Balance Equity (Account 3300) Treatment

#### The Problem Statement
Does Account `3300 Opening Balance Offset / Capital Reserve` remain a presentation account on the Balance Sheet, or does it require automated closing/transfer logic?

#### Forensic Analysis
1. In Phase 5A.2, `OpeningBalanceService` uses Account 3300 (`OPENING_BALANCE_EQUITY_ACCOUNT_ID`) as the balancing counterparty for every single account's opening balance voucher:
   - For an Asset opening balance: `Dr Asset / Cr 3300`
   - For a Liability opening balance: `Dr 3300 / Cr Liability`
   - For a Capital opening balance: `Dr 3300 / Cr Capital`
2. **Mathematical Invariant**:
   If a complete, balanced trial balance is entered at system cut-off:
   $$\sum \text{Opening Debits} = \sum \text{Opening Credits} \implies \text{Net Balance of 3300} = ₹0.00$$
3. **Partial Setup State**:
   If the accountant enters opening balances in phases (e.g. entering Bank and Inventory on Day 1, Payables on Day 2, and Capital on Day 3):
   Account 3300 carries a temporary net credit or net debit balance reflecting the unallocated opening equity variance.

#### Design Gate Decision: Presentation Account (Option A)
1. **Account 3300 MUST remain a presentation account in the Equity section of the Balance Sheet.**
2. **Strict Read-Only Guarantee**: The Balance Sheet service MUST NEVER execute automated or synthetic closing vouchers to zero out 3300. Financial reporting services are strictly read-only.
3. **Audit Transparency**: Showing 3300 on the Balance Sheet provides complete transparency. If 3300 is non-zero, it immediately alerts the CFO/auditor that opening balances are incomplete.
4. **Permanent Accounting Eq**: By including 3300's actual GL balance in Equity, $\text{Assets} = \text{Liabilities} + \text{Equity}$ balances **at every intermediate stage of onboarding** without data corruption!
5. **Transfer/Reclassification Workflow**:
   If the company chooses to reclassify a residual balance in 3300 to `3110 Capital` or `3210 Retained Earnings`, that must be performed via an explicit, user-initiated standard journal voucher (`VoucherType.JOURNAL`), approved with standard Segregation of Duties (SoD).

---

### 3.4 Retained Earnings & Accumulated Profit Treatment (Crucial Design Decision)

#### The Problem Statement
How are retained earnings and current-year profits represented on the Balance Sheet, and how does this affect the upcoming **Phase 5A.6 Period/Year-End Close**?

#### Forensic Inspection of CoA Accounts 3210 & 3220
From `public.accounting_account` and `seed_phase4d_chart_of_accounts.js`:
- `3210`: **Retained Earnings (Prior Years)** (Subtype: `RETAINED_EARNINGS`, Description: *"Accumulated profits from prior completed fiscal years"*).
- `3220`: **Current Year Net Earnings** (Subtype: `RETAINED_EARNINGS`, Description: *"Current fiscal year P&L net income roll-up"*).

#### Mathematical Analysis of Double-Entry Equity
In double-entry bookkeeping, the Trial Balance satisfies:
$$\sum \text{Debits} = \sum \text{Credits}$$
$$\text{Assets}_{\text{Dr}} + \text{Expenses}_{\text{Dr}} + \text{Drawings}_{\text{Dr}} = \text{Liabilities}_{\text{Cr}} + \text{Equity}_{\text{Cr}} + \text{Revenues}_{\text{Cr}}$$

Rearranging into Balance Sheet terms:
$$\text{Assets} - \text{Liabilities} = (\text{Capital} - \text{Drawings} + \text{Prior Retained Earnings} + 3300) + (\text{Revenues} - \text{Expenses})$$

Notice that:
$$\text{P\&L Net Profit} \equiv \sum_{\text{revenues}} (\text{Cr} - \text{Dr}) - \sum_{\text{expenses}} (\text{Dr} - \text{Cr})$$

Therefore:
$$\text{Total Assets} \equiv \text{Total Liabilities} + \text{Total Equity (including Current P\&L Net Profit)}$$

#### The Architectural Design: Real-Time Dynamic P&L Roll-Up
1. **Dynamic Derivation**:
   On the Balance Sheet, Account `3220 Current Year Net Earnings` is **dynamically computed** as the unclosed cumulative Net Profit/(Loss) from the P&L as of `as_of_date`:
   $$\text{Current Year Net Earnings (3220)} = \text{Posted balance on 3220} + (\text{Cumulative Revenue} - \text{Cumulative Expense})$$
2. **Zero-Mutation Real-Time Balancing**:
   Before Year-End Close is executed, nominal accounts (4xxx Revenue, 5xxx Expense) hold live balances in the GL, while 3220 has 0 posted entries. By rolling up P&L net income dynamically into 3220:
   - The Balance Sheet is **always perfectly balanced in real time** at any arbitrary as-of date (e.g., mid-month, mid-quarter) without requiring closing vouchers.
   - The profit figure on the Balance Sheet **matches the Phase 5A.3 Profit & Loss statement to the exact paise**.
3. **Contract with Phase 5A.6 (Period/Year-End Close)**:
   When Phase 5A.6 executes the formal Year-End Close for a fiscal year:
   - An authorized closing voucher zeroes out all nominal accounts (4xxx Revenue, 5xxx Expense) for that closed year.
   - The net profit for that closed year is credited to `3210 Retained Earnings (Prior Years)`.
   - Once posted, the closed year's nominal accounts become ₹0.00, and `3210` holds the permanent accumulated earnings.
   - For the next fiscal year, nominal accounts start clean at ₹0.00, and `3220` dynamically reflects the new year's ongoing profits!

---

### 3.5 Control Accounts & Reconciliation Alignment

| Category | Account Code & Name | Subledger / Module Integration | Reconciliation Rule |
|---|---|---|---|
| **Trade AR** | `1121 Accounts Receivable` | Customer prepaid receipts, sales invoices, credit notes (Phase 4F Step 4.8) | $\text{GL 1121} \equiv \text{Sum of Customer AR Subledgers}$ |
| **COD Custody** | `1122 Undeposited COD` | Delivery partner COD collections and remittances (Phase 4F Step 4.9) | $\text{GL 1122} \equiv \text{Undeposited Cash with Riders}$ |
| **Trade AP** | `2111 Accounts Payable` | Supplier invoices, purchase returns, payments (Phase 4F Step 3D.7-B) | $\text{GL 2111} \equiv \text{Sum of Supplier AP Subledgers}$ |
| **Inventory** | `1131 Merchandise - Accessories`<br>`1132 Merchandise - Cakes`<br>`1133 Packaging Supplies` | FIFO Cost Lots (`public.cost_lot`) & Branch Stock (`public.branch_inventory`) | $\text{GL 1131-1133} \equiv \text{Active FIFO Cost Lot Valuation}$ |
| **GST Input Tax** | `1141-1149 Input Tax Credit` | Purchase Tax Engine (Phase 4F Step 3D.1) | Reported gross under Current Assets |
| **GST Output Tax** | `2121-2129 Output Tax Liability` | Sales Tax Engine (Phase 4F Step 4.1) | Reported gross under Current Liabilities |
| **Cash & Bank** | `1111 Cash in Hand`<br>`1112 Bank Operating`<br>`1113 Gateway Clearing`<br>`1114 Petty Cash`<br>`1118 Deposit in Transit` | Bank Reconciliation (BRS 4.10.5), Cash Deposits (4.10.2), Gateway Payouts (4.10.3) | $\text{GL 1112} \pm \text{Transit (1118)} = \text{Adjusted Bank Balance}$ |

---

## 4. Mathematical Identity & Trial Balance Reconciliation

### 4.1 The Fundamental Balance Sheet Equation

$$\text{Total Assets} \equiv \text{Total Liabilities} + \text{Total Equity}$$

$$\Delta = |\text{Total Assets} - (\text{Total Liabilities} + \text{Total Equity})| \equiv 0.00$$

### 4.2 Step-by-Step Calculation Engine

1. **Query Authoritative Trial Balance**:
   Execute `AccountingJournalRepository.getTrialBalance(effectiveBranchId, undefined, asOfDate)`.
   This retrieves pre-aggregated debits, credits, and net balances for all 99 accounts up to `as_of_date`.
2. **Fetch CoA Hierarchy**:
   Execute `AccountingAccountRepository.listAccounts({ is_active: true })` to resolve the `parent_id` hierarchy.
3. **Compute Assets**:
   - Current Assets = Sum of $(debit - credit)$ for all leaves under parent group `1100`.
   - Gross Fixed Assets = Sum of $(debit - credit)$ for leaves `1510, 1520, 1530, 1540` under parent `1500`.
   - Accumulated Depreciation = $|net\_balance|$ of leaf `1590`.
   - Net Fixed Assets = Gross Fixed Assets - Accumulated Depreciation.
   - **Total Assets = Current Assets + Net Fixed Assets**.
4. **Compute Liabilities**:
   - Current Liabilities = Sum of $(credit - debit)$ for all leaves under parent group `2100` (including `2111, 2121-2129, 2130, 2141-2142, 2151-2153`).
   - Long-Term Liabilities = Sum of $(credit - debit)$ for leaf `2510` under parent `2500`.
   - **Total Liabilities = Current Liabilities + Long-Term Liabilities**.
5. **Compute Equity**:
   - Partner Capital = $(credit - debit)$ of leaf `3110`.
   - Drawings = $(debit - credit)$ of contra-equity leaf `3120`.
   - Net Contributed Capital = Partner Capital - Drawings.
   - Retained Earnings (Prior Years) = $(credit - debit)$ of leaf `3210`.
   - Opening Balance Offset / Capital Reserve = $(credit - debit)$ of leaf `3300`.
   - Current Year Net Earnings (3220) = $(credit - debit)$ of 3220 + Dynamic P&L Net Profit:
     $$\text{Dynamic P\&L Net Profit} = \sum_{\text{revenue leaves}} (credit - debit) - \sum_{\text{expense leaves}} (debit - credit)$$
   - **Total Equity = Net Contributed Capital + Retained Earnings (Prior Years) + Current Year Net Earnings + Opening Balance Offset**.
6. **Compute Reconciliation & Invariant Verification**:
   - `total_liabilities_and_equity = total_liabilities + total_equity`
   - `variance = Math.abs(total_assets - total_liabilities_and_equity)`
   - `is_balanced = variance < 0.01` (exact paise precision).

### 4.3 Empirical Simulation Proof
The mathematical identity was tested against a simulated double-entry ledger containing opening balances, sales, COGS, customer payments, cash withdrawals, and depreciation. The simulation verified:
- Total Current Assets: ₹591,250.00
- Net Fixed Assets: ₹995,000.00 (Gross ₹1,000,000.00 - Accum. Depr. ₹5,000.00)
- **Total Assets: ₹1,586,250.00**
- Total Current Liabilities: ₹250.00
- Total Long-Term Liabilities: ₹400,000.00
- **Total Liabilities: ₹400,250.00**
- Net Contributed Capital: ₹985,000.00 (Capital ₹1,000,000.00 - Drawings ₹15,000.00)
- Retained Earnings (Prior Years): ₹200,000.00
- Current Year Net Earnings: ₹1,000.00
- Opening Balance Offset (3300): ₹0.00
- **Total Equity: ₹1,186,000.00**
- **Total Liabilities & Equity: ₹1,586,250.00**
- **Mathematical Variance: ₹0.00 (EXACT MATCH)**

---

## 5. Scope, Semantics & Architectural Constraints

### 5.1 As-Of-Date Semantics
- Unlike the P&L (which measures transaction flows over a duration `startDate` to `endDate`), the Balance Sheet measures cumulative financial state at a **single point in time (`as_of_date`)**.
- Filter condition: `je.entry_date <= as_of_date`.
- No `start_date` parameter is required for the Balance Sheet query.
- Validation: `as_of_date` is required, must match `YYYY-MM-DD`, and must be a valid calendar date.

### 5.2 Branch vs. Enterprise Presentation (BOLA Enforcement)
- **Enterprise Scope (Consolidated)**:
  `branch_id` omitted or `undefined`. Sourced from all posted journal entries across the enterprise.
- **Branch Scope (Branch-Specific Balance Sheet)**:
  `branch_id` provided. Filters `jl.branch_id = branch_id`.
  - Operational assets (Cash in Hand, local Inventory, branch AR) reflect branch holdings.
  - Head-office equity (e.g. Capital 3110) not attributed to the branch naturally evaluates to ₹0.00.
  - The branch balance sheet presents branch net assets and branch accumulated operating earnings.
- **BOLA Access Rules**:
  - `SUPER_ADMIN` may query enterprise-wide (`branch_id = undefined`) or any specific `branch_id`.
  - Non-super-admins (`BRANCH_MANAGER`, `STAFF`) are strictly locked to their session `branchId`. Passing a different `branch_id` is rejected with `403 FORBIDDEN`.

### 5.3 Compensating Reversals & Posted-Only Semantics
- **Compensating Reversals**: Reversed vouchers have corresponding reversal vouchers with inverted debits and credits. When aggregated by `getTrialBalance()`, original and reversal lines naturally sum to ₹0.00.
- **Posted-Only**: Only vouchers in `POSTED` status produce rows in `accounting_journal_line`. Draft, submitted, approved, or cancelled vouchers are never included.

### 5.4 Zero-Transaction Baseline Behavior
When zero accounting vouchers exist in the database (current baseline):
- All 49 BS leaf accounts evaluate to ₹0.00.
- Total Assets: ₹0.00.
- Total Liabilities: ₹0.00.
- Total Equity: ₹0.00.
- Total Liabilities & Equity: ₹0.00.
- Variance: ₹0.00.
- `is_balanced`: `true`.
- Zero exceptions, zero divisions by zero, 100% deterministic fail-safe behavior.

### 5.5 PostgreSQL / Read-Only Invariants
- The Balance Sheet engine executes **pure SELECT queries** via `AccountingJournalRepository` and `AccountingAccountRepository`.
- **Zero mutations**: No `INSERT`, `UPDATE`, `DELETE`, `ALTER`, or `DROP` statements.
- No database locks, temporary tables, or persistent side-effects.

---

## 6. API & UI Architecture Contract

### 6.1 REST API Endpoint Specification

`GET /api/v1/admin/accounting/balance-sheet`

#### Query Parameters:
- `as_of_date` (or `asOfDate`): `string` (required, `YYYY-MM-DD`)
- `branch_id` (or `branchId`): `string` (optional, restricted to `SUPER_ADMIN` for cross-branch queries)
- `compare_date` (or `compareDate`): `string` (optional, `YYYY-MM-DD` for comparative balance sheet)

#### Authorization:
- Header: `Authorization: Bearer <JWT>`
- Permission: `ACCOUNTING.VIEW` (enforced via `StaffAccessControl.hasPermission(userCtx, "ACCOUNTING", "VIEW")`)
- Role Check: `CUSTOMER` and `ANONYMOUS` blocked with `403 FORBIDDEN`.

#### Response Contract (`BalanceSheetResult`):
```json
{
  "success": true,
  "as_of_date": "2026-03-31",
  "branch": {
    "id": null,
    "name": "Enterprise (All Branches)"
  },
  "sections": {
    "current_assets": {
      "label": "Current Assets",
      "categories": [
        {
          "group_code": "1110",
          "group_name": "Cash and Cash Equivalents",
          "accounts": [
            { "code": "1111", "name": "Cash in Hand", "amount": 0.00 },
            { "code": "1112", "name": "Bank Operating A/c", "amount": 0.00 }
          ],
          "subtotal": 0.00
        },
        {
          "group_code": "1120",
          "group_name": "Receivables and Advances",
          "accounts": [
            { "code": "1121", "name": "Accounts Receivable", "amount": 0.00 }
          ],
          "subtotal": 0.00
        },
        {
          "group_code": "1130",
          "group_name": "Inventories",
          "accounts": [
            { "code": "1131", "name": "Merchandise Inventory - Accessories", "amount": 0.00 }
          ],
          "subtotal": 0.00
        },
        {
          "group_code": "1140",
          "group_name": "Duties & Taxes - Input Tax Credit",
          "accounts": [],
          "subtotal": 0.00
        }
      ],
      "total_current_assets": 0.00
    },
    "fixed_assets": {
      "label": "Non-Current Assets (PP&E)",
      "gross_fixed_assets": [
        { "code": "1510", "name": "Bakery & Kitchen Equipment", "amount": 0.00 }
      ],
      "gross_subtotal": 0.00,
      "accumulated_depreciation": { "code": "1590", "name": "Accumulated Depreciation", "amount": 0.00 },
      "net_fixed_assets": 0.00
    },
    "current_liabilities": {
      "label": "Current Liabilities",
      "categories": [
        {
          "group_code": "2110",
          "group_name": "Trade Payables",
          "accounts": [
            { "code": "2111", "name": "Accounts Payable", "amount": 0.00 }
          ],
          "subtotal": 0.00
        },
        {
          "group_code": "2120",
          "group_name": "Duties & Taxes - Output Tax Liability",
          "accounts": [],
          "subtotal": 0.00
        },
        {
          "group_code": "2140",
          "group_name": "Advances & Unearned Revenue",
          "accounts": [],
          "subtotal": 0.00
        },
        {
          "group_code": "2150",
          "group_name": "Operating Accruals & Staff Payables",
          "accounts": [],
          "subtotal": 0.00
        }
      ],
      "other_current_liabilities": [
        { "code": "2130", "name": "TDS Payable", "amount": 0.00 }
      ],
      "total_current_liabilities": 0.00
    },
    "long_term_liabilities": {
      "label": "Non-Current Liabilities",
      "accounts": [
        { "code": "2510", "name": "Bank Loans & Borrowings", "amount": 0.00 }
      ],
      "total_long_term_liabilities": 0.00
    },
    "equity": {
      "label": "Owner's Equity",
      "capital": { "code": "3110", "name": "Partner / Shareholder Capital", "amount": 0.00 },
      "drawings": { "code": "3120", "name": "Drawings / Distributions", "amount": 0.00 },
      "net_capital": 0.00,
      "retained_earnings_prior": { "code": "3210", "name": "Retained Earnings (Prior Years)", "amount": 0.00 },
      "current_year_net_earnings": { "code": "3220", "name": "Current Year Net Earnings", "amount": 0.00 },
      "opening_balance_offset": { "code": "3300", "name": "Opening Balance Offset / Capital Reserve", "amount": 0.00 },
      "total_equity": 0.00
    }
  },
  "summary": {
    "total_assets": 0.00,
    "total_liabilities": 0.00,
    "total_equity": 0.00,
    "total_liabilities_and_equity": 0.00
  },
  "reconciliation": {
    "total_assets": 0.00,
    "total_liabilities_and_equity": 0.00,
    "difference": 0.00,
    "is_balanced": true
  }
}
```

---

### 6.2 UI Workspace Architecture (`balance-sheet-panel.tsx`)

Following the established standards from `profit-loss-panel.tsx` and `general-ledger-panel.tsx`:
1. **Location**: `frontend/src/components/dashboard/admin/balance-sheet-panel.tsx`
2. **Tab Integration**:
   - `frontend/src/app/dashboard/page.tsx`: add `balance_sheet` to `AdminTabId` and dynamic `BalanceSheetPanel` to `PANEL_MAP`.
   - `frontend/src/components/dashboard/admin/admin-tabs.tsx`: register `{ id: "balance_sheet", label: "Balance Sheet", icon: Scale }`.
   - `frontend/src/lib/staff-access-control.ts`: map `balance_sheet: { module: "ACCOUNTING", action: "VIEW" }`.
3. **Key Visual Components**:
   - **Control Bar**: As-of date selector with presets (*"Today"*, *"Month End"*, *"Quarter End"*, *"FY End March 31"*), branch selector (Super Admin), comparative date toggle, Print/Export.
   - **Reconciliation Banner**:
     - Green Badge: `Balanced (Assets = Liabilities + Equity, Variance ₹0.00)`
     - Alert Banner (if variance detected): `Out of Balance (Variance ₹X.XX)`
   - **Summary KPI Cards**:
     - Total Assets
     - Total Liabilities
     - Total Equity
     - Net Working Capital ($\text{Current Assets} - \text{Current Liabilities}$)
   - **Dual Column / Stacked Vertical Schedules**:
     - **Card 1: ASSETS** (Current Assets broken down by category + Fixed Assets with gross cost, accumulated depreciation, and net book value).
     - **Card 2: LIABILITIES & EQUITY** (Current Liabilities + Long-Term Borrowings + Equity with Capital, Drawings deduction, Prior Retained Earnings, Current Year Net Earnings, and OB Offset).
   - **Comparative Mode**: Displays side-by-side columns (`As of Date 1` vs `As of Date 2` with absolute change and percentage variance).

---

## 7. Explicit Implementation Plan & Verification Strategy

Upon user authorization, Phase 5A.4 implementation will proceed in strict accordance with the following sequence:

### 7.1 Planned Implementation Steps
1. **Step 1: Domain Types (`src/lib/types/accounting.types.ts`)**:
   Add `BalanceSheetResult`, `BalanceSheetParams`, `BalanceSheetSections`, and helper types without modifying existing types.
2. **Step 2: Service Layer (`src/lib/services/balance-sheet.service.ts`)**:
   Implement pure read-only service querying `AccountingJournalRepository.getTrialBalance()`, calculating contra-deductions, dynamic P&L net profit roll-up into 3220, and reconciliation verification.
3. **Step 3: REST API Handler (`src/app/api/v1/[...path]/route.ts`)**:
   Expose `GET admin/accounting/balance-sheet` with `ACCOUNTING.VIEW` permission check and BOLA enforcement.
4. **Step 4: Enterprise UI Panel (`src/components/dashboard/admin/balance-sheet-panel.tsx`)**:
   Build rich, responsive, accessible balance sheet workspace matching the navy/gold/slate design system.
5. **Step 5: Wiring & Access Control**:
   Register tab in `admin-tabs.tsx`, `page.tsx`, and `staff-access-control.ts`.
6. **Step 6: Comprehensive Verification Test Suite**:
   Create `scratch/test_phase5a4_balance_sheet.js` with comprehensive assertions covering:
   - Full CoA account classification across all 49 BS leaf accounts
   - Current vs non-current hierarchy adherence
   - Contra-asset (1590) and contra-equity (3120) net calculations
   - Account 3300 presentation behavior (balanced vs unbalanced)
   - Dynamic P&L net profit roll-up into 3220
   - Strict mathematical identity ($\text{Assets} \equiv \text{Liabilities} + \text{Equity}$)
   - Branch filtering and BOLA access enforcement
   - Zero-transaction baseline behavior
   - Zero PostgreSQL mutations assertion
   - Full regression test run across Phase 5A.1 (71/71), 5A.2 (46/46), and 5A.3 (104/104)

---

## 8. Gate Summary & Stop for Authorization

This forensic & design gate establishes:
1. **Every one of the 99 accounts in the Chart of Accounts is accounted for** (66 Balance Sheet, 33 P&L).
2. **Account 3300 Opening Balance Offset remains a presentation account** in Equity, maintaining mathematical balance without data mutations.
3. **Account 3220 Current Year Net Earnings dynamically rolls up P&L net profit**, guaranteeing continuous, real-time balance that aligns with Phase 5A.3 and prepares cleanly for Phase 5A.6 Year-End Close.
4. **Zero implementation code has been written.**

**SYSTEM IS HALTED AT THIS GATE. AWAITING USER REVIEW AND EXPLICIT AUTHORIZATION TO PROCEED WITH PHASE 5A.4 IMPLEMENTATION.**

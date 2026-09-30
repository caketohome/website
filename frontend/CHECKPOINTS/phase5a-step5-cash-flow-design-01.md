# CakeToHome ERP — Phase 5A Step 5 Forensic & Architecture Design Gate
## Cash Flow Statement Architecture Design
### Milestone: `PHASE-5A-STEP-5-CASH-FLOW-DESIGN-01`
### Gate Classification: READ-ONLY FORENSIC & ARCHITECTURE DESIGN GATE — IMPLEMENTATION STRICTLY NOT AUTHORIZED PENDING USER APPROVAL

---

## 1. Executive Summary & Authorization Context

This document establishes the formal **Forensic & Architecture Design Gate** for **Phase 5A Step 5: Cash Flow Statement**.

Following the successful implementation, rigorous verification, and freezing of:
- **Phase 5A.1: GL Account Ledger & Trial Balance** (71/71 tests PASS 🔒)
- **Phase 5A.2: Opening Balance & Fiscal Period Configuration** (46/46 tests PASS 🔒)
- **Phase 5A.3: Profit & Loss Statement (P&L)** (104/104 tests PASS 🔒)
- **Phase 5A.4: Balance Sheet Financial Statement** (114/114 tests PASS 🔒)
- **Combined Predecessor Regression Coverage**: **335 / 335 tests PASS (100%)**

This design gate defines the accounting mechanics, cash boundaries, operating/investing/financing classifications, dual-method presentation (Direct & Indirect), and mathematical reconciliation invariants for the Cash Flow Statement.

### Governance Invariants Upheld During This Design Gate:
- **Zero implementation code was written or modified** in production services, API routes, or UI components.
- **Zero database DDL, schema migrations, or table alterations were executed.**
- **Zero accounting vouchers, journal entries, or temporary tables were created.**
- **Zero production or historical financial data was mutated.**
- **Zero Git commits, pushes, or resets were performed.**
- **Implementation remains strictly HALTED pending explicit user authorization.**

### Current Phase 5A Milestone State

| Phase | Milestone Name | Status | Verified Test Count | Zero-Mutation Audit |
|---|---|---|---|---|
| **Phase 5A.1** | GL Account Ledger & Trial Balance | 🔒 FROZEN | 71 / 71 PASS | Verified |
| **Phase 5A.2** | Opening Balance & Fiscal Period Configuration | 🔒 FROZEN | 46 / 46 PASS | Verified |
| **Phase 5A.3** | Profit & Loss Statement (P&L) | 🔒 FROZEN | 104 / 104 PASS | Verified |
| **Phase 5A.4** | Balance Sheet Financial Statement | 🔒 FROZEN | 114 / 114 PASS | Verified |
| **Phase 5A.5** | **Cash Flow Statement** | ⏳ **DESIGN GATE (THIS DOCUMENT)** | **0 (PENDING AUTHORIZATION)** | Verified Clean Baseline |
| **Phase 5A.6** | Period / Year-End Close Engine | ⏳ DESIGN GATE REQUIRED | Not Started | Not Started |

---

## 2. Forensic Chart of Accounts Analysis — Cash & Non-Cash Topology

A forensic audit of `public.accounting_account` against the live PostgreSQL database confirms exactly **99 active accounts** across a 3-tier hierarchy. For the Cash Flow Statement under Indian Accounting Standard 7 (Ind AS 7 / AS 3), the 99 accounts partition into five functional pools:

```
                                  CHART OF ACCOUNTS (99 Accounts)
                                                 │
        ┌───────────────────┬────────────────────┼───────────────────┬───────────────────┐
        ▼                   ▼                    ▼                   ▼                   ▼
  1. CASH & CASH      2. WORKING CAPITAL   3. INVESTING (PP&E) 4. FINANCING        5. NOMINAL (P&L)
   EQUIVALENTS             POOL                 POOL                POOL                POOL
   (6 Accounts)       (26 Accounts)         (5 Accounts)        (4 Accounts)       (58 Accounts)
   1111 Cash           1121-1124 Recv.       1510 Bakery Eq.     2510 Bank Loans     4110-4140 Rev.
   1112 Bank           1131-1133 Inv.        1520 Fleet          3110 Capital        4190 Returns
   1113 Gateway Clr    1141-1149 Inp Tax     1530 POS Hardw.     3120 Drawings       4210-4290 Other Inc
   1114 Petty Cash     2111 Trade AP         1540 Furniture      3300 OB Offset      5110-5140 COGS
   1118 Transit        2121-2129 Out Tax     (1590 Accum Depr -  (3210/3220 Ret.    5190 Purchases Disc
   1119 Suspense       2130 TDS Payable       Non-Cash Contra)    Earnings)          5210-5299 OpEx
                       2141-2142 Advances                                            5310-5330 Fin/Depr
                       2151-2153 Accruals
```

### 2.1 Complete Distribution of the 99 Accounts for Cash Flow Analysis

| Account Category | Root Codes | Leaf Count | Treatment in Direct Cash Flow | Treatment in Indirect Cash Flow |
|---|---|---|---|---|
| **Cash & Cash Equivalents** | `1111–1119` | **6** | The cash target boundary whose net delta is explained | Target closing balance for reconciliation |
| **Operating Receivables & Advances** | `1121–1124` | 4 | Inflow when credited with cash counterparty | Working capital delta ($\Delta$ Assets) |
| **Inventories** | `1131–1133` | 3 | Non-cash directly (cash effect via AP / payments) | Working capital delta ($\Delta$ Inventory) |
| **Input Tax Credit (GST)** | `1141–1149` | 9 | Outflow when paid with cash counterparty | Working capital delta ($\Delta$ Input Tax) |
| **Fixed Assets (PP&E)** | `1510–1540` | 4 | Investing cash outflow when purchased with cash | Excluded from operating cash; treated in CFI |
| **Accumulated Depreciation** | `1590` | 1 | Strictly non-cash; ignored | Non-cash contra-asset; ignored in working capital |
| **Trade Payables (AP)** | `2111` | 1 | Outflow when debited with cash counterparty | Working capital delta ($\Delta$ Payables) |
| **Output Tax Liability (GST)** | `2121–2129` | 9 | Outflow when remitted; Inflow when collected | Working capital delta ($\Delta$ Output Tax) |
| **TDS Payable** | `2130` | 1 | Outflow when remitted with cash counterparty | Working capital delta ($\Delta$ TDS) |
| **Customer Advances & Wallets** | `2141–2142` | 2 | Inflow when credited with cash counterparty | Working capital delta ($\Delta$ Advances) |
| **Operating Accruals & Payables** | `2151–2153` | 3 | Outflow when settled with cash counterparty | Working capital delta ($\Delta$ Accruals) |
| **Long-Term Borrowings** | `2510` | 1 | Financing inflow (drawdown) / outflow (repay) | Excluded from operating cash; treated in CFF |
| **Capital & Reserves** | `3110` | 1 | Financing inflow (capital contribution) | Excluded from operating cash; treated in CFF |
| **Drawings / Distributions** | `3120` | 1 | Financing outflow (partner withdrawal) | Excluded from operating cash; treated in CFF |
| **Retained Earnings / P&L** | `3210, 3220` | 2 | Non-cash equity presentation accounts | Starting point of indirect method (Net Profit) |
| **Opening Balance Offset** | `3300` | 1 | Strictly non-cash presentation account | Zero cash impact; excluded |
| **Operating Revenue & Returns** | `4110–4190` | 5 | Inflow when direct cash sale | Component of starting Net Profit |
| **Other / Indirect Income** | `4210–4290` | 2 | Inflow when received in cash | Component of starting Net Profit |
| **Cost of Goods Sold (COGS)** | `5110–5190` | 5 | Non-cash inventory fulfillment; ignored | Deducted in Net Profit; offset by inventory delta |
| **Operating Expenses** | `5210–5299` | 11 | Outflow when paid directly in cash | Component of starting Net Profit |
| **Financial Expenses & Depr.** | `5310–5330` | 3 | 5310/5320 outflow if paid; 5330 non-cash addback | 5330 Depreciation added back; 5310/5320 adjusted |
| **Group Hierarchy Accounts** | Various | 24 | Non-posting parent nodes | Non-posting parent nodes |
| **TOTAL** | — | **99** | **100% Accounted For** | **100% Accounted For** |

---

## 3. Cash Flow Method: Direct vs. Indirect & Dual Presentation Architecture

### 3.1 Standards Analysis (Ind AS 7 / AS 3 / IAS 7)
- **Direct Method**: Reports major classes of gross cash receipts and gross cash payments. It provides business operators, retail managers, and auditors with complete transparency into gross cash generated from customers and gross cash disbursed to suppliers, employees, landlords, and tax authorities.
- **Indirect Method**: Derives net cash flow from operating activities by starting with **Net Profit Before Tax** (from P&L) and adjusting for:
  1. Non-cash expenses (e.g. `5330 Depreciation`).
  2. Non-operating financing charges (e.g. loan interest).
  3. Net changes in operating working capital accounts ($\Delta$ Receivables, $\Delta$ Inventory, $\Delta$ Payables, $\Delta$ Accruals, $\Delta$ Taxes).

### 3.2 Architectural Decision: Dual / Switchable Presentation Architecture
1. **Primary Operational Presentation — Direct Method**:
   - The Direct Method is authoritative for operational clarity and cash visibility.
   - Shows gross cash inflows (Collections from Customers, POS Cash Sales, Gateway Clearings) and gross cash outflows (Supplier Payments, Operating Expenses, Salaries Paid, GST Paid, Bank Charges).
2. **Authoritative Financial Reconciliation — Indirect Method**:
   - The Indirect Method is authoritative for reconciling the P&L statement to the Balance Sheet movements.
   - Proves that the accounting net profit actually reconciles to physical cash generated by operations.
3. **Mathematical Identity & Convergence Guarantee**:
   Both methods operate on the same authoritative General Ledger data and **MUST yield the exact same Net Cash Flow from Operating Activities**:
   $$\mathbf{Net\ Operating\ Cash\ Flow}_{\text{Direct}} \equiv \mathbf{Net\ Operating\ Cash\ Flow}_{\text{Indirect}}$$
   Any difference indicates an unclassified journal line or non-cash distortion, serving as an automated regression guard.

---

## 4. Cash & Cash-Equivalent Definition & Boundary

### 4.1 Authoritative Boundary (The 6 Cash Accounts)
The Cash & Cash Equivalent pool is defined strictly as all active, non-group leaf accounts residing under parent group `1110 Cash and Cash Equivalents`:

```
1110 - Cash and Cash Equivalents [GROUP, Level 3, Parent: 1100]
 ├── 1111 - Cash in Hand [LEAF, Subtype: CASH, Normal: DEBIT]
 ├── 1112 - Bank Operating A/c [LEAF, Subtype: BANK, Normal: DEBIT]
 ├── 1113 - Gateway Clearing [LEAF, Subtype: GATEWAY_CLEARING, Normal: DEBIT]
 ├── 1114 - Petty Cash - Branches [LEAF, Subtype: CASH, Normal: DEBIT]
 ├── 1118 - Deposit in Transit [LEAF, Subtype: CURRENT_ASSET, Normal: DEBIT]
 └── 1119 - Unclassified Suspense [LEAF, Subtype: CURRENT_ASSET, Normal: DEBIT]
```

### 4.2 Explicit Classification of Borderline Accounts

| Account Code & Name | Parent Group | Subtype | Classification | Accounting Justification |
|---|---|---|---|---|
| **`1113 Gateway Clearing`** | `1110` | `GATEWAY_CLEARING` | **Cash Equivalent** | Funds captured via payment gateway (Razorpay/Stripe) are highly liquid, guaranteed settlement within T+1/T+2 days, and subject to insignificant risk of changes in value. Under Ind AS 7, paragraph 7, they qualify as cash equivalents. |
| **`1118 Deposit in Transit`** | `1110` | `CURRENT_ASSET` | **Cash Equivalent** | Physical branch cash deposited at bank counter pending statement clearing (Stage-1 transit in BRS). Sits in transit between two cash accounts. |
| **`1119 Unclassified Suspense`**| `1110` | `CURRENT_ASSET` | **Cash Equivalent** | Unidentified bank deposits credited by the bank undergoing BRS matching. Physical cash exists in the bank account; temporary suspense allocation. |
| **`1122 Undeposited COD`** | `1120` | `CURRENT_ASSET` | **Operating Working Capital (Receivable)** | Cash collected by external delivery partners (Zomato/Dunzo/internal riders) still in rider custody prior to physical remittance to branch cash-in-hand (`1111`). Governed by Phase 4F Step 4.9. Sits under `1120 Receivables` on the Balance Sheet; classified as a working capital receivable delta, NOT cash-in-hand. |
| **`1123 Staff Advances`** | `1120` | `CURRENT_ASSET` | **Operating Working Capital** | Operational advances to staff. Not cash equivalents. |
| **`1124 Security Deposits`** | `1120` | `CURRENT_ASSET` | **Operating Working Capital** | Long-term lease/utility deposits. Illiquid. |

### 4.3 Reconciliation to Balance Sheet Cash Position
On the Balance Sheet (Phase 5A.4), line item `1110 Cash and Cash Equivalents` is:
$$\text{BS Cash}(T) = \sum_{a \in \{1111, 1112, 1113, 1114, 1118, 1119\}} \text{Balance}(a, T)$$

At any point in time $T = D_{\text{end}}$:
$$\mathbf{Closing\ Cash\ in\ Cash\ Flow}(D_{\text{end}}) \equiv \mathbf{BS\ Cash\ and\ Cash\ Equivalents}(D_{\text{end}})$$

$$\mathbf{Opening\ Cash\ in\ Cash\ Flow}(D_{\text{start}}) \equiv \mathbf{BS\ Cash\ and\ Cash\ Equivalents}(D_{\text{start}} - 1)$$

Variance is zero:
$$\text{Reconciliation Variance} = \text{Closing Cash} - \text{BS Cash} \equiv ₹0.00$$

---

## 5. Operating / Investing / Financing Classification

Every cash transaction in CakeToHome ERP is recorded via double-entry journal entries where at least one line touches the Cash & Cash Equivalent pool (`CASH_ACCOUNTS = {1111, 1112, 1113, 1114, 1118, 1119}`).

Classification into Operating, Investing, or Financing is determined deterministically by examining the **non-cash counterparty accounts** within that journal entry:

```
                                  CASH JOURNAL ENTRY
                                          │
                  Are ALL lines in CASH_ACCOUNTS?
                                 /                 \
                              YES                   NO
                              /                       \
                  INTERNAL CASH TRANSFER          Analyze Non-Cash
                  (Dr 1112 / Cr 1111 etc.)        Counterparty Accounts
                  Net Cash Impact: ₹0.00                   │
                                          ┌────────────────┼────────────────┐
                                          ▼                ▼                ▼
                                      OPERATING        INVESTING        FINANCING
                                      (CFO)            (CFI)            (CFF)
                                      1121, 2111,      1510-1540        2510 Loans,
                                      4xxx, 52xx,      (Fixed Assets)   3110 Capital,
                                      212x-215x                         3120 Drawings
```

### 5.1 Operating Activities (CFO)

Operating activities comprise the core revenue-producing transactions, working capital settlements, operational expenses, and statutory obligations:

#### Direct Method Line Items:
1. **Cash Receipts from Customers & Sales**:
   - Counterparty accounts: `1121 Accounts Receivable` (customer settlements), `2141 Customer Advances` (advance deposits), `1122 Undeposited COD` (rider remittances to branch cash), `4110–4140 Operating Revenue` (direct counter sales).
   - Sign: **Positive Inflow (+)**.
2. **Cash Receipts from Other / Indirect Income**:
   - Counterparty accounts: `4210 Scraps/Waste Sales`, `4220 Delivery Service Fees`, `4290 Misc Operating Income`.
   - Sign: **Positive Inflow (+)**.
3. **Cash Paid to Suppliers for Inventory & Supplies**:
   - Counterparty accounts: `2111 Accounts Payable` (payments to ingredient, accessory, and packaging vendors).
   - Sign: **Negative Outflow (-)**.
4. **Cash Paid for Operating Expenses & Payroll**:
   - Counterparty accounts: `5210 Salaries & Wages`, `5220 Rent`, `5230 Utilities`, `5240 Marketing`, `5250 Repairs`, `5260 Software`, `5270 Legal`, `5280 Logistics`, `5299 Misc Operating Expenses`, and settlements of `2151 Salaries Payable`, `2152 Rent Payable`, `2153 Accrued Expenses`.
   - Sign: **Negative Outflow (-)**.
5. **Cash Paid for Payment Gateway Fees & Banking Charges**:
   - Counterparty accounts: `5290 Gateway MDR Fees` (deducted in gateway payout batches), `5295 Bank Charges / POS Rental`, `5310 Bank Transaction Charges`.
   - Sign: **Negative Outflow (-)**.
6. **Cash Paid for Statutory Taxes (GST & TDS)**:
   - Counterparty accounts: `2121–2129 Output GST Liability` (net tax remittances), `2130 TDS Payable` (statutory TDS payments).
   - Sign: **Negative Outflow (-)**.
7. **Cash Paid for Customer Refunds**:
   - Counterparty accounts: `4190 Sales Returns`, `1121 Accounts Receivable`, `2141 Customer Advances` (issued via customer refund vouchers).
   - Sign: **Negative Outflow (-)**.

$$\mathbf{Net\ Cash\ from\ Operating\ Activities\ (CFO)} = \text{Receipts} - \text{Payments}$$

---

### 5.2 Investing Activities (CFI)

Investing activities encompass cash flows relating to the acquisition and disposal of long-term tangible fixed assets (Property, Plant & Equipment):

#### Direct Method Line Items:
1. **Purchase of Bakery & Kitchen Equipment**:
   - Counterparty account: `1510 Bakery & Kitchen Equipment`.
   - Sign: **Negative Outflow (-)**.
2. **Purchase of Delivery Vehicles & Fleet**:
   - Counterparty account: `1520 Delivery Vehicles & Fleet`.
   - Sign: **Negative Outflow (-)**.
3. **Purchase of Computers & POS Hardware**:
   - Counterparty account: `1530 Computers & POS Hardware`.
   - Sign: **Negative Outflow (-)**.
4. **Purchase of Furniture & Fixtures**:
   - Counterparty account: `1540 Furniture & Fixtures`.
   - Sign: **Negative Outflow (-)**.
5. **Proceeds from Sale / Disposal of Fixed Assets**:
   - Counterparty accounts: `1510–1540 Fixed Assets` (when credited upon asset disposal receipt).
   - Sign: **Positive Inflow (+)**.

$$\mathbf{Net\ Cash\ from\ Investing\ Activities\ (CFI)} = \text{Disposal Proceeds} - \text{Capital Expenditures}$$

---

### 5.3 Financing Activities (CFF)

Financing activities encompass cash flows relating to debt borrowings, partner capital equity, and owner withdrawals/distributions:

#### Direct Method Line Items:
1. **Proceeds from Bank Borrowings & Loans**:
   - Counterparty account: `2510 Bank Loans & Borrowings` (when credited with cash counterparty).
   - Sign: **Positive Inflow (+)**.
2. **Repayment of Bank Borrowings & Loans**:
   - Counterparty account: `2510 Bank Loans & Borrowings` (when debited with cash counterparty).
   - Sign: **Negative Outflow (-)**.
3. **Capital Injections from Partners / Shareholders**:
   - Counterparty account: `3110 Partner / Shareholder Capital` (when credited with cash counterparty).
   - Sign: **Positive Inflow (+)**.
4. **Drawings / Dividend Distributions to Owners**:
   - Counterparty account: `3120 Drawings / Distributions` (when debited with cash counterparty).
   - Sign: **Negative Outflow (-)**.
5. **Payment of Financing Interest**:
   - Counterparty account: `5320 Loan Interest & Borrowing Costs` (when paid in cash; classified under financing per Ind AS 7 option).
   - Sign: **Negative Outflow (-)**.

$$\mathbf{Net\ Cash\ from\ Financing\ Activities\ (CFF)} = \text{Borrowings} + \text{Capital Injections} - \text{Repayments} - \text{Drawings} - \text{Financing Interest}$$

---

### 5.4 Internal Cash Transfers (Zero Net Cash Impact)

When cash moves strictly between accounts within the Cash & Cash Equivalent pool, it is recognized as an **Internal Cash Transfer**:
- **Branch Cash to Transit**: `Dr 1118 Deposit in Transit / Cr 1111 Cash in Hand` (Phase 4F Step 4.10.2).
- **Transit Clearance to Bank**: `Dr 1112 Bank Operating A/c / Cr 1118 Deposit in Transit` (BRS Clearance).
- **Gateway Settlement**: `Dr 1112 Bank Operating A/c / Cr 1113 Gateway Clearing` (Phase 4F Step 4.10.3).
- **Petty Cash Float Replenishment**: `Dr 1114 Petty Cash / Cr 1112 Bank Operating A/c`.

**Accounting Rule**:
Because both the debit and credit lines belong to `CASH_ACCOUNTS`, the net impact on the cash pool is strictly:
$$\Delta \text{Cash} = +\text{Debit} - \text{Credit} \equiv ₹0.00$$
Internal cash transfers are filtered out from gross operating, investing, and financing flows to prevent artificial inflation of gross receipts and gross disbursements.

---

## 6. Non-Cash Transactions & Elimination Protocol

### 6.1 Catalog of Non-Cash Transactions in CakeToHome ERP

The ERP processes numerous accounting events that adjust revenues, expenses, assets, or liabilities without any immediate exchange of cash:

| Event Type | Typical Journal Entry | Cash Line Present? | Direct Method Treatment | Indirect Method Treatment |
|---|---|---|---|---|
| **Depreciation Expense** | `Dr 5330 Depreciation / Cr 1590 Accum Depr` | **NO** | 100% Ignored | **Added back** to Net Profit |
| **Credit Sales on Account** | `Dr 1121 AR / Cr 4110 Cake Sales, Cr 2121 GST` | **NO** | 100% Ignored | Offset by $\Delta 1121$ and $\Delta 2121$ |
| **Credit Purchases on Account** | `Dr 1131 Inv, Dr 1141 Input GST / Cr 2111 AP` | **NO** | 100% Ignored | Offset by $\Delta 1131, \Delta 1141$ and $\Delta 2111$ |
| **FIFO COGS Fulfillment** | `Dr 5110 COGS / Cr 1132 Finished Goods` | **NO** | 100% Ignored | Offset by $\Delta 1132$ in working capital |
| **Accrued Operating Expenses** | `Dr 5220 Rent Expense / Cr 2152 Rent Payable` | **NO** | 100% Ignored | Offset by $\Delta 2152$ in working capital |
| **Non-Restocked Return Credit** | `Dr 4190 Returns, Dr 2121 GST / Cr 1121 AR` | **NO** | 100% Ignored | Offset by $\Delta 1121$ and $\Delta 2121$ |
| **Opening Balance Equity Offset** | `Dr Asset or Cr Liab / 3300 OB Offset` | **NO** | 100% Ignored | Zero effect; excluded from period movement |

### 6.2 Elimination Protocol
- **Direct Method Engine**: Enforces strict line-level filtering:
  $$\text{Include in Cash Flow Calculation} \iff \text{Line Account } \in \text{CASH\_ACCOUNTS}$$
  Non-cash journal entries have zero lines matching this condition and are discarded automatically at query time.
- **Indirect Method Engine**: Mathematical working capital delta formulation automatically neutralizes non-cash revenue and expense accruals against their balance sheet counter-accounts.

---

## 7. Indirect-Method Reconciliation Mechanics

The Indirect Method provides a mathematical bridge from the **Profit & Loss Statement (Phase 5A.3)** to the **Net Operating Cash Flow**:

```
                       P&L STATEMENT
                Net Profit Before Tax (5A.3)
                            │
                            ▼
               ADD BACK NON-CASH EXPENSES
              + Depreciation Expense (5330)
                            │
                            ▼
             ADJUST FOR NON-OPERATING ITEMS
           + Loan Interest Expense (5320, if in CFF)
                            │
                            ▼
          OPERATING PROFIT BEFORE WORKING CAPITAL
                            │
                            ▼
              WORKING CAPITAL MOVEMENTS (Δ)
           - Increase in Current Assets (Excl. Cash)
           + Decrease in Current Assets (Excl. Cash)
           + Increase in Current Liabilities
           - Decrease in Current Liabilities
                            │
                            ▼
           NET CASH FROM OPERATING ACTIVITIES (CFO)
                            │
          MUST EQUAL DIRECT METHOD CFO EXACTLY!
```

### 7.1 Mathematical Working Capital Schedule

Let $\Delta A = \text{Balance}(A, D_{\text{end}}) - \text{Balance}(A, D_{\text{start}} - 1)$ for any account $A$:

| Working Capital Component | Account Codes | Asset/Liability | Balance Change | Cash Flow Impact |
|---|---|---|---|---|
| **Trade Receivables** | `1121` | Current Asset | $\Delta > 0$ (Increased) | **Deduct (-)** Cash tied up in customer credit |
| | | | $\Delta < 0$ (Decreased) | **Add (+)** Cash collected from past sales |
| **Undeposited COD** | `1122` | Current Asset | $\Delta > 0$ (Increased) | **Deduct (-)** Cash held in rider transit |
| | | | $\Delta < 0$ (Decreased) | **Add (+)** Cash remitted to branch |
| **Staff Advances & Deposits** | `1123, 1124` | Current Asset | $\Delta > 0$ (Increased) | **Deduct (-)** Advances paid |
| | | | $\Delta < 0$ (Decreased) | **Add (+)** Advances recovered |
| **Inventories** | `1131, 1132, 1133` | Current Asset | $\Delta > 0$ (Increased) | **Deduct (-)** Cash spent building stock |
| | | | $\Delta < 0$ (Decreased) | **Add (+)** Inventory consumed / sold |
| **Input Tax Credit (GST)** | `1141–1149` | Current Asset | $\Delta > 0$ (Increased) | **Deduct (-)** Tax paid on purchases |
| | | | $\Delta < 0$ (Decreased) | **Add (+)** ITC utilized against output |
| **Trade Payables (AP)** | `2111` | Current Liability | $\Delta > 0$ (Increased) | **Add (+)** Purchases funded by suppliers |
| | | | $\Delta < 0$ (Decreased) | **Deduct (-)** Cash paid to settle suppliers |
| **Output Tax Liability (GST)** | `2121–2129` | Current Liability | $\Delta > 0$ (Increased) | **Add (+)** Tax collected from customers |
| | | | $\Delta < 0$ (Decreased) | **Deduct (-)** Tax remitted to Government |
| **TDS Payable** | `2130` | Current Liability | $\Delta > 0$ (Increased) | **Add (+)** Tax withheld from payments |
| | | | $\Delta < 0$ (Decreased) | **Deduct (-)** TDS remitted to Government |
| **Customer Advances & Wallets**| `2141, 2142` | Current Liability | $\Delta > 0$ (Increased) | **Add (+)** Advance payments received |
| | | | $\Delta < 0$ (Decreased) | **Deduct (-)** Advances fulfilled / recognized |
| **Operating Accruals & Staff** | `2151, 2152, 2153` | Current Liability | $\Delta > 0$ (Increased) | **Add (+)** Unpaid expenses accrued |
| | | | $\Delta < 0$ (Decreased) | **Deduct (-)** Accrued expenses settled in cash |

$$\mathbf{Net\ CFO}_{\text{Indirect}} = \text{Net Profit Before Tax} + \text{Depr}(5330) + \text{Loan Interest}(5320) + \sum \Delta \text{Working Capital}$$

$$\mathbf{Convergence\ Invariant}: |\mathbf{Net\ CFO}_{\text{Indirect}} - \mathbf{Net\ CFO}_{\text{Direct}}| < 0.005$$

---

## 8. As-Of Date Semantics & Mathematical Reconciliation Invariants

### 8.1 Date Semantics
A Cash Flow Statement operates over a discrete reporting period $[D_{\text{start}}, D_{\text{end}}]$ (e.g. `2026-04-01` to `2026-04-30`):
1. **Opening Cash Balance ($C_{\text{open}}$)**:
   - Sourced as the cumulative net debit balance of all `CASH_ACCOUNTS` as of the close of business on $D_{\text{start}} - 1$:
     $$C_{\text{open}} = \sum_{a \in \text{CASH\_ACCOUNTS}} \text{GL Balance}(a, \text{as-of } D_{\text{start}} - 1)$$
2. **Period Cash Movements ($\Delta C$)**:
   - Sourced from all posted journal entries with `entry_date` $\in [D_{\text{start}}, D_{\text{end}}]$:
     $$\Delta C = \text{CFO} + \text{CFI} + \text{CFF}$$
3. **Closing Cash Balance ($C_{\text{close}}$)**:
   - Sourced as the cumulative net debit balance of all `CASH_ACCOUNTS` as of the close of business on $D_{\text{end}}$:
     $$C_{\text{close}} = C_{\text{open}} + \Delta C$$

### 8.2 Three Irrefutable Mathematical Invariants

```
 INVARIANT 1: CASH RECONCILIATION EQUATION
 ┌─────────────────────────────────────────────────────────────┐
 │  Opening Cash (C_open)                                      │
 │  + Net Cash from Operating Activities (CFO)                 │
 │  + Net Cash from Investing Activities (CFI)                 │
 │  + Net Cash from Financing Activities (CFF)                 │
 │  ═════════════════════════════════════════════════════════  │
 │  ≡ Closing Cash (C_close)                                   │
 │  Variance: |(C_open + ΔC) - C_close| < 0.005 (₹0.00)       │
 └─────────────────────────────────────────────────────────────┘

 INVARIANT 2: BALANCE SHEET CONGRUENCE EQUATION
 ┌─────────────────────────────────────────────────────────────┐
 │  Closing Cash (C_close) from Cash Flow Statement            │
 │  ≡ Balance Sheet Line Item "1110 Cash & Cash Equivalents"   │
 │    as of the exact same closing date D_end                  │
 │  Variance: |C_close - BS_Cash(D_end)| < 0.005 (₹0.00)       │
 └─────────────────────────────────────────────────────────────┘

 INVARIANT 3: DUAL-METHOD CONVERGENCE EQUATION
 ┌─────────────────────────────────────────────────────────────┐
 │  Net Operating Cash Flow (Direct Method)                    │
 │  ≡ Net Operating Cash Flow (Indirect Method Reconciliation) │
 │  Variance: |CFO_direct - CFO_indirect| < 0.005 (₹0.00)      │
 └─────────────────────────────────────────────────────────────┘
```

### 8.3 Comparative Period Reporting
The service supports an optional comparative period $[D_{\text{comp\_start}}, D_{\text{comp\_end}}]$:
- Generates side-by-side columns: Current Period, Comparative Period, Variance (₹), and Percentage Change (%).
- Empowers financial controllers to analyze liquidity trends across months, quarters, or fiscal years.

---

## 9. Branch vs. Enterprise Scoping & Inter-Branch Transfers

### 9.1 Multi-Branch Retail Topology
In CakeToHome ERP, there are 53 operational branches, centralized head office bank accounts, and localized branch cash floats.

1. **Enterprise Scope (`branch_id = null`)**:
   - Consolidates all company-wide cash movements across all 53 branches and head office bank accounts.
   - Internal cash transfers between branches and head office bank (e.g. Branch petty cash float replenishment, branch cash-in-hand deposited into central operating bank) net to zero.
2. **Branch-Scoped View (`branch_id = UUID`)**:
   - Filters cash movements attributed to that specific branch.
   - Captures local Branch Cash in Hand (`1111`), Branch Petty Cash (`1114`), Branch Undeposited COD collections (`1122`), and local operational expense disbursements.
   - BRS and Gateway Payout batches partitioned per branch (Phase 4F Step 4.10.3/4 Model A) ensure exact branch attribution.
3. **BOLA & Security Controls**:
   - Non-super-admin users are locked strictly to their session `branch_id`.
   - Tampering with `?branch_id=` parameter returns `403 Forbidden`.
   - `SUPER_ADMIN` can toggle between any single branch or consolidated Enterprise view.

---

## 10. Existing Subsystem Reconciliation Matrix

The Cash Flow Statement sits at the apex of the double-entry accounting architecture and reconciles with all frozen subsystems:

```
                      CakeToHome Subsystem Ecosystem
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           ▼                         ▼                         ▼
   Trial Balance (5A.1)      Opening Balance (5A.2)      P&L Statement (5A.3)
   GL debits/credits on      Account 3300 non-cash;      Net Profit is starting
   1111-1119 match cash      Cash floats establish       point for Indirect CFO;
   statement totals.         Opening Cash (C_open).      5330 depr added back.
           │                         │                         │
           └─────────────────────────┼─────────────────────────┘
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           ▼                         ▼                         ▼
   Balance Sheet (5A.4)      Bank Rec. (BRS, 4F.10.5)    Gateway Settlement (4F.10)
   Closing Cash matches      Book balance on 1112/1118   Dr 1112 / Cr 1113 is internal
   BS 1110 Cash & Cash       matches cash statement      transfer; Dr 5290 MDR is
   Equivalents exactly.      bank account total.         operating cash outflow.
           │                         │                         │
           └─────────────────────────┼─────────────────────────┘
                                     │
           ┌─────────────────────────┴─────────────────────────┐
           ▼                                                   ▼
   COD Control (4F.4.9)                                AR & AP Subledgers
   Rider remittance Dr 1111 / Cr 1122                  Receipts reduce AR (inflow);
   captured as customer collection.                    Payments reduce AP (outflow).
```

---

## 11. Proposed Architecture, REST API & Enterprise UI Design

### 11.1 Service Layer (`frontend/src/lib/services/cash-flow.service.ts`)
- **Class**: `CashFlowService`
- **Primary Method**:
  ```typescript
  static async getCashFlowStatement(params: CashFlowParams): Promise<CashFlowResponse>
  ```
- **Internal Pipeline**:
  1. Validate date ranges ($D_{\text{start}} \le D_{\text{end}}$) and format (`YYYY-MM-DD`).
  2. Resolve branch authorization and BOLA enforcement.
  3. Query `AccountingJournalRepository.getTrialBalance(branchId, undefined, prevDay)` for $C_{\text{open}}$.
  4. Query `AccountingJournalRepository.getTrialBalance(branchId, undefined, endDate)` for $C_{\text{close}}$ and Balance Sheet verification.
  5. Execute high-performance, single-query SQL aggregation extracting all cash journal entries in $[D_{\text{start}}, D_{\text{end}}]$ along with their counterparty lines.
  6. Classify lines into Operating, Investing, Financing, or Internal Transfer.
  7. Compute Indirect Method reconciliation: Net Profit from nominal accounts, add-back non-cash depreciation, compute working capital deltas between $D_{\text{start}}-1$ and $D_{\text{end}}$.
  8. Assert Invariants 1, 2, and 3; calculate reconciliation variances.
  9. If `compare_start_date` and `compare_end_date` are provided, execute comparative pipeline and compute variances.
  10. Return structured, enterprise-ready DTO.

### 11.2 REST API Endpoint (`frontend/src/app/api/v1/[...path]/route.ts`)
- **Route**: `GET /api/v1/admin/accounting/cash-flow`
- **Query Parameters**:
  - `start_date`: string (required, `YYYY-MM-DD`)
  - `end_date`: string (required, `YYYY-MM-DD`)
  - `branch_id`: string (optional, UUID or empty for enterprise)
  - `method`: `"direct"` | `"indirect"` | `"both"` (optional, default `"both"`)
  - `compare_start_date`: string (optional, `YYYY-MM-DD`)
  - `compare_end_date`: string (optional, `YYYY-MM-DD`)
- **Permissions**: `ACCOUNTING.VIEW`.
- **BOLA Protection**: Server-side session branch locking for non-super-admins.

### 11.3 Enterprise UI Workspace (`frontend/src/components/dashboard/admin/cash-flow-panel.tsx`)
- **Visual Design**: Navy/gold/slate theme matching CakeToHome ERP design system.
- **Controls & Filters**:
  - Date Range pickers with rapid presets: "This Month", "Last Month", "This Quarter", "This FY", "Custom".
  - Comparative Period toggle and date pickers.
  - Method Selector: "Direct Method", "Indirect Reconciliation", "Dual View".
  - Multi-branch dropdown with "All Branches (Consolidated)" option.
- **KPI Summary Cards**:
  1. Opening Cash Balance ($C_{\text{open}}$)
  2. Net Cash from Operating Activities (CFO)
  3. Net Cash from Investing Activities (CFI)
  4. Net Cash from Financing Activities (CFF)
  5. Net Change in Cash ($\Delta C$)
  6. Closing Cash Balance ($C_{\text{close}}$)
- **Reconciliation Status Banner**:
  - Live verification pill:
    - Green: `RECONCILED: Opening + Movement ≡ Closing (Δ = ₹0.00) | BS Match: ₹X.XX`
    - Red Alert: `UNRECONCILED VARIANCE: ₹X.XX`
- **Detailed Financial Schedules**:
  - Direct Method Schedule with collapsible sub-sections and transaction counts.
  - Indirect Method Reconciliation Schedule with non-cash addbacks and working capital details.
  - Comparative period variance badges (+/- green/red).
  - Print / Export stylesheets optimized for board packs.

### 11.4 Navigation & Permissions Integration
- **`frontend/src/lib/staff-access-control.ts`**:
  - Register `cash_flow: { module: "ACCOUNTING", action: "VIEW" }` in `TAB_PERMISSION_MAP`.
- **`frontend/src/components/dashboard/admin/admin-tabs.tsx`**:
  - Register `{ id: "cash_flow", label: "Cash Flow", icon: Waves }` (or `ArrowLeftRight`).
- **`frontend/src/app/dashboard/page.tsx`**:
  - Add `cash_flow` to `AdminTabId`, dynamic import `CashFlowPanel`, and register in `PANEL_MAP`.

---

## 12. Zero-Mutation Guarantee & Verification Plan

### 12.1 Strictly Read-Only Guarantee
- The Cash Flow service performs **pure `SELECT` queries**.
- Absolutely zero `INSERT`, `UPDATE`, `DELETE`, or `ALTER` statements will be executed on any database table.
- Zero accounting vouchers, journal entries, or temporary tables will be created.
- Zero modification to frozen Phase 5A.1–5A.4 production code or schemas.

### 12.2 Comprehensive 12-Stage Verification Suite (`scratch/test_phase5a5_cash_flow.js`)
When authorized, the implementation will be verified via a dedicated test suite asserting:

1. **[0/12] Pre-test PostgreSQL Baseline Audit**: Confirms 99 accounts, 0 vouchers, 0 journals, 0 lines.
2. **[1/12] Service & Route Mounting**: Verifies service export, API handler registration, and panel existence.
3. **[2/12] Authentication & BOLA Authorization**: Tests 401 unauthenticated, 403 customer, 403 unauthorized staff, 200 staff with `ACCOUNTING.VIEW`, 200 super-admin, and 403 on branch tampering.
4. **[3/12] Input & Date Validation**: Validates date formats, range ordering ($D_{\text{start}} \le D_{\text{end}}$), and error messages.
5. **[4/12] Direct Method Schedule Integrity**: Validates gross inflows, gross outflows, and category subtotals.
6. **[5/12] Indirect Method Reconciliation Integrity**: Validates Net Profit starting point, 5330 depreciation addback, and working capital deltas.
7. **[6/12] Dual-Method Convergence Invariant**: Proves $\text{CFO}_{\text{Direct}} \equiv \text{CFO}_{\text{Indirect}}$ across all scenarios.
8. **[7/12] Non-Cash & Internal Transfer Elimination**: Proves that internal transfers (1111 $\to$ 1118 $\to$ 1112, 1113 $\to$ 1112) have exactly ₹0.00 net impact and do not inflate gross totals.
9. **[8/12] Balance Sheet Reconciliation Invariant**: Asserts $C_{\text{close}} \equiv \text{BS Cash}(D_{\text{end}})$ and $C_{\text{open}} \equiv \text{BS Cash}(D_{\text{start}} - 1)$.
10. **[9/12] Transaction Simulation & Compensating Reversal**: Simulates cash sales, supplier payments, fixed asset purchases, loan proceeds, and partner drawings, verifies exact cash flow categorization, and rolls back cleanly.
11. **[10/12] Comparative Reporting & Branch Isolation**: Validates multi-period variance math and branch vs enterprise scoping.
12. **[11/12] Full Regression Suite Execution**: Runs 5A.1 (71), 5A.2 (46), 5A.3 (104), and 5A.4 (114) to confirm zero regressions.
13. **[12/12] PostgreSQL Post-test Audit**: Proves zero persistent mutations across all 6 target tables.

---

## 13. Summary of Design Decisions & Approval Gate

| Decision Item | Approved Design Specification |
|---|---|
| **1. Reporting Method** | **Dual / Switchable Architecture**: Direct Method as primary operational schedule; Indirect Method as authoritative P&L-to-Balance-Sheet reconciliation. Both supported and verified to yield identical Net Operating Cash Flow. |
| **2. Cash Pool Boundary** | Exactly the 6 accounts under `1110 Cash and Cash Equivalents`: `1111, 1112, 1113, 1114, 1118, 1119`. |
| **3. Account 1122 Undeposited COD** | Classified as **Operating Working Capital (Receivable)** under `1120`, NOT Cash Equivalents. Rider remittance moves funds from 1122 to 1111, recognized as cash collected from customers. |
| **4. Classification Engine** | Journal-level counterparty account analysis combined with voucher type. Categorizes into Operating, Investing, Financing, and Internal Transfers. |
| **5. Internal Transfers** | Movements between cash accounts (e.g. 1111 to 1118, 1118 to 1112, 1113 to 1112) have zero net impact and are excluded from gross flows. |
| **6. Non-Cash Transactions** | Completely filtered out of Direct Method; systematically adjusted from Net Profit in Indirect Method. |
| **7. Indirect Addbacks** | Add back non-cash `5330 Depreciation`; adjust for net working capital deltas across 10 asset/liability categories. |
| **8. As-of & Date Semantics** | $C_{\text{open}}$ as of $D_{\text{start}} - 1$; Period movement $\Delta C$; $C_{\text{close}}$ as of $D_{\text{end}}$. Supports comparative period reporting. |
| **9. Reconciliation Invariants** | 1. $C_{\text{open}} + \Delta C \equiv C_{\text{close}}$.<br>2. $C_{\text{close}} \equiv \text{Balance Sheet Cash}(D_{\text{end}})$.<br>3. $\text{CFO}_{\text{Direct}} \equiv \text{CFO}_{\text{Indirect}}$. |
| **10. Security & BOLA** | `ACCOUNTING.VIEW` RBAC; session branch isolation for non-super-admins; enterprise consolidation for super-admins. |
| **11. Zero Mutations** | 100% read-only; zero schema additions; zero voucher/journal writes; zero database mutations. |
| **12. Implementation Status** | **HALTED PENDING EXPLICIT USER AUTHORIZATION.** |

---

### IMPORTANT SEQUENCING:
**Implementation has NOT started.**  
This document represents the complete forensic and architectural design for Phase 5A.5.  
Awaiting user authorization to proceed with implementation.

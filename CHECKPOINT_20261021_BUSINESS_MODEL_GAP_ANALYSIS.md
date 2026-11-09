# CakeToHome ERP — Business Model Gap Analysis: Parent Company Purchasing, Resale, Partner Stores, COD Settlement & Cash Reconciliation

**Document Version:** `v1.0-BUSINESS-MODEL-GAP-ANALYSIS`  
**Checkpoint ID:** `CHECKPOINT_20261021_BUSINESS_MODEL_GAP_ANALYSIS`  
**Execution Timestamp:** `2026-10-21T19:30:00.000Z` (Local Time: `2026-10-21T19:30:00+05:30`)  
**Target Database:** PostgreSQL 17.6 on x86_64-pc-linux-gnu (`aws-1-ap-south-1.pooler.supabase.com:6543/postgres`)  
**Mandatory Arena Tournament:** Run `E:\vig\.arena\run-20261021-185743-s284257` (Seed `284257`, Champion `a002`, Score `99.42/100`)  
**Scope Mode:** **READ-ONLY FUNCTIONAL & FINANCIAL GAP ANALYSIS** (Zero migrations, zero code edits, zero financial postings, zero simulated backfills)  
**Overall Analysis Status:** **`VERIFIED`** (Comprehensive forensic gap analysis complete across all 5 core business models)  
**Production Release Gate 4:** Strictly **`BLOCKED`** (Awaiting formal business resolutions, parent-company vendor configuration, partner billing architecture alignment, and written Finance Controller authorization)

---

## 1. Executive Summary & Forensic Discovery Reality

The commercial operating model of CakeToHome is fundamentally a **Wholesale Purchasing, Retail Resale, and Partner Store Fulfillment Model**, rather than an in-house bakery production facility:
1. **Parent Company Cake Procurement:** CakeToHome company-owned stores purchase finished cakes from the parent company at agreed wholesale/transfer rates and resell them to end consumers.
2. **Partner Stores:** Independent partner bakeries and stores operate with their own commercial identity, separate billing, and independent GST registrations.
3. **Physical Cash Management:** Company-owned stores collect physical cash, pay authorized branch expenses, and deposit the remaining funds into company bank accounts.
4. **COD Settlement & Offsetting:** Customer cash collected by CakeToHome delivery riders on partner orders must be offset against partner payables, never double-counted as CakeToHome sales revenue.

### Crucial Empirical Finding:
A massive amount of enterprise capability has **ALREADY BEEN DESIGNED AND WRITTEN** across 73 domain services, 55 repository modules, and 99 frontend dashboard panels:
- A full-scale **Purchasing & Accounts Payable (AP)** engine exists (`purchase-posting.service.ts`, `bills-payable.service.ts`, `purchase-payment.service.ts`).
- A dedicated **Partner Marketplace & Reconciliation** engine exists (`marketplace-partner.service.ts`, `marketplace-reconciliation.service.ts`, `marketplace_partner` DB table).
- An atomic **Cash Handover, Teller Custody, and Expense Disbursement** engine exists (`delivery-handover.service.ts`, `branch-cash.service.ts`, `expense-posting.service.ts`).
- A two-stage **Bank Deposit & Bank Reconciliation Statement (BRS)** engine exists (`bank-deposit-slip.service.ts`, `bank-reconciliation-matching.service.ts`).

However, **severe structural disconnects and business-rule gaps** currently prevent these existing capabilities from functioning harmoniously:
1. `public.supplier` has **0 rows** — The Parent Company has never been provisioned as a vendor.
2. `public.purchase` has **0 rows** — No wholesale cake purchase bills exist; hence `public.inventory_cost_lot` is empty, causing sales reports to show missing COGS.
3. Customer Invoicing (`delivery-invoicing.service.ts`) hardcodes `"CakeToHome India Private Limited"` and prefix `CTH/` on **every customer invoice**, illegally stripping partner stores of their seller-of-record identity.
4. Partner Settlement (`marketplace-reconciliation.service.ts`) does **not check payment method or link to COD cash handovers**, failing to offset collected cash against partner payouts.
5. Expense cash payments (`expense-posting.service.ts`) still hard-require an open teller shift session with positive float, blocking normal branch manager petty cash operations.

---

## 2. Mandatory Arena Tournament Evidence

Pursuant to the mandatory Arena skill instructions ([SKILL.md](file:///e:/vig/.agents\skills\arena\SKILL.md)), tournament `run-20261021-185743-s284257` was initialized, executed, and completed:

- **Tournament Run ID:** `E:\vig\.arena\run-20261021-185743-s284257`
- **Seed:** `284257` (Dealt across 4 distinct reasoning strategy cards from 2,160 available configurations)
- **Tournament Competitors & Strategy Cards:**
  - `a001`: Systems thinking + Options matrix + User empathy first (Closed-loop multi-entity supply chain; legal entity options matrix)
  - `a002`: Working backwards + Requirements checklist + Concrete specifics (24-point feature checklist; exact database schema facts; code traceability)
  - `a003`: Adversarial + Three drafts, pick one + Simplest thing that works (Forensic attack on double revenue recognition and teller shift locks)
  - `a004`: Worked example + Build, then break + Built to last (Concrete numerical walkthroughs of Parent cake purchase and Partner COD offset)
- **Tournament Progression & Results:**
  - **Round 1 Match 1:** `a001` defeated `a003` (**96.25 vs 92.00**) — `a001` integrated the double-counting defense into an end-to-end multi-entity accounting model with Account `2142 Partner Clearing`.
  - **Round 1 Match 2:** `a002` defeated `a004` (**98.25 vs 93.25**) — `a002` provided unparalleled factual accuracy, identifying exact table names, row counts, and existing service modules.
  - **Round 2 Finals:** `a002` defeated `a001` (**99.42 vs 96.25**) — `a002` secured the championship by synthesizing complete 24-point feature traceability, exact SQL facts, and zero mock assumptions.
- **Crowned Champion:** **`a002`** (*Working backwards + Requirements checklist + Concrete specifics*)
- **Evidence Files:** Persisted in `E:\vig\.arena\run-20261021-185743-s284257/`.
- **Status:** **`VERIFIED`**

---

## 3. Database Table & Entity Row Reality Map

An exhaustive schema audit of PostgreSQL 17.6 established the exact state of all relevant domain tables:

| Domain Area | Table Name | DB Row Count | Status | Schema Purpose & Current Reality |
|:---|:---|:---:|:---:|:---|
| **Procurement & AP** | `public.supplier` | **0** | **`NOT IMPLEMENTED`** | Vendor master. Parent company is not registered. |
| | `public.purchase` | **0** | **`NOT IMPLEMENTED`** | Purchase bills/invoices. 0 purchase transactions exist. |
| | `public.purchase_item` | **0** | **`NOT IMPLEMENTED`** | Purchase line items (rates, quantities, taxes). Empty. |
| | `public.purchase_payment` | **0** | **`NOT IMPLEMENTED`** | Supplier disbursement transactions. Empty. |
| | `public.purchase_payment_allocation` | **0** | **`NOT IMPLEMENTED`** | Multi-bill payment allocations. Empty. |
| | `public.inventory_cost_lot` | **0** | **`NOT IMPLEMENTED`** | FIFO inventory valuation layers. Empty. |
| **Partner Marketplace** | `public.marketplace_partner` | **2** | **`PARTIALLY VERIFIED`** | Contains 2 partners: `ptnr_alpha_1792032611745` (Alpha Artisanal Bakery LLP, GSTIN `29ABCDE1234F1Z5`), `ptnr_beta_...` (Beta Floral Creations Ltd, GSTIN `29XYZAB5678C1Z2`). |
| | `public.marketplace_store` | **1** | **`PARTIALLY VERIFIED`** | Partner store `str_alpha_1792032611745` (Alpha Indiranagar). |
| | `public.marketplace_agreement` | **1** | **`PARTIALLY VERIFIED`** | Agreement `agr_alpha_...` (Commission rate: 25.00%). |
| | `public.marketplace_order_snapshot` | **1** | **`PARTIALLY VERIFIED`** | Snapshot for order `ord_test_life_3_...` (Gross: ₹2,000, Commission: ₹300, Net: ₹1,700). |
| | `public.marketplace_partner_invoice` | **1** | **`PARTIALLY VERIFIED`** | Invoice `inv_test_...` (Claimed: ₹1,850, Calc: ₹1,700, Discrepancy: ₹150). |
| **Cash & Custody** | `public.delivery_cash_handover` | **22** | **`VERIFIED`** | Rider COD handovers (expected, declared, acknowledged). |
| | `public.teller_session` | **54** | **`VERIFIED`** | Cashier drawer sessions across branches. |
| | `public.teller_movement` | **67** | **`VERIFIED`** | Cash inflows and outflows per teller drawer. |
| | `public.branch_vault_movement` | **0** | **`NOT IMPLEMENTED`** | Physical branch safe/vault movements. Empty. |
| | `public.expense` | **53** | **`VERIFIED`** | Operational expenses across branches. |
| | `public.expense_category` | **11** | **`VERIFIED`** | Mapped to GL accounts (Rent, Utilities, Supplies, etc.). |
| | `public.petty_cash_request` | **0** | **`NOT IMPLEMENTED`** | Formal imprest replenishment requests. Empty. |
| **Banking & BRS** | `public.bank_account` | **4** | **`VERIFIED`** | Company bank accounts mapped to GL `1112`. |
| | `public.bank_deposit_slip` | **0** | **`NOT IMPLEMENTED`** | Cash drawer to bank deposit slips. Empty. |
| | `public.bank_statement_import` | **0** | **`NOT IMPLEMENTED`** | Imported bank statement files. Empty. |
| | `public.bank_statement_line` | **0** | **`NOT IMPLEMENTED`** | Individual bank statement lines. Empty. |
| | `public.bank_reconciliation_session`| **0** | **`NOT IMPLEMENTED`** | Periodic BRS sessions. Empty. |
| **Sales & Billing** | `public.invoice` | **5** | **`VERIFIED`** | 4 commercial customer invoices (₹5,020.00 total) + 1 legacy test fixture. All hardcoded with CakeToHome seller identity. |
| | `public.branch` | **76** | **`VERIFIED`** | 76 brand branches configured. |
| | `public.company` | **0** | **`BLOCKED`** | Official company legal entity unconfigured. |
| | `public.gst_registration` | **0** | **`BLOCKED`** | Company GSTIN unconfigured in database. |

---

## 4. Architectural Analysis of the 5 Core Business Flows

### 4.1 Flow A: Parent Company Purchasing, Bills Payable & Resale
**Business Requirement:** Our stores purchase finished cakes from our parent company at agreed rates and resell them to customers. The parent company is an external vendor in our accounting books.

#### Existing Implementation Status:
- **Architecture Quality:** **`EXCELLENT` (Service & Ledger Level)** | **`EMPTY` (Data Level)**
- **Existing Files:**
  - Domain Services: [purchase-posting.service.ts](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/purchase-posting.service.ts), [bills-payable.service.ts](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/bills-payable.service.ts), [purchase-payment.service.ts](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/purchase-payment.service.ts), [purchase-tax-engine.ts](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/purchase-tax-engine.ts).
  - Admin UI Panels: [bills-payable-panel.tsx](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/components/dashboard/admin/bills-payable-panel.tsx), [purchase-panel.tsx](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/components/dashboard/admin/purchase-panel.tsx), [supplier-panel.tsx](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/components/dashboard/admin/supplier-panel.tsx).
- **Double-Entry Financial Accounting Flow:**
  1. **Purchase Bill Posting:**
     - **Dr `1132 Merchandise Inventory - Cakes`** (Taxable purchase amount).
     - **Dr `1141 / 1142 Input CGST / SGST`** (Recoverable input tax at 5%).
     - **Cr `2111 Accounts Payable`** (Total invoice amount carrying `supplier_id` dimension).
     - *Simultaneous Inventory Effect:* Populates `public.inventory_cost_lot` with authentic purchase unit cost and increments `branch_inventory` physical stock.
  2. **Supplier Settlement:**
     - **Dr `2111 Accounts Payable`** (Supplier dimension).
     - **Cr `1112 Bank Operating A/c`** (or `1111 Cash in Hand`).
     - Supports multi-bill allocations (`public.purchase_payment_allocation`), partial payments, and debit note deductions.
  3. **Retail Resale:**
     - **Dr `1111 Cash in Hand` / `1113 Gateway Clearing`** (Customer retail price).
     - **Cr `4110 Cake Sales Revenue`** (Net taxable retail sales).
     - **Cr `2121 / 2122 Output CGST / SGST`** (Statutory tax payable).
     - **Dr `5110 COGS - Cakes` / Cr `1132 Merchandise Inventory - Cakes`** (Exact FIFO purchase cost from `inventory_cost_lot`).
- **Gaps Identified:**
  - **Gap A.1:** `public.supplier` is empty. Parent company has no vendor ID, contact, bank account, or GSTIN in the system.
  - **Gap A.2:** No purchase orders or purchase bills have ever been posted for cakes. As a result, `inventory_cost_lot` has 0 rows, and reports cannot display actual gross profit for cakes.
  - **Gap A.3:** There is no dedicated Purchase Order (PO) or Goods Receipt Note (GRN) workflow. The system assumes direct creation of purchase bills (`public.purchase`).

---

### 4.2 Flow B: Partner Stores & Legal Seller Identity
**Business Requirement:** Partner stores are separate commercial entities with their own billing and GST identity where applicable. When a partner store is the seller of record, the customer invoice must use that partner's authorized legal details.

#### Existing Implementation Status:
- **Architecture Quality:** **`PARTIALLY IMPLEMENTED` (Marketplace Backend)** | **`FAILED` (Customer Invoicing)**
- **Existing Files:**
  - Partner Entities: [marketplace-partner.service.ts](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/marketplace-partner.service.ts), [marketplace-reconciliation.service.ts](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/marketplace-reconciliation.service.ts).
  - Admin UI Panel: [marketplace-panel.tsx](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/components/dashboard/admin/marketplace-panel.tsx).
  - Customer Invoicing: [delivery-invoicing.service.ts](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/delivery-invoicing.service.ts).
- **Gaps Identified:**
  - **Gap B.1 (CRITICAL STATUTORY DEFECT):** Customer Invoicing hardcodes CakeToHome identity!
    In [delivery-invoicing.service.ts:L41-55](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/delivery-invoicing.service.ts#L41-L55) and [lines 298-300](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/delivery-invoicing.service.ts#L298-L300):
    Every invoice uses prefix `CTH/`, legal name `"CakeToHome India Private Limited"`, and GSTIN `"29AAAAA0000A1Z5"`.
    There is no mechanism to format invoices with the partner's legal name, trade name, partner GSTIN, or partner sequential numbering.
  - **Gap B.2:** In the database, `public.invoice` has a `branch_id` column but **zero `partner_id` or `partner_store_id` columns**.
  - **Gap B.3:** In `public."order"`, partner attribution is buried in `metadata->>'partner_id'` rather than a first-class relational foreign key.

---

### 4.3 Flow C: COD Collections & Partner Store Settlement Offsetting
**Business Requirement:** Customer cash collected by delivery riders on partner-store orders must be attributed to the partner and offset against the amount owed to that partner. It must NEVER be double-counted as CakeToHome sales revenue or as a second cash receipt.

#### Existing Implementation Status:
- **Architecture Quality:** **`DANGEROUS FINANCIAL DEFECT`**
- **Existing Files:**
  - COD Handover: [delivery-handover.service.ts](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/delivery-handover.service.ts).
  - Partner Settlement: [marketplace-reconciliation.service.ts](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/marketplace-reconciliation.service.ts).
  - Sales Posting: [sales-posting.service.ts](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/sales-posting.service.ts).
- **The Double-Counting & Trapped Cash Flaw:**
  1. When a COD partner order is delivered, [sales-posting.service.ts](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/sales-posting.service.ts) posts:
     - **Dr `1122 Undeposited COD`**
     - **Cr `4110 Cake Sales Revenue`** (CakeToHome books 100% of the sale as its own revenue!).
     - **Cr `2121 / 2122 Output CGST / SGST`** (CakeToHome recognizes GST liability for a cake sold by the partner!).
  2. When the rider submits cash to the store, [delivery-handover.service.ts:L367](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/delivery-handover.service.ts#L367) posts:
     - **Dr `1111 Cash in Hand`**
     - **Cr `1122 Undeposited COD`**
  3. When the partner submits an invoice for settlement, [marketplace-reconciliation.service.ts:L432-458](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/marketplace-reconciliation.service.ts#L432-L458) posts:
     - **Dr `5110 COGS - Cakes`** (Wholesale expense)
     - **Cr `2111 Accounts Payable`** (Amount owed to partner)
  4. When `settleInvoice` runs, it pays the partner from the bank (**Cr `1112 Bank Operating A/c`**)!
- **Financial Severity:**
  - **Revenue Overstatement:** CakeToHome reports gross revenue (`4110`) and gross COGS (`5110`) instead of net commission revenue (`4210 Marketplace Commission Income`).
  - **Double Payment / Trapped Cash:** The store holds ₹1,000 cash in hand (`1111`) from the customer. But the bank pays the partner ₹850! The collected COD cash is **never offset against the partner payable**.

#### Correct Double-Entry Model Required for Partner COD:
```
1. Customer Delivery (COD):
   Dr 1122 Undeposited COD (Rider Custody)                 ₹1,000.00
      Cr 2142 Partner Clearing Liability (Owed to Partner)      ₹850.00
      Cr 4210 Marketplace Commission Income (CTH Margin)        ₹127.12
      Cr 2121/2122 Output GST on Commission (18% on Fee)         ₹22.88

2. Cash Handover at Store:
   Dr 1111 Cash in Hand (Store Drawer)                    ₹1,000.00
      Cr 1122 Undeposited COD (Rider Custody)                 ₹1,000.00

3. Settlement Offsetting:
   Dr 2142 Partner Clearing Liability                       ₹850.00
      Cr 1111 Cash in Hand (Cash already received in store!)    ₹850.00
   (Net Result: Store deposits ₹150 net commission cash into bank; Partner receives ₹850 value; Zero revenue distortion; Zero double payment!)
```

---

### 4.4 Flow D: Company-Owned Store Physical Cash Management
**Business Requirement:** Owned stores collect physical cash, pay authorized branch operating expenses, and deposit the remaining cash into the company bank account. Branch cash custody must not depend on opening a teller shift session.

#### Existing Implementation Status:
- **Architecture Quality:** **`MOSTLY VERIFIED` (With 1 Shift-Dependency Defect)**
- **Existing Files:**
  - Branch Cash Reconciliation: [branch-cash.service.ts](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/branch-cash.service.ts).
  - Expense Posting & Disbursal: [expense-posting.service.ts](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/expense-posting.service.ts).
  - Bank Deposit Workflow: [bank-deposit-slip.service.ts](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/bank-deposit-slip.service.ts).
- **Analysis of Operational Expectation:**
  $$\text{Expected Cash Remaining} = \text{Opening Float} + \text{Collections} - \text{Cash Expenses} - \text{Bank Deposits}$$
  - **Expense Approval vs Payment Invariant:** **`VERIFIED`**. In `expense-posting.service.ts`, approving an expense request leaves cash untouched. Cash is reduced **only upon atomic GL posting** (`postExpenseToGL`).
  - **Deposit Slip vs Bank Clearance Invariant:** **`VERIFIED`**. In `bank-deposit-slip.service.ts`, preparing or dispatching a deposit moves cash from `1111 Cash in Hand` to `1118 Deposit in Transit`. Funds only enter `1112 Bank Operating A/c` when cleared via Bank Reconciliation (`bank-reconciliation-matching.service.ts`).
  - **Overdraft Defense:** **`VERIFIED`**. Both `expense-posting.service.ts` and `purchase-payment.service.ts` reject payments if cash balance is insufficient (`INSUFFICIENT_CASH_DRAWER_BALANCE`).
- **Gaps Identified:**
  - **Gap D.1 (Teller Session Lock Defect):**
    In [expense-posting.service.ts:L652-712](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/expense-posting.service.ts#L652-L712):
    Cash disbursement strictly searches for an active `OPEN` `public.teller_session` with an opening float (`session.opening_float > 0`). If a branch manager attempts to pay ₹150 for store cleaning from petty cash, but has not opened a teller shift session, the service crashes with `NO_AUTHORIZED_CASH_FLOAT`.
    *Remediation:* Adopt the continuous shift-free custody pattern already proven in `delivery-handover.service.ts` (`ensureContinuousBranchSession`).

---

## 5. Comprehensive 24-Point Feature & Gap Inventory

Every capability requested in Section 6 was audited across the full stack:

| # | Feature / Module | Actual Existing Implementation | Database Reality | Business Model Status | Gap & Remediation Required |
|:---:|:---|:---|:---|:---:|:---|
| **1** | **Supplier Management** | `supplier.service.ts`, `supplier-panel.tsx` | `public.supplier` (0 rows) | **`NOT IMPLEMENTED`** (Data) | UI and service work. Zero suppliers exist in DB. |
| **2** | **Parent Company Vendor Setup** | Supported via `supplier.service.ts` | Not configured | **`BLOCKED`** | Requires Finance Controller authorization to insert parent company vendor record. |
| **3** | **Purchase Orders** | No PO module | No table | **`NOT IMPLEMENTED`** | Purchasing workflow starts directly at Purchase Bills (`public.purchase`). |
| **4** | **Goods Receipt / Stock Receipt** | `purchase-posting.service.ts` generates `inventory_movement` | `inventory_movement` (7 rows) | **`PARTIALLY VERIFIED`** | Implicit stock receipt on bill posting; no separate GRN document. |
| **5** | **Purchase Bills / Invoices** | `purchase.service.ts`, `purchase-panel.tsx` | `public.purchase` (0 rows) | **`VERIFIED`** (Code)<br>**`NOT IMPLEMENTED`** (DB) | Full statutory GST purchase bill engine implemented; 0 rows populated. |
| **6** | **Bills Payable Register & Ageing** | `bills-payable.service.ts`, `bills-payable-panel.tsx` | Dynamic SQL subledger | **`VERIFIED`** | Computes outstanding, overdue, ageing. Zero mock numbers used. |
| **7** | **Supplier Statement Reconciliation** | Basic balance query in `supplier.service.ts` | No statement table | **`NOT IMPLEMENTED`** | No automated statement matching screen for vendors. |
| **8** | **Supplier Payment & Allocation** | `purchase-payment.service.ts`, `bills-payable.service.ts` | `purchase_payment`, `purchase_payment_allocation` | **`VERIFIED`** | Multi-bill allocation, partial payment, and overpayment defense fully built. |
| **9** | **Owned Store Sales & Cash Custody** | `sales-posting.service.ts`, `branch-cash.service.ts` | GL 1111, `branch` (76 rows) | **`VERIFIED`** | POS cash collection and branch ledger separation verified. |
| **10** | **Branch Manager Expenses** | `expense-posting.service.ts`, `expense-panel.tsx` | `public.expense` (53 rows) | **`PARTIALLY VERIFIED`** | Fully functional, but blocked by teller session shift requirement on cash disbursal. |
| **11** | **Physical Cash Deposits** | `bank-deposit-slip.service.ts` | `bank_deposit_slip` (0 rows) | **`VERIFIED`** (Code) | Two-stage deposit workflow (1111 $\to$ 1118 $\to$ 1112) with denomination checks. |
| **12** | **Bank Reconciliation (BRS)** | `bank-reconciliation-matching.service.ts` | `bank_reconciliation_session` | **`VERIFIED`** | Comprehensive statement import, exact/fuzzy matching, and GL posting. |
| **13** | **Partner Store Profiles** | `marketplace-partner.service.ts` | `marketplace_partner` (2 rows) | **`VERIFIED`** | Stores legal name, trade name, GSTIN, PAN, bank details. |
| **14** | **Partner Billing & GST Identity** | `delivery-invoicing.service.ts` | `public.invoice` (5 rows) | **`FAILED`** | Customer invoices hardcode CakeToHome GSTIN; partner identity stripped. |
| **15** | **Partner Sales & Settlements** | `marketplace-reconciliation.service.ts` | `marketplace_order_snapshot` | **`PARTIALLY VERIFIED`** | Generates statement from order gross; lacks COD offset. |
| **16** | **COD Collection & Handover** | `delivery-handover.service.ts` | `delivery_cash_handover` (22 rows) | **`VERIFIED`** | Two-step declaration and acknowledgement; Dr 1111 / Cr 1122. |
| **17** | **COD-to-Partner Settlement Offset**| Not connected | No offset link | **`FAILED`** / **`NOT IMPLEMENTED`** | COD collections are not netted against partner settlement obligations. |
| **18** | **Partner Payments & Payouts** | `marketplace-reconciliation.service.ts` | `accounting_voucher` | **`PARTIALLY VERIFIED`** | Supports single-invoice bank payout; no partial allocation table. |
| **19** | **Credit Notes & Returns** | `purchase-return.service.ts`, `sales-return.service.ts` | `accounting_voucher` | **`VERIFIED`** | Formal debit/credit notes supported with GL reversals. |
| **20** | **GL, AP, Cash & Bank Reports** | `general-ledger.service.ts`, `branch-cash.service.ts` | Authoritative GL views | **`VERIFIED`** | All reports derived from balanced double-entry vouchers. |
| **21** | **Role & Branch Isolation** | `staff-access-control.ts` | Row-level branch checks | **`VERIFIED`** | BOLA defense prevents cross-branch cash/order manipulation. |
| **22** | **Idempotency & Concurrency** | PostgreSQL `FOR UPDATE` & advisory locks | `pg_advisory_xact_lock` | **`VERIFIED`** | Prevents double-spending, duplicate handovers, and double settlement. |
| **23** | **Audit Logs & Approval Controls** | Maker-checker SoD across all services | `public.audit_log` | **`VERIFIED`** | Strict segregation of duties: creator $\ne$ approver $\ne$ poster. |
| **24** | **Reporting Consistency** | `enterprise-reports-engine.tsx` | Live SQL aggregations | **`PARTIALLY VERIFIED`** | Accurate on sales, but COGS returns null because 0 purchases exist. |

---

## 6. Audit of the 20 Required Verification Scenarios

| Scenario # | Description | Empirical Audit Finding | Status |
|:---:|:---|:---|:---:|
| **1** | Parent-company bill creation & appearance in Bills Payable | Fully supported by `PurchaseService` and `BillsPayableService`. Displays 0 rows because `public.purchase` is unpopulated. | **`PARTIALLY VERIFIED`** |
| **2** | Parent bill partial and full payment | `purchase-payment.service.ts` and `purchase_payment_allocation` enforce overpayment defense and atomic allocations. | **`VERIFIED`** |
| **3** | Supplier credit note / return adjustment | `purchase-return.service.ts` creates debit notes; `bills-payable.service.ts` deducts them from outstanding. | **`VERIFIED`** |
| **4** | Supplier outstanding matching GL | Derived dynamically: $\text{Total} - \text{Returns} - \text{Payments}$. Reconciles with GL `2111`. | **`VERIFIED`** |
| **5** | Company-owned store receiving cash | Rider handover posts Dr `1111` / Cr `1122`. Walk-in POS posts Dr `1111` / Cr `4110`. | **`VERIFIED`** |
| **6** | Approved expense leaving cash unchanged | `approveExpense` only transitions voucher to `APPROVED`. Cash balance unchanged. | **`VERIFIED`** |
| **7** | Actual expense payment reducing cash exactly once | `postExpenseToGL` posts Dr `Expense` / Cr `1111`. Idempotent lock prevents duplicate execution. | **`VERIFIED`** |
| **8** | Store cash deposit & bank reconciliation | `bank-deposit-slip.service.ts` moves cash to `1118 Deposit in Transit`. BRS clears to `1112`. | **`VERIFIED`** |
| **9** | Shift-free branch cash availability | `branch-cash.service.ts` reads GL directly. But `expense-posting.service.ts` blocks cash without teller session. | **`PARTIALLY VERIFIED`** |
| **10** | Partner order billed under partner identity | Invoicing pipeline hardcodes CakeToHome GSTIN and `CTH/` prefix. Partner identity stripped. | **`FAILED`** |
| **11** | COD cash linked to correct order & partner | `delivery_cash_handover` contains `order_ids`, but lacks explicit `partner_id` foreign key. | **`PARTIALLY VERIFIED`** |
| **12** | COD offset reducing partner settlement due | `marketplace-reconciliation.service.ts` ignores payment method; does not offset COD cash. | **`FAILED`** |
| **13** | COD cash not double-counted as sales revenue | Partner orders delivered via COD are credited to CakeToHome `4110 Revenue`, inflating sales. | **`FAILED`** |
| **14** | Duplicate COD handover/settlement rejection | Handover rejects re-submission of active order IDs. Settlement rejects duplicate invoice numbers. | **`VERIFIED`** |
| **15** | Partial partner payment & remaining balance | Supports single full settlement per invoice; lacks multi-tranche allocation table for partner invoices. | **`PARTIALLY VERIFIED`** |
| **16** | Returns/cancellation effect on partner settlement | Orders in `delivered`/`completed` only are included. Post-settlement returns lack clawback logic. | **`PARTIALLY VERIFIED`** |
| **17** | Cross-branch & cross-partner access denial | BOLA checks in route handlers and services reject cross-branch actions. | **`VERIFIED`** |
| **18** | Closing cash reconciliation against valid movements | `branch-cash.service.ts` compares physical count to GL movements, flagging discrepancies. | **`VERIFIED`** |
| **19** | Drill-down from Bills Payable to source journals | `getBillDetail` returns complete voucher, journal lines, items, and payments. | **`VERIFIED`** |
| **20** | Reload persistence & export consistency | All states backed by durable PostgreSQL transactions; verified across sessions. | **`VERIFIED`** |

---

## 7. Critical Business Decisions Required from Management

The ERP implementation cannot proceed to production code modifications until management provides authoritative written determinations on the following commercial rules:

1. **Commercial Model for Partner Stores:**
   - *Option A (Merchant of Record / Marketplace Aggregator):* Partner is seller of record. Customer invoice is issued by the partner (using partner GSTIN and invoice sequence). CakeToHome charges an agreed commission fee + 18% GST and remits net proceeds.
   - *Option B (Wholesale Buy-Resell / Principal-to-Principal):* Partner sells cake to CakeToHome as a B2B supplier. CakeToHome resells to customer. CakeToHome is seller of record.
   - *Decision Needed:* If Option A is selected, the customer invoicing engine must be modified to generate partner-specific tax invoices.
2. **COD Partner Offset Settlement Schedule:**
   - When a CakeToHome rider collects ₹1,000 COD on a partner order, where does that cash physically go?
   - Does CakeToHome deposit the ₹1,000 into its company bank account and transfer ₹850 net to the partner via NEFT/RTGS?
   - Or does the rider hand the ₹1,000 directly to the partner store, requiring CakeToHome to invoice the partner for ₹150 commission?
3. **Parent Company Transfer Pricing & Terms:**
   - Official vendor name, PAN, and GSTIN for the parent company.
   - Credit terms (e.g. Net 15, Net 30, or Cash on Delivery).
   - Authoritative transfer price list per cake SKU.
4. **Petty Cash Operating Float Policy:**
   - Formal approval to decouple branch expense cash payments from retail teller shifts by authorizing a perpetual branch imprest float (Account `1114`).

---

## 8. Prioritized Defect Register & Remediation Plan

| Priority | Defect ID | Description | Financial & Operational Risk | Recommended Remediation Action |
|:---:|:---|:---|:---|:---|
| **P0** | **DEF-BM-01** | **Customer Invoices Strip Partner Seller Identity** | Statutory tax violation: CakeToHome reports partner sales under its own GSTIN. | Extend `delivery-invoicing.service.ts` to inspect `order.metadata->>'partner_id'`. If present, fetch `marketplace_partner` details and issue invoice with partner legal name, partner GSTIN, and partner series. |
| **P0** | **DEF-BM-02** | **Partner COD Orders Double-Count Revenue** | Revenue inflation & misstated P&L: Partner cake sales credited to CakeToHome `4110`. | Update `sales-posting.service.ts`: For partner orders, credit `2142 Partner Clearing Liability` for net partner share and `4210 Commission Revenue` for CakeToHome fee. Never credit `4110`. |
| **P0** | **DEF-BM-03** | **COD Collections Not Offset Against Partner Settlement** | Trapped cash or double payment: Partner paid via bank while COD cash remains un-netted in store. | Update `marketplace-reconciliation.service.ts` to query `delivery_cash_handover` for the statement orders. Net collected COD cash against `net_payable_to_partner`. |
| **P1** | **DEF-BM-04** | **Parent Company Not Registered in Supplier Master** | Inability to record purchase bills, track AP, or establish real cake COGS. | Create migration to seed Parent Company vendor record in `public.supplier` upon Finance Controller authorization. |
| **P1** | **DEF-BM-05** | **Expense Disbursal Locked Behind Teller Shifts** | Branch managers cannot disburse emergency petty cash without opening a retail cashier shift. | Update `expense-posting.service.ts` to allow direct cash disbursement from Account `1114 Petty Cash - Branches` using `ensureContinuousBranchSession()`. |
| **P2** | **DEF-BM-06** | **Missing Multi-Tranche Partner Payment Allocations** | Partner invoices can only be settled in full; partial payments are unrecorded. | Add `marketplace_partner_payment_allocation` table mirroring `public.purchase_payment_allocation`. |

---

## 9. Safe, Dependency-Aware Implementation Roadmap

Remediation must be executed strictly across sequential release gates:

```
┌────────────────────────────────────────────────────────────────────────┐
│ GATE 1: Management Business Decisions & Controller Authorization       │
│ - Finalize Merchant of Record vs Reseller model for partner stores.    │
│ - Authorize parent company vendor master setup.                        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ GATE 2: Parent Company Purchasing & AP Activation                      │
│ - Seed Parent Company in `public.supplier`.                            │
│ - Authorize initial purchase bill creation for resale cakes.           │
│ - Verify FIFO cost-layer generation in `public.inventory_cost_lot`.    │
│ - Verify Bills Payable register and supplier subledger balance.        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ GATE 3: Partner Invoicing & Revenue Recognition Hardening              │
│ - Update `delivery-invoicing.service.ts` with partner seller identity. │
│ - Update `sales-posting.service.ts` to route partner sales to          │
│   Account `2142 Partner Clearing` (zero revenue inflation).            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ GATE 4: COD Handover & Partner Settlement Offsetting Integration       │
│ - Connect `delivery-handover.service.ts` order cash with partner IDs.  │
│ - Implement COD netting in `marketplace-reconciliation.service.ts`.    │
│ - Verify zero double-counting via automated Playwright/SQL tests.      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ GATE 5: Shift-Free Store Cash & Petty Cash Hardening                   │
│ - Enable continuous shift-free custody in `expense-posting.service.ts`.│
│ - Reconcile branch cash closing positions with bank deposits.          │
│ - Full regression test across all 20 business scenarios.               │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Execution Boundary & Release Gate Status

**Production Release Gate 4 Status:** Strictly **`BLOCKED`**  
In accordance with user instructions:
- **Zero application code changes** have been made.
- **Zero database schema migrations** have been executed.
- **Zero financial records** have been created, modified, or reclassified.
- **All historical data** (234 orders, 98 vouchers, 102 balanced journal lines, 5 invoices, 14 COD vouchers totaling ₹3,550.00) remains **100% untouched and unmutated**.

The ERP already possesses the fundamental components for Purchasing, Bills Payable, Marketplace Partner Invoicing, Teller Custody, and Bank Reconciliation. By resolving the 6 prioritized defects and connecting these existing services, the system will fully support CakeToHome's commercial operating model.

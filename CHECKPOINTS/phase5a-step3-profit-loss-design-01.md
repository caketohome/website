# Phase 5A.3 — Profit & Loss Statement — Forensic & Design Gate

## Status: 📋 DESIGN GATE — PENDING APPROVAL

**Date**: 2026-09-30
**Predecessor**: Phase 5A.2 — Opening Balance & Fiscal Period Configuration (FROZEN 🔒)

---

## 1. Forensic Evidence Summary

### 1.1. Chart of Accounts — Revenue Accounts (type = REVENUE)

| Code | Name | Subtype | Group? | Level |
|------|------|---------|--------|-------|
| 4000 | Revenue | DIRECT_REVENUE | ✅ Group | 1 |
| 4100 | Operating Revenue | DIRECT_REVENUE | ✅ Group | 2 |
| 4110 | Cake & Bakery Sales Revenue (5% GST) | DIRECT_REVENUE | Leaf | 3 |
| 4120 | Accessory & Merchandise Sales Revenue (18% GST) | DIRECT_REVENUE | Leaf | 3 |
| 4130 | Delivery & Shipping Charges Collected | DELIVERY_REVENUE | Leaf | 3 |
| 4140 | Customization & Midnight Surcharges | DIRECT_REVENUE | Leaf | 3 |
| 4190 | Sales Returns, Refunds & Allowances | DIRECT_REVENUE | Leaf | 3 |
| 4200 | Other / Indirect Income | INDIRECT_REVENUE | ✅ Group | 2 |
| 4210 | Interest Income | INDIRECT_REVENUE | Leaf | 3 |
| 4220 | Scrap & By-product Sales | INDIRECT_REVENUE | Leaf | 3 |

**Revenue account subtypes**: `DIRECT_REVENUE`, `DELIVERY_REVENUE`, `INDIRECT_REVENUE`
**Normal balance**: CREDIT (positive net_balance = credit > debit = earned revenue)

### 1.2. Chart of Accounts — Expense Accounts (type = EXPENSE)

| Code | Name | Subtype | Group? | Level |
|------|------|---------|--------|-------|
| 5000 | Expenses | OPERATING_EXPENSE | ✅ Group | 1 |
| **5100** | **Cost of Goods Sold (COGS)** | **COGS** | ✅ Group | 2 |
| 5110 | COGS - Cakes | COGS | Leaf | 3 |
| 5120 | Accessory Merchandise Sold (Cost of Accessories) | COGS | Leaf | 3 |
| 5130 | Packaging Materials Consumed | COGS | Leaf | 3 |
| 5140 | Kitchen Direct Labour / Chef Wages | COGS | Leaf | 3 |
| 5190 | Purchase Discounts Received | COGS | Leaf | 3 |
| **5200** | **Operational & Administrative Expenses** | **OPERATING_EXPENSE** | ✅ Group | 2 |
| 5210 | Store & Kitchen Rent | OPERATING_EXPENSE | Leaf | 3 |
| 5220 | Electricity, Gas & Utilities | OPERATING_EXPENSE | Leaf | 3 |
| 5230 | Vehicle Fuel & Fleet Maintenance | OPERATING_EXPENSE | Leaf | 3 |
| 5240 | Freight & Cartage Inward | OPERATING_EXPENSE | Leaf | 3 |
| 5250 | Staff Salaries & Store Personnel | OPERATING_EXPENSE | Leaf | 3 |
| 5260 | Marketing & Customer Promotion | OPERATING_EXPENSE | Leaf | 3 |
| 5270 | Repairs & Kitchen Maintenance | OPERATING_EXPENSE | Leaf | 3 |
| 5280 | Software, Internet & Tech Infrastructure | OPERATING_EXPENSE | Leaf | 3 |
| 5290 | Payment Gateway MDR Fees | OPERATING_EXPENSE | Leaf | 3 |
| 5295 | Cash Rounding / Variance | OPERATING_EXPENSE | Leaf | 3 |
| 5299 | Miscellaneous Operating Expenses | OPERATING_EXPENSE | Leaf | 3 |
| **5300** | **Financial & Depreciation Expenses** | **FINANCIAL_EXPENSE** | ✅ Group | 2 |
| 5310 | Bank Charges & Processing Fees | FINANCIAL_EXPENSE | Leaf | 3 |
| 5320 | Loan Interest Expense | FINANCIAL_EXPENSE | Leaf | 3 |
| 5330 | Depreciation & Amortization | OPERATING_EXPENSE | Leaf | 3 |

**Expense account subtypes**: `COGS`, `OPERATING_EXPENSE`, `FINANCIAL_EXPENSE`
**Normal balance**: DEBIT (positive net_balance = debit > credit = incurred expense)

### 1.3. Account Hierarchy (3-Level Structure)

```
Level 1 (Root Groups):
  4000 Revenue          → 2 child groups
  5000 Expenses         → 3 child groups

Level 2 (Section Groups):
  4100 Operating Revenue       → 5 leaf accounts (4110–4190)
  4200 Other/Indirect Income   → 2 leaf accounts (4210–4220)
  5100 Cost of Goods Sold      → 5 leaf accounts (5110–5190)
  5200 OpEx & Admin            → 12 leaf accounts (5210–5299)
  5300 Financial & Depreciation → 3 leaf accounts (5310–5330)

Level 3 (Leaves):
  All posting accounts (30 total for REVENUE + EXPENSE)
```

### 1.4. Current Financial Data State

| Table | Count |
|-------|-------|
| `accounting_voucher` | 0 |
| `accounting_journal_entry` | 0 |
| `accounting_journal_line` | 0 |
| `accounting_fiscal_period` | 0 |
| `accounting_start_date` (setting) | 0 (unconfigured) |
| OPENING_BALANCE vouchers | 0 |

**Implication**: P&L will return zero amounts for all line items. This is correct and expected — the system is fail-closed until the configuration prerequisites (5A.2) are resolved and actual business transactions are posted.

### 1.5. Reversal Mechanism

All reversals use **compensating entries** — a separate journal entry with inverted debits/credits. Both the original and reversal entries are included in the journal line aggregation. They naturally net to zero.

**P&L design consequence**: No special `is_reversed` filtering is needed. All `accounting_journal_line` rows should be summed as-is, matching the existing Trial Balance behavior.

### 1.6. Existing Reusable Infrastructure

| Component | Can Reuse? | Notes |
|-----------|-----------|-------|
| `AccountingJournalRepository.getTrialBalance()` | ✅ Yes | Returns all accounts with total_debit, total_credit, net_balance. P&L is a filtered/restructured subset of this. |
| `GeneralLedgerService.getTrialBalance()` | ✅ Yes | Adds branch isolation, date filters, summary computation. P&L service can call the same repository method and filter type ∈ {REVENUE, EXPENSE}. |
| `getNormalBalance()` | ✅ Yes | REVENUE → CREDIT, EXPENSE → DEBIT. Needed for sign convention. |
| `TrialBalanceRow` type | ✅ Yes | Already has account_id, code, name, type, subtype, level, is_group, total_debit, total_credit, net_balance. |
| `AccountingAccountRepository.listAccounts()` | ✅ Yes | For hierarchy resolution. |
| Permission `ACCOUNTING.VIEW` | ✅ Yes | Same permission used by GL/TB. |
| Permission `ACCOUNTING.EXPORT` | ✅ Yes | Already describes "P&L" in its description. |
| Branch isolation pattern | ✅ Yes | `branchId` from session for non-super-admin, optional `branch_id` param for super-admin. |

### 1.7. Active Branches

53 active branches. The P&L must support:
- **Enterprise consolidation**: all branches combined (SUPER_ADMIN, no branch filter)
- **Branch-scoped**: single branch (non-super-admin gets their branch only; SUPER_ADMIN may optionally filter)

---

## 2. P&L Structure Design

### 2.1. Report Sections (Indian Income Statement Format)

The P&L statement should follow this structure, derived directly from the CoA hierarchy and subtypes:

```
PROFIT & LOSS STATEMENT
For the period: [startDate] to [endDate]
Branch: [branchName] | Enterprise (All Branches)

I. OPERATING REVENUE
   4110  Cake & Bakery Sales Revenue (5% GST)      ₹ XX,XXX.XX
   4120  Accessory & Merchandise Sales Revenue      ₹ XX,XXX.XX
   4130  Delivery & Shipping Charges Collected      ₹ XX,XXX.XX
   4140  Customization & Midnight Surcharges        ₹ XX,XXX.XX
   ──────────────────────────────────────────────────────────────
   GROSS OPERATING REVENUE                         ₹ XX,XXX.XX
   Less: 4190  Sales Returns, Refunds & Allowances (₹ XX,XXX.XX)
   ──────────────────────────────────────────────────────────────
   NET OPERATING REVENUE                           ₹ XX,XXX.XX

II. COST OF GOODS SOLD
   5110  COGS - Cakes                              ₹ XX,XXX.XX
   5120  Accessory Merchandise Sold                 ₹ XX,XXX.XX
   5130  Packaging Materials Consumed               ₹ XX,XXX.XX
   5140  Kitchen Direct Labour / Chef Wages         ₹ XX,XXX.XX
   Less: 5190  Purchase Discounts Received         (₹ XX,XXX.XX)
   ──────────────────────────────────────────────────────────────
   TOTAL COST OF GOODS SOLD                        ₹ XX,XXX.XX

   ════════════════════════════════════════════════════════════════
   GROSS PROFIT = NET OPERATING REVENUE – TOTAL COGS ₹ XX,XXX.XX
   ════════════════════════════════════════════════════════════════

III. OPERATING EXPENSES
   5210  Store & Kitchen Rent                       ₹ XX,XXX.XX
   5220  Electricity, Gas & Utilities               ₹ XX,XXX.XX
   5230  Vehicle Fuel & Fleet Maintenance           ₹ XX,XXX.XX
   5240  Freight & Cartage Inward                   ₹ XX,XXX.XX
   5250  Staff Salaries & Store Personnel           ₹ XX,XXX.XX
   5260  Marketing & Customer Promotion             ₹ XX,XXX.XX
   5270  Repairs & Kitchen Maintenance              ₹ XX,XXX.XX
   5280  Software, Internet & Tech Infrastructure   ₹ XX,XXX.XX
   5290  Payment Gateway MDR Fees                   ₹ XX,XXX.XX
   5295  Cash Rounding / Variance                   ₹ XX,XXX.XX
   5299  Miscellaneous Operating Expenses           ₹ XX,XXX.XX
   ──────────────────────────────────────────────────────────────
   TOTAL OPERATING EXPENSES                        ₹ XX,XXX.XX

   ════════════════════════════════════════════════════════════════
   OPERATING PROFIT (EBIT) = GROSS PROFIT – OPEX   ₹ XX,XXX.XX
   ════════════════════════════════════════════════════════════════

IV. OTHER INCOME
   4210  Interest Income                            ₹ XX,XXX.XX
   4220  Scrap & By-product Sales                   ₹ XX,XXX.XX
   ──────────────────────────────────────────────────────────────
   TOTAL OTHER INCOME                              ₹ XX,XXX.XX

V. FINANCIAL & DEPRECIATION EXPENSES
   5310  Bank Charges & Processing Fees             ₹ XX,XXX.XX
   5320  Loan Interest Expense                      ₹ XX,XXX.XX
   5330  Depreciation & Amortization                ₹ XX,XXX.XX
   ──────────────────────────────────────────────────────────────
   TOTAL FINANCIAL EXPENSES                        ₹ XX,XXX.XX

   ════════════════════════════════════════════════════════════════
   NET PROFIT BEFORE TAX = EBIT + OTHER INCOME – FIN. EXPENSES
                                                    ₹ XX,XXX.XX
   ════════════════════════════════════════════════════════════════
```

### 2.2. Design Decisions

| Decision | Resolution | Rationale |
|----------|-----------|-----------|
| **Revenue sign convention** | Credit balances presented as positive amounts | REVENUE normal balance is CREDIT. `net_balance = debit − credit`. A credit-heavy (earned) revenue will have negative `net_balance`. P&L negates this for display. |
| **Expense sign convention** | Debit balances presented as positive amounts | EXPENSE normal balance is DEBIT. Positive `net_balance = debit − credit`. Displayed as-is. |
| **Sales returns treatment** | Contra-revenue line under Gross Revenue, deducted to produce Net Revenue | Account 4190 is `REVENUE` type but represents a deduction. Its natural credit balance will be negative (debit-heavy when returns exist). Displayed as a deduction. |
| **Purchase discounts treatment** | Contra-expense line under COGS, deducted from total COGS | Account 5190 is `EXPENSE/COGS` type but represents a credit-side reduction. Displayed as a deduction within COGS section. |
| **COGS treatment** | Subtype `COGS` filter on `accounting_account` | Accounts with `subtype = 'COGS'` under group 5100. |
| **Operating expenses** | Subtype `OPERATING_EXPENSE` filter, code range 5200+ | Accounts under group 5200 with `subtype = 'OPERATING_EXPENSE'`. |
| **Financial expenses** | Subtype `FINANCIAL_EXPENSE` filter | Accounts under group 5300 with `subtype = 'FINANCIAL_EXPENSE'`. Note: 5330 has subtype `OPERATING_EXPENSE` but parent 5300 is `FINANCIAL_EXPENSE`. **Use parent_id grouping, not subtype alone.** |
| **Other income** | Subtype `INDIRECT_REVENUE` filter | Accounts under group 4200. |
| **Gross profit** | Computed: Net Revenue − COGS | Not stored. Derived at report time. |
| **Operating profit (EBIT)** | Computed: Gross Profit − Operating Expenses | Not stored. Derived at report time. |
| **Net profit before tax** | Computed: EBIT + Other Income − Financial Expenses | Not stored. Derived at report time. |
| **Tax treatment** | NOT included in P&L | GST is a balance sheet item (Input Tax 1141-1149 vs Output Tax 2121-2129). Income tax provision does not exist in CoA. This is correct for an SME bakery. |
| **Opening balance interaction** | Excluded from P&L | Opening balances are Balance Sheet items (ASSET/LIABILITY/EQUITY). P&L only includes REVENUE and EXPENSE type accounts. OB vouchers posting to Revenue/Expense accounts would be period-specific and naturally included via the date filter. |
| **Reversed journals** | Included (compensating entries net to zero) | No special filtering needed. |
| **Draft/submitted vouchers** | Excluded | Only POSTED journal entries have corresponding `accounting_journal_line` rows. The repository query joins `journal_line → journal_entry` which only exists for posted vouchers. |
| **Comparative periods** | Supported via API contract | Caller can issue two requests with different date ranges. The API returns one period per call. No built-in dual-column rendering in the service. UI can render side-by-side. |
| **Zero-balance presentation** | Include all active accounts in structure; show ₹0.00 for zero-activity accounts | Ensures consistent report layout regardless of activity. Group totals remain correct. |
| **Rounding** | `Math.round(x * 100) / 100` (paise precision) | Matches Trial Balance rounding convention. |
| **Reconciliation to Trial Balance** | P&L Net Profit MUST equal `Σ(Revenue credits − Revenue debits) − Σ(Expense debits − Expense credits)` from TB | This is the fundamental reconciliation check. The UI should display this cross-check. |

### 2.3. Account Classification Logic (Section Assignment)

The P&L service should use `parent_id` grouping for section assignment, not just `subtype`, because 5330 (Depreciation) has `subtype = 'OPERATING_EXPENSE'` but belongs under the Financial & Depreciation group (5300).

```
Section assignment by parent group code:
- 4100 children → I. Operating Revenue
- 4200 children → IV. Other Income
- 5100 children → II. Cost of Goods Sold
- 5200 children → III. Operating Expenses
- 5300 children → V. Financial & Depreciation Expenses
```

**Special accounts within sections**:
- 4190 (Sales Returns) → contra-revenue, deducted from Gross Revenue
- 5190 (Purchase Discounts) → contra-expense, deducted from COGS

---

## 3. API Contract

### 3.1. Endpoint

```
GET /api/v1/admin/accounting/profit-loss
```

### 3.2. Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `start_date` / `startDate` | YYYY-MM-DD | ✅ Yes | Period start (inclusive) |
| `end_date` / `endDate` | YYYY-MM-DD | ✅ Yes | Period end (inclusive) |
| `branch_id` / `branchId` | UUID | No | Branch filter. SUPER_ADMIN only. Non-super-admin always scoped to session branch. |

### 3.3. Response Structure

```json
{
  "success": true,
  "period": {
    "start_date": "2024-04-01",
    "end_date": "2025-03-31"
  },
  "branch": {
    "id": "branch-uuid" | null,
    "name": "Branch Name" | "Enterprise (All Branches)"
  },
  "sections": {
    "operating_revenue": {
      "label": "I. Operating Revenue",
      "accounts": [
        { "code": "4110", "name": "Cake & Bakery Sales Revenue", "amount": 0.00 },
        { "code": "4120", "name": "Accessory & Merchandise Sales Revenue", "amount": 0.00 },
        { "code": "4130", "name": "Delivery & Shipping Charges Collected", "amount": 0.00 },
        { "code": "4140", "name": "Customization & Midnight Surcharges", "amount": 0.00 }
      ],
      "gross_revenue": 0.00,
      "returns": {
        "code": "4190",
        "name": "Sales Returns, Refunds & Allowances",
        "amount": 0.00
      },
      "net_revenue": 0.00
    },
    "cost_of_goods_sold": {
      "label": "II. Cost of Goods Sold",
      "accounts": [
        { "code": "5110", "name": "COGS - Cakes", "amount": 0.00 },
        { "code": "5120", "name": "Accessory Merchandise Sold", "amount": 0.00 },
        { "code": "5130", "name": "Packaging Materials Consumed", "amount": 0.00 },
        { "code": "5140", "name": "Kitchen Direct Labour / Chef Wages", "amount": 0.00 }
      ],
      "discounts": {
        "code": "5190",
        "name": "Purchase Discounts Received",
        "amount": 0.00
      },
      "total_cogs": 0.00
    },
    "operating_expenses": {
      "label": "III. Operating Expenses",
      "accounts": [
        { "code": "5210", "name": "Store & Kitchen Rent", "amount": 0.00 },
        ...
      ],
      "total_opex": 0.00
    },
    "other_income": {
      "label": "IV. Other Income",
      "accounts": [
        { "code": "4210", "name": "Interest Income", "amount": 0.00 },
        { "code": "4220", "name": "Scrap & By-product Sales", "amount": 0.00 }
      ],
      "total_other_income": 0.00
    },
    "financial_expenses": {
      "label": "V. Financial & Depreciation Expenses",
      "accounts": [
        { "code": "5310", "name": "Bank Charges & Processing Fees", "amount": 0.00 },
        { "code": "5320", "name": "Loan Interest Expense", "amount": 0.00 },
        { "code": "5330", "name": "Depreciation & Amortization", "amount": 0.00 }
      ],
      "total_financial": 0.00
    }
  },
  "summary": {
    "gross_profit": 0.00,
    "operating_profit": 0.00,
    "net_profit_before_tax": 0.00
  },
  "reconciliation": {
    "tb_revenue_total": 0.00,
    "tb_expense_total": 0.00,
    "tb_derived_profit": 0.00,
    "pnl_net_profit": 0.00,
    "is_reconciled": true,
    "variance": 0.00
  }
}
```

### 3.4. Error Responses

| Code | Condition |
|------|-----------|
| 400 | Missing start_date or end_date; invalid date format |
| 401 | Unauthenticated |
| 403 | Missing ACCOUNTING.VIEW permission |

---

## 4. Permission Model

| Action | Permission Required | Notes |
|--------|-------------------|-------|
| View P&L | `ACCOUNTING.VIEW` | Same as GL and TB |
| Export P&L | `ACCOUNTING.EXPORT` | Already defined; description mentions P&L |
| Branch filter | Session-enforced | Non-super-admin always sees own branch only |
| Enterprise view | SUPER_ADMIN only | Omit branch_id for consolidated view |

---

## 5. Implementation Approach

### 5.1. Service Layer

Create `ProfitLossService` in `frontend/src/lib/services/profit-loss.service.ts`:

1. **Reuse** `AccountingJournalRepository.getTrialBalance(branchId, startDate, endDate)` — same SQL, same parameters.
2. **Filter** the returned `TrialBalanceRow[]` to only `type ∈ ('REVENUE', 'EXPENSE')`.
3. **Resolve parent groups** using `AccountingAccountRepository` to assign each leaf account to its P&L section (by parent_id → parent code 4100/4200/5100/5200/5300).
4. **Compute sign-corrected amounts**: Revenue amounts = `credit − debit` (negate net_balance). Expense amounts = `debit − credit` (use net_balance as-is).
5. **Build the structured response** with sections, subtotals, and computed profit lines.
6. **Compute reconciliation**: compare P&L net profit against `Σ Revenue − Σ Expense` from raw TB data.
7. **No new repository methods** needed. No new SQL queries needed. No database mutations.
8. **No new database tables** needed.

### 5.2. API Layer

Add `GET admin/accounting/profit-loss` to the existing route handler, following the exact pattern of the existing `trial-balance` endpoint.

### 5.3. UI Layer

Add a "Profit & Loss" sub-tab or section within the existing General Ledger panel, or as a separate panel. The UI should:
- Provide date range picker
- Show the structured P&L report
- Display the reconciliation check against TB
- Support branch filter for SUPER_ADMIN

### 5.4. What This Phase Does NOT Do

- ❌ No new database tables or schema changes
- ❌ No new repository methods (reuses getTrialBalance)
- ❌ No mutations of any kind
- ❌ No modification to frozen Phase 5A.1 or 5A.2 code
- ❌ No income tax computation
- ❌ No automated period-end close
- ❌ No retained earnings transfer
- ❌ No balance sheet interaction

---

## 6. PostgreSQL Verification Requirements

The verification suite should confirm:

1. **Zero mutations**: no vouchers, journals, or lines created
2. **CoA unchanged**: 99 accounts, same structure
3. **Reconciliation identity**: P&L net profit ≡ TB REVENUE net − TB EXPENSE net
4. **Zero-balance correctness**: all amounts are ₹0.00 when no journals exist
5. **Section completeness**: all 30 REVENUE + EXPENSE leaf accounts appear in the report
6. **Group exclusion**: group accounts (is_group = true) appear as section headers, not as line items with amounts
7. **Sign convention**: revenue displayed as positive, expenses displayed as positive, profit = revenue − expense
8. **Branch isolation**: non-super-admin cannot see other branches' data
9. **RBAC**: unauthenticated/unauthorized requests return 401/403
10. **Date validation**: missing or invalid dates return 400
11. **No frozen code modified**: Phase 5A.1 and 5A.2 services unchanged
12. **Historical data unchanged**: orders, payments, inventory counts identical pre/post

---

## 7. Sequencing Note

> [!IMPORTANT]
> **5330 Depreciation & Amortization** has `subtype = 'OPERATING_EXPENSE'` but is a child of group 5300 (Financial & Depreciation Expenses). The implementation MUST use `parent_id` grouping (child → parent code) to assign this account to the Financial section, not the Operating Expenses section. Relying solely on `subtype` would misclassify this account.

> [!NOTE]
> P&L is a **read-only derived report** from the authoritative GL. It does not create, modify, or infer any financial data. It is structurally equivalent to a filtered, restructured Trial Balance with computed subtotals.

---

## 8. Authorization Gate

**This document is a design gate only. Implementation requires explicit approval.**

Approved scope upon authorization:
1. `ProfitLossService` — read-only, reuses existing TB repository
2. `GET /api/v1/admin/accounting/profit-loss` — single API endpoint
3. UI panel/tab for P&L display
4. Verification suite with reconciliation check
5. Implementation checkpoint

**NOT authorized**:
- Balance Sheet (Phase 5A.4)
- Cash Flow Statement (Phase 5A.5)
- Period-End Close (Phase 5A.6)
- Any modification to frozen 5A.1/5A.2 code

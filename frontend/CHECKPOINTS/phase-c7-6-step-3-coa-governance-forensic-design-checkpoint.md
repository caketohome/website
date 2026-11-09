# PHASE C7.6 STEP 3 — CHART OF ACCOUNTS GOVERNANCE
## FORENSIC & DESIGN LOCK CHECKPOINT

- **Date / Time**: 2026-10-08T21:46:00+05:30
- **Status**: 🔒 **FORENSIC & DESIGN LOCK COMPLETE — ZERO CODE MODIFICATIONS / ZERO MIGRATIONS / ZERO GIT COMMITS / ZERO PUSHES**
- **System**: CakeToHome ERP
- **Phase**: C7.6 — Cost Centre Accounting
- **Step**: Step 3 — Chart of Accounts Governance Forensic & Design Lock

---

### 1. Frozen Baseline Confirmation
- **Phase C7.6 Step 1 (Cost Centre Master)**: ACCEPTED & FROZEN (24/24 tests pass).
- **Phase C7.6 Step 2 (Accounting Repository Cost-Centre Propagation)**: ACCEPTED & FROZEN (17/17 tests pass, 12/12 PG audit pass).
- **Chart of Accounts Invariant**: Exactly 100 accounts in `public.accounting_account`.
- **Trial Balance Invariant**: Strictly balanced at Dr ₹3,380.00 = Cr ₹3,380.00 (diff: ₹0.00).
- **Historical Invariant**: 100% of historical journal lines (10 lines) and vouchers (6 vouchers) have `cost_centre_id IS NULL`. Zero backfill performed or required.
- **Predecessor Milestones**: All regressions passing (C4.1 99/99, C5 40/40, C6.1 51/51, C7.2 32/32, C7.3 55/55, C7.4 62/62, C7.5 60/60).
- **TypeScript Compiler**: 0 errors, 0 warnings (`tsc --noEmit` exit code 0).

---

### 2. Live Chart of Accounts (CoA) Findings
Direct PostgreSQL inspection of `public.accounting_account`:
- **Total Accounts**: Exactly 100 rows.
- **Table Schema**:
  - `id`: text (PK)
  - `code`: varchar(20) (UNIQUE, UNIQUE partial WHERE deleted_at IS NULL)
  - `name`: varchar(255)
  - `type`: varchar (CHECK constraint: `ASSET`, `LIABILITY`, `EQUITY`, `REVENUE`, `EXPENSE`)
  - `subtype`: varchar (CHECK constraint: 23 valid subtypes)
  - `parent_id`: text (FK -> `accounting_account(id)` ON DELETE RESTRICT)
  - `level`: integer (CHECK constraint: `1 <= level <= 5`)
  - `is_group`: boolean (default `false`)
  - `is_system`: boolean (default `false`, all 100 are `true`)
  - `is_active`: boolean (default `true`, all 100 are `true`)
  - `tax_rate`: numeric (nullable)
  - `tax_class`: varchar (nullable)
  - `description`: text (nullable)
  - `metadata`: jsonb (nullable; only 1 account `1118` has metadata: `{"subledger":"DEPOSIT_IN_TRANSIT"}`)
  - `created_by`: text
  - `created_at`, `updated_at`: timestamptz
  - `deleted_at`: timestamptz (all 100 are `NULL`)
- **Key Architectural Discovery**: `company_id` and `branch_id` **DO NOT EXIST** on `public.accounting_account`. The Chart of Accounts is enterprise-wide and company-wide. Branches and companies do not have separate duplicate GL accounts.
- **Group vs Leaf Breakdown**:
  - `is_group = true`: Exactly 24 accounts (Summary hierarchy nodes, non-postable headers).
  - `is_group = false`: Exactly 76 accounts (Operational leaf posting accounts).
  - `is_system = true`: Exactly 100 accounts (All 100 accounts are core system accounts).
  - `is_active = true`: Exactly 100 accounts (0 inactive, 0 deleted).
- **Level Distribution**:
  - Level 1: 5 accounts (Assets `1000`, Liabilities `2000`, Equity `3000`, Revenue `4000`, Expenses `5000`)
  - Level 2: 12 accounts
  - Level 3: 46 accounts
  - Level 4: 37 accounts

---

### 3. Account Taxonomy & Classification Table
The 100 accounts are partitioned strictly into 5 major account classes:

| Class | Series Range | Total | Groups (`is_group=true`) | Leaves (`is_group=false`) | Subtypes Included |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **ASSET** | `1000` – `1590` | 34 | 7 | 27 | `CURRENT_ASSET`, `CASH`, `BANK`, `GATEWAY_CLEARING`, `RECEIVABLE`, `INVENTORY`, `INPUT_TAX`, `FIXED_ASSET` |
| **LIABILITY** | `2000` – `2510` | 24 | 7 | 17 | `CURRENT_LIABILITY`, `PAYABLE`, `OUTPUT_TAX`, `STAFF_PAYABLE`, `CUSTOMER_ADVANCE`, `LONG_TERM_LIABILITY` |
| **EQUITY** | `3000` – `3300` | 8 | 3 | 5 | `CAPITAL`, `RETAINED_EARNINGS`, `OPENING_OFFSET` |
| **REVENUE** | `4000` – `4220` | 10 | 3 | 7 | `DIRECT_REVENUE`, `DELIVERY_REVENUE`, `INDIRECT_REVENUE` |
| **EXPENSE** | `5000` – `5330` | 24 | 4 | 20 | `COGS`, `OPERATING_EXPENSE`, `FINANCIAL_EXPENSE` |
| **TOTAL** | | **100** | **24** | **76** | **23 Distinct Subtypes** |

---

### 4. Accounting Repository Findings (`accounting-account.repository.ts`)
- **Nature of Repository**: **100% READ-ONLY FOR MASTER DATA**.
- **Supported Methods**:
  - `findById(id, client?)`: Single account lookup by PK.
  - `findByCode(code, client?)`: Single account lookup by natural code.
  - `listAccounts(filters, client?)`: Filtered query (`type`, `subtype`, `is_group`, `is_active`, `search`).
  - `validatePostingAccounts(accountIds, client?)`: Atomic batch validation for posting pipelines:
    1. Validates existence (`deleted_at IS NULL`).
    2. Validates account status (`is_active = true`, rejects inactive accounts).
    3. Validates postability (`is_group = false`, throws error preventing direct postings to any of the 24 group accounts).
- **Mutation Methods**: **ZERO**.
  - No `createAccount`, `updateAccount`, `deleteAccount`, `deactivateAccount`, or `reparentAccount`.
- **Governance Finding**: The repository already provides authoritative postability protection against group accounts, but currently has no awareness of dimensional cost-centre policy.

---

### 5. Accounting Types Findings (`src/lib/types/accounting.types.ts`)
- `AccountType` is strongly typed (`"ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE"`).
- `AccountSubtype` is strongly typed (23 discrete union literals matching DB `chk_account_subtype`).
- `AccountingAccountRow` represents the complete DB row.
- `CostCentreRow`, `CostCentreInput`, `CostCentreUpdateInput` exist from Step 1.
- `JournalLineInput` and `VoucherCreateInput` contain optional `cost_centre_id?: string | null` from Step 2.
- **Governance Gap**: There is currently no `CostCentrePolicy` type (`REQUIRED | OPTIONAL | PROHIBITED`) or account governance metadata type in `accounting.types.ts`.

---

### 6. Mutation Path Audit Across Entire Codebase
Forensic search across all `.ts`, `.tsx`, and `.js` files for `accounting_account` mutations:
- `INSERT INTO public.accounting_account`:
  - `migrate_phase4f_step4_10_schema.js` (historic schema setup)
  - `seed_phase4d_chart_of_accounts.js` (historic 100-account seed)
  - `src/lib/services/bank-account.service.ts`: helper `provisionBankGlAccount()` auto-provisions a dedicated leaf bank GL account under `1110` with code `1112-XX` **only** when creating a new bank account if no GL account was explicitly mapped. (Zero rows currently in DB have this, as only `1112` exists).
- `UPDATE public.accounting_account`: **0 occurrences across entire codebase**.
- `DELETE FROM public.accounting_account`: **0 occurrences across entire codebase**.
- `createAccount` / `updateAccount` API routes: **0 routes exist**.
- Account Management UI screens: **0 screens exist**.

---

### 7. Cost-Centre Propagation & Accounting Flow Matrix

| Accounting Flow | Primary Accounts Involved | Cost Centre Currently Available? | Current Enforcement | Governance Gap |
| :--- | :--- | :---: | :---: | :--- |
| **Manual Journal** | Any postable leaf account | ✅ Yes (Step 2) | Nullable / Optional | No validation preventing cost centres on balance sheet accounts (e.g. Cash, Equity, GST). |
| **Expense Posting** | Dr 52xx / Cr 1111, 1112, 1114, 2111, 215x | ❌ No (passes null) | None | Operating expenses (52xx) do not yet propagate cost centres from expense claims. |
| **Purchase Posting** | Dr 113x (Inv), 114x (GST) / Cr 2111 (AP) | ❌ No (passes null) | None | Balance sheet inventory and AP correctly post without CC. |
| **Sales Posting** | Dr 1121, 1122 / Cr 41xx, 212x, COGS 51xx / Inv 113x | ❌ No (passes null) | None | Sales revenue and COGS currently post without CC. |
| **Petty Cash** | Dr 1114, 5299, 114x / Cr 1111, 1112, 1114 | ❌ No (passes null) | None | Petty cash expense claims post without CC. |
| **Customer Receipt** | Dr 1111, 1112, 1113, 5290 / Cr 1121, 1122 | ❌ No (passes null) | None | Balance sheet settlements correctly post without CC; gateway MDR fee (5290) posts without CC. |
| **Purchase Payment** | Dr 2111 (AP) / Cr 1111, 1112 | ❌ No (passes null) | None | Pure balance sheet settlement; CC should remain prohibited. |
| **Bills Payable** | Dr 2111 (AP) / Cr 1111, 1112 | ❌ No (passes null) | None | Pure balance sheet disbursement; CC should remain prohibited. |
| **Bills Receivable** | Dr 1112 (Bank) / Cr 1121 (AR) | ❌ No (passes null) | None | Pure balance sheet collection; CC should remain prohibited. |
| **Branch Cash** | Dr/Cr 1111 (Cash), 1114 (Petty Cash) | ❌ No (passes null) | None | Vault/till transfers; CC should remain prohibited. |
| **Bank Deposit Slip** | Dr 1118, Cr 1111; Dr 1112, Cr 1118 | ❌ No (passes null) | None | Cash in transit clearing; CC should remain prohibited. |
| **Gateway Settlement** | Dr 1112, 5290, 5295 / Cr 1113 | ❌ No (passes null) | None | Clearing settlement; MDR fee (5290) posts without CC. |
| **Period Close** | Closes 4xxx/5xxx to 3220, rolls to 3210 | ❌ No (passes null) | None | Closing entries; Equity accounts correctly post without CC. |
| **Opening Balance** | Offset against 3300 (Equity) | ❌ No (passes null) | None | Equity reserve; CC should remain prohibited. |

---

### 8. Business Semantics of Cost Centres
- **Cost Centre as Responsibility Dimension**:
  - Identifies an operating department or organizational unit (e.g. KITCHEN / PRODUCTION, FLEET / LOGISTICS, MARKETING, STORE OPERATIONS, ADMINISTRATION, HEAD OFFICE / CORPORATE).
  - Used for internal performance measurement, departmental P&L, and expense budget control.
- **Distinction from Other Dimensions**:
  - **Branch**: Physical / operational location (store, kitchen facility) with cash custody, vault, and till.
  - **Company**: Legal entity (`company_id`).
  - **Customer / Supplier**: Counterparties (`customer_id`, `supplier_id`) tracked on AR/AP subledgers.
  - **Account**: Canonical financial classification (Assets, Liabilities, Equity, Revenue, Expense).
- **Semantic Rule**:
  - Operating expenses (5200 series) and direct COGS (5100 series) represent departmental activity and naturally accept cost centre attribution.
  - Balance sheet assets (Cash, Bank, Debtors, Inventory, Taxes, Fixed Assets), liabilities (Creditors, Accruals, Loans), and Equity (Capital, Retained Earnings) represent company-wide or branch-wide financial positions and legal obligations. Attaching an operating responsibility cost centre to a balance sheet balance is semantically invalid.

---

### 9. Posting Requirements & Operational Reality
- **Critical Finding**: If cost centre usage was made globally `REQUIRED` for expense accounts at the repository/database level right now, **all existing automated posting services (ExpensePostingService, PettyCashService, SalesPostingService) would immediately crash** because they do not yet pass cost centres!
- **Invariant**: The global baseline policy for expenses must be `OPTIONAL` (or configurable per posting channel), while `PROHIBITED` can and must be strictly enforced for balance sheet accounts to prevent semantic distortion.

---

### 10. Existing Posted Data Analysis (PostgreSQL Authority)
- Total Journal Lines: **10 lines** (5 journal entries).
- Lines with `cost_centre_id`: **0 (0.0%)**.
- Lines without `cost_centre_id`: **10 (100.0%)**.
- Distinct accounts posted:
  - `1111` Cash in Hand (Cr ₹1,180.00)
  - `1114` Petty Cash - Branches (Cr ₹200.00)
  - `1121` Accounts Receivable (Dr ₹2,000.00)
  - `1143` Input CGST 9.0% (Dr ₹90.00)
  - `1144` Input SGST 9.0% (Dr ₹90.00)
  - `4110` Cake Sales Revenue (Cr ₹2,000.00)
  - `5230` Vehicle Fuel & Fleet Maintenance (Dr ₹1,200.00)
- **Conclusion**: All 10 posted lines are pristine historical entries from previous phases. Zero backfill is required.

---

### 11. Account Creation Governance Question (Evaluated & Resolved)
1. **Is account creation currently required by an existing business workflow?** **NO.**
2. **Is there an account-management UI?** **NO.**
3. **Is there an account-management API?** **NO.**
4. **Can staff create accounts?** **NO.**
5. **Is there an explicit project requirement to add account creation?** **NO.**
6. **Would adding account creation violate the frozen 100-account CoA?** **YES.**
7. **Scope required**: Zero.
8. **Recommendation**: **DO NOT BUILD ANY CHART OF ACCOUNTS CREATION/MANAGEMENT ENGINE IN C7.6**. Maintain strict master data immutability.

---

### 12. Posted Account Immutability Audit
- **Current Protection**:
  - `accounting_journal_line.account_id -> accounting_account.id` has foreign key `ON DELETE RESTRICT`. PostgreSQL will physically reject any `DELETE FROM accounting_account` for used accounts.
  - `bank_account.gl_account_id` and `expense_category.gl_account_id` also have `ON DELETE RESTRICT`.
  - Application layer has zero `UPDATE` or `DELETE` statements on `accounting_account`.
- **Governance Recommendation**:
  - Introduce an explicit application-layer guard in `AccountingAccountRepository` (or domain service) that prevents modifying or deleting any account.
  - When future migrations or steps touch accounts, ensure database triggers enforce immutability if mutating operations are ever added.

---

### 13. Numbering & Code Policy
- Accounts strictly follow standard ERP decimal-group coding:
  - `1xxx`: Assets (Group `1000`, Subgroups `1100`, `1110`, `1120`, `1130`, `1140`, `1500`)
  - `2xxx`: Liabilities (Group `2000`, Subgroups `2100`, `2110`, `2120`, `2140`, `2150`, `2500`)
  - `3xxx`: Equity (Group `3000`, Subgroups `3100`, `3200`)
  - `4xxx`: Revenue (Group `4000`, Subgroups `4100`, `4200`)
  - `5xxx`: Expenses (Group `5000`, Subgroups `5100` COGS, `5200` Opex, `5300` Fin/Deprec)
- No code generation engine is needed because no accounts will be created.

---

### 14. Security / RBAC / SoD Findings
- `ACCOUNTING.VIEW`: Grants read-only access to CoA, journals, vouchers, and ledger.
- `ACCOUNTING.POST`: Grants authority to post approved vouchers to GL.
- `COST_CENTRE.VIEW` and `COST_CENTRE.MANAGE`: Control the cost centre master records.
- **Zero Account Mutation Permissions**: No permissions exist for creating or editing accounts. This must remain unchanged.
- **SoD Safeguard**: Segregation of Duties remains enforced at the voucher level (creator != approver != poster).

---

### 15. Auditability Findings
- `public.audit_log` exists with columns: `id`, `actor_id`, `actor_type`, `action`, `entity`, `entity_id`, `metadata`, `created_at`.
- `public.accounting_voucher` tracks `created_by`, `submitted_by`, `approved_by`, `posted_by`, `cancelled_by`, and respective timestamps.
- Any future governance violation attempts (e.g. attempting to assign a cost centre to a balance sheet account) will fail fast with a rejected transaction and descriptive error log.

---

### 16. Reporting Impact Analysis
- **Trial Balance**: Strictly company-wide and authoritative. Dr = Cr. The Trial Balance is NOT partitioned by cost centre.
- **General Ledger**: Account Ledger is account-wise. Lines now include `cost_centre_code` and `cost_centre_name`.
- **Profit & Loss**: Operating Expenses (52xx) and COGS (51xx) can be filtered or grouped by cost centre for departmental P&L reports in future reporting phases.
- **Balance Sheet**: Strictly legal entity / branch wide. Not affected by cost centres.

---

### 17. Gap Matrix

| Area | Current State | Evidence | Risk | Required in Step 3? | Proposed Minimal Fix | Out of Scope |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| **Account Master Schema** | 100 accounts, no CC policy column | PostgreSQL query | None | ❌ No | Keep schema untouched | Any schema migrations |
| **Account Repository** | Read-only queries + postability check | `accounting-account.repository.ts` | Medium | ❌ No (keep read-only) | Maintain read-only status | CRUD methods |
| **Dimensional Policy** | No policy checking on journal lines | `AccountingJournalRepository` | High (accidental CC on Cash/GST) | ✅ Yes (Design Lock) | Type-safe Account Governance Resolver | Complex policy tables |
| **Balance Sheet CC Usage** | Allowed if passed | Repository inserts line directly | High (distorts BS) | ✅ Yes (Design Lock) | Enforce `PROHIBITED` for Assets, Liab, Equity | Altering existing postings |
| **Expense CC Usage** | Passed as null in auto-services | Service inspection | Low | ✅ Yes (Design Lock) | Set to `OPTIONAL` globally | Modifying auto-services |
| **Account Creation** | Zero UI/API | Codebase search | None | ❌ No | Recommend NOT building | General CoA manager |
| **Historical Data** | 10 lines with CC=NULL | PostgreSQL audit | None | ❌ No | Zero backfill invariant | Any historical updates |

---

### 18. Final Cost-Centre Governance Policy Matrix

| Account Code / Range | Account Classification | Subtypes Included | Cost Centre Policy | Architectural Rationale | Enforcement Point |
| :--- | :--- | :--- | :---: | :--- | :--- |
| **`1000` – `1590`** | **ASSETS** (Current, Cash, Bank, AR, Inventory, Input Tax, PP&E) | `CURRENT_ASSET`, `CASH`, `BANK`, `GATEWAY_CLEARING`, `RECEIVABLE`, `INVENTORY`, `INPUT_TAX`, `FIXED_ASSET` | 🚫 **PROHIBITED** | Balance sheet liquid custody, customer receivables, statutory tax credits, and capital equipment belong to entity/branch, not operating cost centres. | Journal line validation (`AccountingJournalRepository` / Governance Service) |
| **`2000` – `2510`** | **LIABILITIES** (Payables, Output Tax, Advances, Accruals, Loans) | `CURRENT_LIABILITY`, `PAYABLE`, `OUTPUT_TAX`, `STAFF_PAYABLE`, `CUSTOMER_ADVANCE`, `LONG_TERM_LIABILITY` | 🚫 **PROHIBITED** | Trade obligations, statutory tax liabilities, and debt belong to legal entity; not operating expenses. | Journal line validation (`AccountingJournalRepository` / Governance Service) |
| **`3000` – `3300`** | **EQUITY** (Capital, Retained Earnings, Opening Offset) | `CAPITAL`, `RETAINED_EARNINGS`, `OPENING_OFFSET` | 🚫 **PROHIBITED** | Net worth and owner capital. Operating cost centres are semantically invalid. | Journal line validation (`AccountingJournalRepository` / Governance Service) |
| **`4000` – `4220`** | **REVENUE** (Direct, Delivery, Indirect) | `DIRECT_REVENUE`, `DELIVERY_REVENUE`, `INDIRECT_REVENUE` | ⚙️ **OPTIONAL** | Revenue is primarily tracked by `branch_id`. Departmental attribution may optionally be supplied for specific service lines. | Journal line validation |
| **`5100` – `5190`** | **EXPENSES — COGS** (Cakes, Accessories, Packaging, Kitchen Labour) | `COGS` | ⚙️ **OPTIONAL** | Production costs can be attributed to Kitchen/Production department or left company-wide during batch runs. | Journal line validation |
| **`5200` – `5299`** | **EXPENSES — OPEX** (Rent, Fuel, Salaries, Marketing, Utilities, Tech) | `OPERATING_EXPENSE` | ⚙️ **OPTIONAL** | Operational department expenses can be attributed to specific cost centres (Fleet, Marketing, IT, Store) or unallocated. | Journal line validation |
| **`5300` – `5330`** | **EXPENSES — FINANCIAL & DEPRECIATION** (Bank Charges, Interest, Deprec) | `FINANCIAL_EXPENSE`, `OPERATING_EXPENSE` | ⚙️ **OPTIONAL** | Usually corporate / Head Office or unallocated. | Journal line validation |
| **All 24 Groups** | **SUMMARY GROUPS** (`is_group = true`) | Any | 🚫 **PROHIBITED** (Non-Postable) | Groups are summary headers; direct journal postings are already prohibited by `validatePostingAccounts`. | `validatePostingAccounts` |

---

### 19. Exact Implementation Scope for Next Bounded Step
When authorized to proceed with implementation, the bounded scope shall consist of:
1. **Type Definitions**:
   - Add `CostCentrePolicy = "REQUIRED" | "OPTIONAL" | "PROHIBITED"` to `src/lib/types/accounting.types.ts`.
2. **Account Governance Resolver**:
   - Create a deterministic domain utility `AccountGovernanceService` (or method in `AccountingAccountRepository`) that resolves the `CostCentrePolicy` for any account based on its type, subtype, code, and group status.
3. **Repository Line-Level Validation**:
   - In `AccountingJournalRepository.createJournalEntry`, validate journal lines against their account's `CostCentrePolicy`:
     - If `PROHIBITED` and `line.cost_centre_id != null`: throw `AccountingDomainError("COST_CENTRE_PROHIBITED", ...)`.
     - If `REQUIRED` and `line.cost_centre_id == null`: throw `AccountingDomainError("COST_CENTRE_REQUIRED", ...)`.
     - If `OPTIONAL`: allow both `null` and valid cost centre IDs.
4. **Unit & Integration Suite**:
   - Verify that balance sheet lines reject cost centres, while operating expense lines accept them.
   - Verify that all existing automated posting suites continue to pass without regression.

---

### 20. Explicit Exclusions (What Must NOT Be Built)
- ❌ No modifications, deletions, renamings, or recodings of the 100 accounts.
- ❌ No database migrations or schema alterations to `public.accounting_account`.
- ❌ No database policy tables (e.g. `cost_centre_policy` table).
- ❌ No Chart of Accounts management screens or CRUD API routes.
- ❌ No cost allocation engine, percentage rules, or allocation journals.
- ❌ No modifications to automated posting services (Expense, Purchase, Sales, Petty Cash) during this step.
- ❌ No reporting or dashboard modifications.
- ❌ No historical data backfill.
- ❌ No Git commits or pushes.

---

### 21. Independent Verification Baseline
- **PostgreSQL Audit (Step 3 Forensic Run)**:
  - Account count: **100** (Verified ✅)
  - Trial Balance: **Dr ₹3,380.00 = Cr ₹3,380.00** (diff: ₹0.00) (Verified ✅)
  - Accounting Vouchers: **6** (Verified ✅)
  - Journal Entries: **4** (Verified ✅)
  - Journal Lines: **10** (Verified ✅)
  - Lines with CC: **0** (Verified ✅)
  - Residual test cost centres: **0** (Verified ✅)
  - Database locks: **0** (Verified ✅)
- **TypeScript Compiler**: `npx tsc --noEmit` exited with **0 errors, 0 warnings** (Exit code 0).
- **Git Status**: Working tree preserved; zero commits, zero pushes.

---

### 22. Recommended Next Step
Present this forensic investigation and design lock report to the user for formal review and acceptance. Once accepted, proceed to bounded implementation of the **Account Governance Resolver & Journal Line Validation**.

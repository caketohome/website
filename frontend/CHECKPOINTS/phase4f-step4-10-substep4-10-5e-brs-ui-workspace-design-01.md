# CakeToHome ERP — Phase 4F Step 4.10 Substep 4.10.5-E Forensic & Architecture Design Gate
## Bank Reconciliation Statement (BRS) UI Workspace Design
### Milestone: `PHASE-4F-STEP-4.10-BANK-DEPOSITS-GATEWAY-SETTLEMENT-IMPLEMENTATION-01`
### Substep: 4.10.5-E — Forensic Inspection, Component Architecture & BRS UI Workspace Design Gate
### Gate Classification: READ-ONLY FORENSIC & ARCHITECTURE DESIGN GATE — IMPLEMENTATION NOT AUTHORIZED

---

## 1. Executive Summary & Authorization Context

This document establishes the formal **Forensic & Architecture Design Gate** for **Phase 4F Step 4.10 Substep 4.10.5-E: Bank Reconciliation Statement (BRS) UI Workspace**.

### Governance Invariants Upheld During This Design Gate:
- **Zero implementation code was written or modified during this gate.**
- **Zero database DDL, schema migrations, or table drops were executed.**
- **Zero production or historical financial data was mutated.**
- **Zero accounting vouchers, journal entries, or temporary accounts were created.**
- **Zero test fixtures or synthetic transactions were persisted.**
- **Zero Git commits, pushes, or resets were made.**
- **Substep 4.10.5-E implementation remains strictly NOT STARTED pending explicit user authorization.**

### Evolutionary Lineage & Foundation:
1. **Substep 4.10.5-A (LOCKED 🔒)**: Core schema foundation (`bank_statement_import`, `bank_statement_line`, `bank_reconciliation_session`, `bank_reconciliation_match`).
2. **Substep 4.10.5-B (LOCKED 🔒)**: Statement import service, cryptographic deduplication, pluggable parsers.
3. **Substep 4.10.5-C (LOCKED 🔒)**: Automated matching engine & Stage-2 transit clearance (`Dr 1112 / Cr 1118`).
4. **Substep 4.10.5-D-A (LOCKED 🔒)**: Read-only BRS calculation engine (`BankReconciliationStatementService`) & repository.
5. **Substep 4.10.5-D-B (LOCKED 🔒)**: Authoritative REST API (6 GET endpoints with RBAC, BOLA, and date cutoff controls).
6. **Substep 4.10.5-E (TARGET 🎯)**: Enterprise UI Dashboard Panel providing visual BRS reconciliation, discrepancy analysis, itemized schedules, and session review.

---

## 2. Forensic Inspection of Admin Dashboard Surface

Inspection of the CakeToHome administrative dashboard revealed the canonical integration patterns established in previous milestones (such as `gateway_settlements` in Substep 4.10.4):

### 2.1 Tab Navigation & Registration Topology
To seamlessly integrate the BRS UI Workspace into CakeToHome ERP without breaking backward compatibility, four touchpoints are required:

1. **Staff Access Control (`frontend/src/lib/staff-access-control.ts`)**:
   - `TAB_PERMISSION_MAP.bank_reconciliation`: `{ module: "BANK", action: "RECON_VIEW" }`
   - Governs visibility in `StaffAccessControl.isTabPermitted(user, "bank_reconciliation")`.
2. **Admin Tabs Bar (`frontend/src/components/dashboard/admin/admin-tabs.tsx`)**:
   - Registered under `TABS` array: `{ id: "bank_reconciliation", label: "Bank Reconciliation", icon: Landmark }`.
   - Responsive dropdown select for `< lg` viewports; horizontally scrollable tab list for `>= lg` viewports.
3. **Admin Sidebar (`frontend/src/components/admin/AdminSidebar.tsx`)**:
   - Registered under `NAV_GROUPS` under `"finance"` (Finance & Treasury):
     `{ id: "bank_reconciliation", label: "Bank Reconciliation (BRS)", icon: Landmark, tabId: "bank_reconciliation" }`.
4. **Dashboard Panel Loader (`frontend/src/app/dashboard/page.tsx`)**:
   - Lazy dynamic loader: `createDynamicPanel(() => import("@frontend/components/dashboard/admin/bank-reconciliation-panel"), "BankReconciliationPanel")`.
   - Registered in `AdminTabId` union and `PANEL_MAP.bank_reconciliation`.

### 2.2 Visual Standards & Theme System
The BRS UI Workspace must adhere to CakeToHome ERP's design language:
- **Primary Navy**: `#1D2F5D` (headers, primary action buttons, active tab indicators).
- **Gold Accent**: `#D4AF37` (active underline borders, status highlights).
- **Surface Palette**: Slate neutrals (`bg-slate-50 dark:bg-slate-950`, `bg-white dark:bg-slate-900`, `border-slate-200 dark:border-slate-800`).
- **Typography & Formatting**: Clean tabular numeric font alignment (`font-mono`, `text-right` for monetary values). Currency formatted in Indian Rupees (`₹`, formatted from integer paise: `(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })`).
- **Icons**: Lucide React (`Landmark`, `Receipt`, `Calendar`, `CheckCircle2`, `AlertTriangle`, `Clock`, `ArrowUpRight`, `ArrowDownLeft`, `Search`, `RefreshCw`, `FileText`, `Layers`, `ShieldCheck`).

---

## 3. BRS UI Workspace Component Architecture

The BRS UI Workspace will be implemented as a modular component:
`frontend/src/components/dashboard/admin/bank-reconciliation-panel.tsx`

### 3.1 Architectural Layout Hierarchy

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ BANK RECONCILIATION STATEMENT (BRS) WORKSPACE                                    │
│ [ Landmark ] Bank Master & General Ledger (GL 1112/1113) ↔ Statement Reconciler   │
├──────────────────────────────────────────────────────────────────────────────────┤
│ CONTROL BAR & CONTEXT SELECTOR                                                   │
│ [ Bank Account Selector ]  [ Cutoff Date Picker (YYYY-MM-DD) ]  [ Session Picker ]│
│ [ Branch Indicator / Badge ]                            [ Refresh Button 🔄 ]     │
├──────────────────────────────────────────────────────────────────────────────────┤
│ EXECUTIVE RECONCILIATION SUMMARY CARD                                            │
│ ┌─────────────────────────┬─────────────────────────┬──────────────────────────┐ │
│ │ GL Book Balance (1112)  │ Computed Bank Balance   │ Statement Closing Balance│ │
│ │ ₹ 1,45,250.00           │ ₹ 1,82,750.00           │ ₹ 1,82,750.00            │ │
│ ├─────────────────────────┴─────────────────────────┴──────────────────────────┤ │
│ │ RECONCILIATION STATUS: [ BALANCED (₹0.00 DISCREPANCY) ]                      │ │
│ └──────────────────────────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────────────┤
│ MATHEMATICAL RECONCILIATION BRIDGE (FORMULA BREAKDOWN)                           │
│   General Ledger Book Balance:                                    ₹ 1,45,250.00 │
│   (+) Unmatched Bank Statement Credits (Direct Collections):     + ₹   8,500.00 │
│   (-) Unmatched Bank Statement Debits (Bank Charges / Tax):      - ₹   1,200.00 │
│   ─────────────────────────────────────────────────────────────────────────────  │
│   (=) Adjusted Book Balance:                                      ₹ 1,52,550.00 │
│   (+) Outstanding Disbursements (Issued Cheques / Unpresented):  + ₹  45,200.00 │
│   (-) Uncleared Deposits (In-Transit Cash / Slips):              - ₹  15,000.00 │
│   ─────────────────────────────────────────────────────────────────────────────  │
│   (=) Computed Bank Balance:                                      ₹ 1,82,750.00 │
│   Bank Statement Closing Balance:                                 ₹ 1,82,750.00 │
│   ─────────────────────────────────────────────────────────────────────────────  │
│   Net Discrepancy Vector (Δ):                                     ₹        0.00 │
├──────────────────────────────────────────────────────────────────────────────────┤
│ ITEMIZED SCHEDULES & WORKSPACE TABS                                              │
│ [ Uncleared Deposits (12) ] [ Outstanding Disbursements (8) ]                    │
│ [ Unmatched Statement Lines (4) ] [ Reconciliation Sessions History ]            │
├──────────────────────────────────────────────────────────────────────────────────┤
│ TAB CONTENT AREA (Paginated Data Grid with Search, Filters, Limit/Offset)        │
│ • Column Sort, Ref/UTR search, Amount formatting, Status badges                  │
│ • Pagination Footer: [ Prev ] [ Page 1 of 5 ] [ Next ] [ Page Size: 25/50/100 ] │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Component Sub-Modules & Data Contracts

### 4.1 Sub-Module 1: Account & Cutoff Context Header
- **Bank Account Selector**:
  - Consumes `GET /api/v1/admin/bank-accounts?status=ACTIVE`.
  - Displays: Bank Name, Masked Account Number (`•••• 4521`), Branch Name, and GL Code (`1112`).
  - Auto-selects primary bank account if none selected.
- **As-Of Date Selector**:
  - HTML5 `<input type="date">` enforcing `YYYY-MM-DD` string values.
  - Defaults to current system date (or session end date if session selected).
  - Triggers calculation recalculation upon selection change.
- **Session Filter**:
  - Consumes `GET /api/v1/admin/bank-reconciliation/sessions?bank_account_id={selectedId}`.
  - Option to view specific session or ad-hoc date cutoff.

### 4.2 Sub-Module 2: Executive BRS KPI & Equation Card
- **Endpoint**: `GET /api/v1/admin/bank-reconciliation/statements/calculate?bank_account_id=...&as_of_date=...`
- **Reconciliation Bridge Breakdown**:
  1. **Book Balance ($B_{\text{GL}}$)**: GL Account 1112/1113 balance derived from authoritative double-entry journal entries.
  2. **Unmatched Statement Credits ($U_{\text{credit}}$)**: Bank deposits/credits not yet matched against internal accounting records.
  3. **Unmatched Statement Debits ($U_{\text{debit}}$)**: Bank charges, auto-debits, or withdrawals not yet recorded in GL.
  4. **Adjusted Book Balance ($B_{\text{adjusted}}$)**: $B_{\text{GL}} + U_{\text{credit}} - U_{\text{debit}}$.
  5. **Outstanding Disbursements ($P_{\text{outstanding}}$)**: Cheques or payment vouchers credited in GL but not yet debited by the bank.
  6. **Uncleared Deposits ($D_{\text{transit}}$)**: Cash deposit slips or receipts debited to transit GL but not yet credited by bank statement.
  7. **Computed Bank Balance ($B_{\text{computed}}$)**: $B_{\text{adjusted}} + P_{\text{outstanding}} - D_{\text{transit}}$.
  8. **Statement Balance ($B_{\text{statement}}$)**: Authoritative statement closing balance.
  9. **Discrepancy Vector ($\Delta$)**: $B_{\text{computed}} - B_{\text{statement}}$.
- **Visual Alert States**:
  - $\Delta = 0$: **Fully Reconciled** (`bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300`).
  - $\Delta \neq 0$: **Discrepancy Detected** (`bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300`). Highlights whether book or bank is higher and indicates unresolved items.

### 4.3 Sub-Module 3: Itemized Schedules Workspace
The tabbed data workspace lets finance officers audit the detailed composition of each reconciliation element:

#### Tab A: Uncleared Deposits ($D_{\text{transit}}$)
- **Endpoint**: `GET /api/v1/admin/bank-reconciliation/statements/uncleared-deposits`
- **Columns**:
  - Deposit Slip Number (`slip_number`)
  - Slip Date (`slip_date`)
  - Bank Account
  - Cashier / Prepared By
  - Amount (₹)
  - Days in Transit (calculated from slip date to cutoff date)
  - Status Badge (`IN_TRANSIT`, `PENDING_APPROVAL`)

#### Tab B: Outstanding Disbursements ($P_{\text{outstanding}}$)
- **Endpoint**: `GET /api/v1/admin/bank-reconciliation/statements/outstanding-disbursements`
- **Columns**:
  - Voucher Number (`voucher_no`)
  - Voucher Date (`voucher_date`)
  - Payee / Supplier Name
  - Cheque / Reference Number
  - Amount (₹)
  - Aging (Days Outstanding)
  - Status (`POSTED`, `APPROVED`)

#### Tab C: Unmatched Statement Lines ($U$)
- **Endpoint**: `GET /api/v1/admin/bank-reconciliation/statements/unmatched-lines`
- **Controls**: Filter pill buttons: `ALL`, `DEBITS ONLY` (bank charges/fees), `CREDITS ONLY` (unidentified receipts).
- **Columns**:
  - Transaction Date (`transaction_date`)
  - Value Date (`value_date`)
  - Narration / Description
  - Cheque / UTR Reference
  - Debit Amount (₹)
  - Credit Amount (₹)
  - Statement Import Batch

#### Tab D: Reconciliation Sessions Register
- **Endpoint**: `GET /api/v1/admin/bank-reconciliation/sessions`
- **Columns**:
  - Session Code / ID
  - Period Range (`period_start` → `period_end`)
  - Opening Statement Balance (₹)
  - Closing Statement Balance (₹)
  - Status (`DRAFT`, `IN_PROGRESS`, `COMPLETED`, `ABANDONED`)
  - Closed By / Reconciled By
  - Completed At timestamp
- **Action**: View Session Detail Modal (calling `GET /api/v1/admin/bank-reconciliation/sessions/:id`).

---

## 5. Security, RBAC & Multi-Tenant Isolation

1. **Client-Side Authorization Check**:
   - Component checks permissions via `StaffAccessControl.hasPermission(user, "BANK", "RECON_VIEW")` or fallback to `ACCOUNTING.VIEW`.
   - If user lacks permission: renders access denied card with lock icon and helpful instructions.
2. **Server-Authoritative Branch Scoping**:
   - Headquarters / Super Admin: Can view all bank accounts across all branches or filter by branch.
   - Branch Managers: Can only see bank accounts assigned to their authorized branch (enforced server-side in all API endpoints).
   - Zero client-supplied branch or accounting authority.
3. **Data Integrity & Immutability**:
   - BRS UI Workspace is strictly **read-only and analytical**.
   - No voucher creation, no manual GL overrides, no direct journal entries.
   - All financial numbers reflect server-side integer-paise calculations.

---

## 6. Implementation Plan & File Touchpoints

Upon explicit user authorization, the bounded implementation will execute as follows:

1. **Create Panel Component**:
   - `frontend/src/components/dashboard/admin/bank-reconciliation-panel.tsx`
2. **Register Admin Tab & Navigation**:
   - `frontend/src/lib/staff-access-control.ts`: Map `bank_reconciliation` in `TAB_PERMISSION_MAP`.
   - `frontend/src/components/dashboard/admin/admin-tabs.tsx`: Add tab definition under `TABS`.
   - `frontend/src/components/admin/AdminSidebar.tsx`: Add navigation link under `finance` group.
   - `frontend/src/app/dashboard/page.tsx`: Import and bind `BankReconciliationPanel` in `PANEL_MAP`.
3. **Automated Verification Chain**:
   - TypeScript compilation check (`npx tsc --noEmit`): 0 errors.
   - Security regression suite (`scratch/run_security_regression.js`): 21/21 PASS.
   - Independent PostgreSQL baseline audit: 0 mutations, 0 locks.
   - Process control check: 0 leaked background tasks or database sessions.

---

## 7. Gate Status & Conclusion

**Forensic & Architecture Design Gate 4.10.5-E is COMPLETE 📋.**  
Zero code has been modified. The architecture, layouts, data contracts, and security boundaries are fully specified.

**Awaiting explicit user authorization to proceed with bounded implementation of Substep 4.10.5-E.**

# Phase 4F Step 4.10 Substep 4.10.5-D-B: Bank Reconciliation Statement (BRS) REST API Endpoints — Forensic & Design Gate

**Timestamp**: 2026-09-29T18:45:00+05:30  
**Phase**: Phase 4F (Double-Entry Financial Accounting System)  
**Step**: Step 4.10 Substep 4.10.5-D-B (BRS REST API Endpoints)  
**Status**: **FORENSIC & DESIGN GATE COMPLETE — AWAITING IMPLEMENTATION AUTHORIZATION** 📋  
**Preceding Step**: Step 4.10.5-D-A (BRS Calculation Engine & Read-Only Repository) — **ACCEPTED & FROZEN** 🔒  
**Scope Mode**: Strictly Read-Only Architecture Design (Zero Code Implementation until Explicit Authorization)  
**Git Safety**: Zero commits, zero pushes, zero resets, zero reverts, zero cleans. Working tree preserved.

---

## 1. Executive Summary & Forensic Context

Step 4.10.5-D-A implemented the core read-only BRS calculation engine (`BankReconciliationStatementService`) and corresponding repository queries (`BankReconciliationRepository`). The implementation completed with 83/83 passing tests, full backward compatibility across all prior steps (4.10.2 through 4.10.5-C), and zero mutations to the pristine PostgreSQL ledger.

The next evolutionary boundary is **Step 4.10.5-D-B: BRS REST API Endpoints**. This step translates the underlying domain calculations into secure, multi-tenant HTTP REST endpoints mounted on the Next.js API router (`src/app/api/v1/[...path]/route.ts`).

Per system protocols, this document completes the mandatory read-only Forensic & Design Gate covering the twelve canonical domains:
1. API contracts and response schemas
2. Session lifecycle endpoints
3. BRS calculation endpoint
4. Pagination semantics
5. Authentication and RBAC
6. Branch and enterprise isolation
7. BOLA / IDOR protection
8. As-of-date validation
9. Closed-session behavior
10. Error semantics and HTTP mapping
11. Rate and abuse controls
12. Zero-mutation guarantee & API regression strategy

---

## 2. API Contracts & Response Schemas

All endpoints are hosted under the authoritative API router path: `/api/v1/admin/bank-reconciliation/*`.

### Canonical Endpoint Routing Table

| HTTP Method | Route Subpath | Primary Service Method | Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `admin/bank-reconciliation/statements/calculate` | `BankReconciliationStatementService.calculateBrs` | Deterministic BRS balance & discrepancy calculation |
| `GET` | `admin/bank-reconciliation/statements/uncleared-deposits` | `BankReconciliationStatementService.listUnclearedDeposits` | Paginated itemized schedule of transit deposits ($D_{\text{transit}}$) |
| `GET` | `admin/bank-reconciliation/statements/outstanding-disbursements` | `BankReconciliationStatementService.listOutstandingDisbursements` | Paginated itemized schedule of outstanding disbursements ($P_{\text{outstanding}}$) |
| `GET` | `admin/bank-reconciliation/statements/unmatched-lines` | `BankReconciliationStatementService.listUnmatchedStatementLines` | Paginated itemized schedule of unmatched statement lines ($U_{\text{debit}}, U_{\text{credit}}$) |
| `GET` | `admin/bank-reconciliation/sessions` | `BankReconciliationRepository.listSessions` | List reconciliation sessions by bank account, status, and date range |
| `GET` | `admin/bank-reconciliation/sessions/:id` | `BankReconciliationRepository.findSessionById` | Fetch reconciliation session details, balances, and audit metadata |

---

### Detailed Contract Specifications

#### 1. Calculate BRS Endpoint
`GET /api/v1/admin/bank-reconciliation/statements/calculate`

**Query Parameters:**
- `bank_account_id` (string, **required**): UUID / string ID of the target bank account.
- `as_of_date` (string, optional): ISO date format `YYYY-MM-DD`. Defaults to `session.period_end` if `session_id` provided, otherwise current system date (`new Date()`).
- `session_id` (string, optional): UUID / string ID of a specific reconciliation session.

**Response Schema (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "session": {
      "id": "brs_1727616000_abc123",
      "bankAccountId": "ba_01KYWH0RTHVHRD04J79T28RAHN",
      "periodStart": "2026-09-01",
      "periodEnd": "2026-09-15",
      "status": "IN_PROGRESS"
    },
    "bankAccount": {
      "id": "ba_01KYWH0RTHVHRD04J79T28RAHN",
      "bankName": "HDFC Bank",
      "accountNumberMasked": "XXXXXXXX5678",
      "ifscCode": "HDFC0001234",
      "branchId": "br_01KYWH0RTHVHRD04J79T28RAHN"
    },
    "asOfDate": "2026-09-15",
    "summary": {
      "statementClosingBalance": 150000.00,
      "statementClosingBalancePaise": 15000000,
      "gl1112BookBalance": 125000.00,
      "gl1112BookBalancePaise": 12500000,
      "gl1118TransitBalance": 30000.00,
      "gl1118TransitBalancePaise": 3000000,
      "totalBookBalance": 155000.00,
      "totalBookBalancePaise": 15500000,
      "totalDepositsInTransit": 30000.00,
      "totalDepositsInTransitPaise": 3000000,
      "totalOutstandingDisbursements": 5000.00,
      "totalOutstandingDisbursementsPaise": 500000,
      "totalUnmatchedBankDebits": 0.00,
      "totalUnmatchedBankDebitsPaise": 0,
      "totalUnmatchedBankCredits": 0.00,
      "totalUnmatchedBankCreditsPaise": 0,
      "reconciledBookBalance": 125000.00,
      "reconciledBookBalancePaise": 12500000,
      "discrepancy": 0.00,
      "discrepancyPaise": 0,
      "isReconciled": true
    },
    "breakdownCounts": {
      "depositsInTransitCount": 2,
      "outstandingDisbursementsCount": 1,
      "unmatchedBankDebitsCount": 0,
      "unmatchedBankCreditsCount": 0
    },
    "calculatedAt": "2026-09-29T18:30:00.000Z"
  }
}
```

---

#### 2. Uncleared Deposits Schedule Endpoint
`GET /api/v1/admin/bank-reconciliation/statements/uncleared-deposits`

**Query Parameters:**
- `bank_account_id` (string, **required**)
- `as_of_date` (string, optional, `YYYY-MM-DD`)
- `limit` (integer, optional, default: 50, min: 1, max: 200)
- `offset` (integer, optional, default: 0, min: 0)

**Response Schema (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "bds_1727616000_dep1",
        "slipNumber": "DS-2026-0001",
        "depositDate": "2026-09-14",
        "amount": 15000.00,
        "branchId": "br_01KYWH0RTHVHRD04J79T28RAHN",
        "bankAccountId": "ba_01KYWH0RTHVHRD04J79T28RAHN",
        "status": "APPROVED",
        "transitVoucherId": "vch_01...",
        "creditVoucherId": null
      }
    ],
    "totalCount": 1,
    "totalAmount": 15000.00,
    "limit": 50,
    "offset": 0
  }
}
```

---

#### 3. Outstanding Disbursements Schedule Endpoint
`GET /api/v1/admin/bank-reconciliation/statements/outstanding-disbursements`

**Query Parameters:**
- `bank_account_id` (string, **required**)
- `as_of_date` (string, optional, `YYYY-MM-DD`)
- `limit` (integer, optional, default: 50, min: 1, max: 200)
- `offset` (integer, optional, default: 0, min: 0)

**Response Schema (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "voucherId": "vch_1727616000_disb1",
        "voucherNo": "VCH-2026-0099",
        "voucherDate": "2026-09-12",
        "voucherType": "PAYMENT",
        "referenceType": "PURCHASE_PAYMENT",
        "referenceId": "pp_1727616000_01",
        "branchId": "br_01KYWH0RTHVHRD04J79T28RAHN",
        "amount": 5000.00,
        "narration": "Vendor payment via NEFT"
      }
    ],
    "totalCount": 1,
    "totalAmount": 5000.00,
    "limit": 50,
    "offset": 0
  }
}
```

---

#### 4. Unmatched Statement Lines Schedule Endpoint
`GET /api/v1/admin/bank-reconciliation/statements/unmatched-lines`

**Query Parameters:**
- `bank_account_id` (string, **required**)
- `as_of_date` (string, optional, `YYYY-MM-DD`)
- `type` (string, optional, enum: `"ALL"`, `"DEBIT"`, `"CREDIT"`, default: `"ALL"`)
- `limit` (integer, optional, default: 50, min: 1, max: 200)
- `offset` (integer, optional, default: 0, min: 0)

**Response Schema (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "bsl_1727616000_line1",
        "importId": "bsi_1727616000_imp1",
        "lineNumber": 1,
        "transactionDate": "2026-09-15",
        "valueDate": "2026-09-15",
        "effectiveDate": "2026-09-15",
        "description": "BANK CHARGES ANNUAL FEE",
        "bankReference": "REF-CHG-102",
        "debitAmount": 150.00,
        "creditAmount": 0.00,
        "runningBalance": 149850.00,
        "reconciliationStatus": "UNMATCHED"
      }
    ],
    "totalCount": 1,
    "totalDebitAmount": 150.00,
    "totalCreditAmount": 0.00,
    "limit": 50,
    "offset": 0
  }
}
```

---

#### 5. Sessions Listing Endpoint
`GET /api/v1/admin/bank-reconciliation/sessions`

**Query Parameters:**
- `bank_account_id` (string, optional)
- `status` (string, optional, enum: `"DRAFT"`, `"IN_PROGRESS"`, `"REVIEWED"`, `"APPROVED"`, `"CLOSED"`)
- `start_date` (string, optional, `YYYY-MM-DD`)
- `end_date` (string, optional, `YYYY-MM-DD`)
- `limit` (integer, optional, default: 50, min: 1, max: 200)
- `offset` (integer, optional, default: 0, min: 0)

**Response Schema (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "id": "brs_1727616000_abc123",
        "bankAccountId": "ba_01KYWH0RTHVHRD04J79T28RAHN",
        "companyId": "company_default",
        "periodStart": "2026-09-01",
        "periodEnd": "2026-09-30",
        "openingBalancePerBank": 50000.00,
        "closingBalancePerBank": 75000.00,
        "status": "APPROVED",
        "preparedBy": "usr_preparer",
        "reviewedBy": "usr_reviewer",
        "approvedBy": "usr_approver",
        "metadata": {},
        "createdAt": "2026-09-01T00:00:00.000Z",
        "updatedAt": "2026-09-30T18:00:00.000Z"
      }
    ],
    "totalCount": 1,
    "limit": 50,
    "offset": 0
  }
}
```

---

#### 6. Session Detail Endpoint
`GET /api/v1/admin/bank-reconciliation/sessions/:id`

**Path Parameters:**
- `id`: Session UUID / identifier.

**Response Schema (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "session": {
      "id": "brs_1727616000_abc123",
      "bankAccountId": "ba_01KYWH0RTHVHRD04J79T28RAHN",
      "companyId": "company_default",
      "periodStart": "2026-09-01",
      "periodEnd": "2026-09-30",
      "openingBalancePerBank": 50000.00,
      "closingBalancePerBank": 75000.00,
      "status": "APPROVED",
      "preparedBy": "usr_preparer",
      "reviewedBy": "usr_reviewer",
      "approvedBy": "usr_approver",
      "metadata": {},
      "createdAt": "2026-09-01T00:00:00.000Z",
      "updatedAt": "2026-09-30T18:00:00.000Z"
    },
    "bankAccount": {
      "id": "ba_01KYWH0RTHVHRD04J79T28RAHN",
      "bankName": "HDFC Bank",
      "accountNumberMasked": "XXXXXXXX5678",
      "ifscCode": "HDFC0001234",
      "branchId": "br_01KYWH0RTHVHRD04J79T28RAHN"
    }
  }
}
```

---

## 3. Session Lifecycle Endpoints & Segregation of Responsibilities

### Read-Only Scope of Step 4.10.5-D-B
Step 4.10.5-D-B is strictly scoped to **read-only retrieval** of reconciliation sessions and BRS statements.
- Session discovery (`GET /sessions`) and session inspection (`GET /sessions/:id`) are fully implemented in Step 4.10.5-D-B.
- State mutation actions (Session creation, review transition, approval transition) belong to session management operations and are **not** mixed into reporting calculations.
- If session mutations (e.g. `POST /admin/bank-reconciliation/sessions`, `POST /admin/bank-reconciliation/sessions/:id/review`, `POST /admin/bank-reconciliation/sessions/:id/approve`) are authorized in a subsequent substep:
  1. They must strictly enforce database-level Segregation of Duties (SoD) constraints:
     - Preparer $\neq$ Reviewer
     - Preparer $\neq$ Approver
     - Reviewer $\neq$ Approver
     - `chk_brs_sod_preparer_reviewer`: `prepared_by <> reviewed_by`
     - `chk_brs_sod_preparer_approver`: `prepared_by <> approved_by`
     - `chk_brs_sod_reviewer_approver`: `reviewed_by <> approved_by`
  2. `SUPER_ADMIN` cannot self-approve or bypass SoD constraints.
  3. They will NOT create financial vouchers or alter journal entries (which remains exclusively owned by Step 4.10.5-C).

---

## 4. BRS Calculation Endpoint Architecture

The calculation endpoint (`GET /api/v1/admin/bank-reconciliation/statements/calculate`) encapsulates the core mathematical reconciliation engine:

$$R_{\text{paise}} = B_{\text{bank}} + D_{\text{transit}} - P_{\text{outstanding}} + U_{\text{debit}} - U_{\text{credit}}$$
$$\Delta_{\text{paise}} = R_{\text{paise}} - B_{\text{gl}}$$

### Calculation Steps within Route Handler
1. **Context Resolution**: Derive `userCtx` from `resolveUserContext(req)`.
2. **Permission Guard**: Verify caller has `BANK.RECON_VIEW` (or `ACCOUNTING.VIEW`).
3. **Parameter Extraction**:
   - `bankAccountId = url.searchParams.get("bank_account_id")`
   - `asOfDate = url.searchParams.get("as_of_date")`
   - `sessionId = url.searchParams.get("session_id")`
4. **Validation**:
   - Ensure `bankAccountId` is non-empty.
   - If `asOfDate` is supplied, validate regex `/^\d{4}-\d{2}-\d{2}$/` and date parseability.
5. **Execution**:
   Invoke `BankReconciliationStatementService.calculateBrs({ bankAccountId, asOfDate, sessionId, actorContext: userCtx })`.
6. **Response Serialization**: Return HTTP 200 with standard `{ success: true, data: result }` envelope.

---

## 5. Pagination Standards

All list endpoints implement standardized server-side pagination:
- **Default Limit**: 50 items.
- **Maximum Limit**: 200 items (strictly enforced via `Math.min(parsedLimit, 200)`).
- **Minimum Limit**: 1 item (enforced via `Math.max(parsedLimit, 1)`).
- **Default Offset**: 0.
- **Offset Bounds**: Non-negative integer (`Math.max(parsedOffset, 0)`).
- **Total Count Metadata**: Every paginated response returns `totalCount`, `limit`, and `offset` alongside the array of `items`.
- **Monetary Aggregations**: Response payloads include summary aggregates for the entire result set (e.g. `totalAmount`, `totalDebitAmount`, `totalCreditAmount`) computed in integer paise and converted to decimal currency.

---

## 6. Authentication & RBAC

1. **Cryptographic Token Verification**:
   - Every request is resolved via `resolveUserContext(req)` $\to$ `resolveServerSession(req)`.
   - Never trusts raw client headers (`x-user-role`, `x-user-id`, `x-branch-id`).
   - If no valid session is present: immediately returns `HTTP 401 UNAUTHORIZED`.
2. **Role Restrictions**:
   - Customers (`role === "CUSTOMER"`) and Anonymous callers (`role === "ANONYMOUS"`) are strictly rejected with `HTTP 403 FORBIDDEN`.
3. **Permission Check**:
   - Required permission: `BANK.RECON_VIEW` (module: `"BANK"`, action: `"RECON_VIEW"`).
   - Validated against canonical `PERMISSION_CATALOG` in `staff-access-control.ts` (line 211).
   - If user lacks `BANK.RECON_VIEW` and lacks `ACCOUNTING.VIEW`: returns `HTTP 403 FORBIDDEN`.

---

## 7. Branch & Enterprise Isolation

1. **Server-Side Authoritative Derivation**:
   - The bank account's `branch_id` is queried directly from PostgreSQL:
     ```sql
     SELECT id, branch_id, status FROM public.bank_account WHERE id = $1;
     ```
   - Client-provided branch parameters in query strings are NEVER treated as proof of ownership.
2. **Enterprise Bank Accounts (`branch_id IS NULL`)**:
   - Represent corporate treasury accounts (e.g. central payout pool, enterprise merchant bank account).
   - Accessible ONLY to corporate staff / `SUPER_ADMIN`.
   - Branch staff (`userCtx.branchId !== null` and `!userCtx.isSuperAdmin`) are rejected with `HTTP 403 FORBIDDEN` (`"Branch staff cannot access enterprise bank accounts."`).
3. **Branch Bank Accounts (`branch_id IS NOT NULL`)**:
   - Accessible to `SUPER_ADMIN` or staff whose verified `userCtx.branchId === bank_account.branch_id`.
   - If branch staff attempt to access an account owned by a different branch: rejected with `HTTP 403 FORBIDDEN` (`"BRANCH_MISMATCH"`).

---

## 8. BOLA / IDOR Protection

1. **Object-Level Authorization**:
   - All query operations require a valid `bank_account_id`.
   - Ownership is verified against PostgreSQL before retrieving statement lines, deposit slips, vouchers, or sessions.
2. **Cross-Resource Integrity**:
   - When a `session_id` is passed with a `bank_account_id`, the API verifies that `session.bank_account_id === bankAccount.id`.
   - Mismatches are rejected with `HTTP 400 BAD_REQUEST` (`SESSION_ACCOUNT_MISMATCH`).
3. **Fail-Closed Existence Checks**:
   - Querying a non-existent bank account returns `HTTP 404 NOT_FOUND` (`BANK_ACCOUNT_NOT_FOUND`).
   - Querying a non-existent session returns `HTTP 404 NOT_FOUND` (`SESSION_NOT_FOUND`).

---

## 9. As-of-Date Validation & Cutoff Semantics

1. **Format Validation**:
   - Enforces strict `YYYY-MM-DD` format via regular expression: `/^\d{4}-\d{2}-\d{2}$/`.
   - Invalid formats return `HTTP 400 BAD_REQUEST` (`INVALID_DATE_FORMAT`).
2. **Date Range Sanity**:
   - Parsed date must be a valid calendar date (`!isNaN(Date.parse(asOfDate))`).
   - Rejects future dates beyond 1 calendar day from current system date to prevent speculative reporting on non-existent transactions.
3. **Cutoff Semantics**:
   - Bank Statement Lines: $\text{COALESCE}(\text{value\_date}, \text{transaction\_date}) \le \text{as\_of\_date}$.
   - Accounting Vouchers: $\text{voucher\_date} \le \text{as\_of\_date} \text{ AND } \text{status} = \text{'POSTED'}$.
   - Bank Deposit Slips: $\text{deposit\_date} \le \text{as\_of\_date}$.
   - No retroactive adjustments or inference of future transactions.

---

## 10. Closed-Session Behavior

1. **Snapshot Immutability**:
   - When querying BRS for a session in `APPROVED` or `CLOSED` status:
     - The calculation defaults strictly to `session.period_end`.
     - The bank closing balance strictly uses `session.closing_balance_per_bank`.
     - Statements and vouchers dated after `session.period_end` are excluded.
   - Guarantees that historical reconciliation statements produce identical figures across audit periods.

---

## 11. Error Semantics & HTTP Status Codes

Standard JSON error contract:
```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Descriptive message regarding the failure.",
  "status": 400
}
```

### Error Code Mapping Table

| Error Code | HTTP Status | Condition |
| :--- | :---: | :--- |
| `UNAUTHORIZED` | 401 | Missing, malformed, or expired server session token |
| `FORBIDDEN` | 403 | Customer/anonymous caller, missing `BANK.RECON_VIEW`, or cross-branch attempt |
| `BRANCH_MISMATCH` | 403 | Caller branch does not match target bank account branch |
| `BANK_ACCOUNT_REQUIRED` | 400 | Query parameter `bank_account_id` was omitted |
| `INVALID_DATE_FORMAT` | 400 | Query parameter `as_of_date` is not `YYYY-MM-DD` |
| `SESSION_ACCOUNT_MISMATCH` | 400 | Supplied `session_id` belongs to a different bank account |
| `BANK_ACCOUNT_NOT_FOUND` | 404 | Target bank account does not exist in PostgreSQL |
| `SESSION_NOT_FOUND` | 404 | Target reconciliation session does not exist |
| `BRS_CALCULATION_ERROR` | 500 | Database exception or unhandled calculation failure |

---

## 12. Rate & Abuse Controls

1. **Input Clamping**:
   - Pagination limit hard-capped at 200 items.
   - Offset clamped to non-negative values.
   - String parameters trimmed and length-bounded ($\le 100$ characters).
2. **Query Performance Safeguards**:
   - All database queries executed by Step 4.10.5-D-B rely exclusively on covered database indexes:
     - `bank_statement_line(bank_account_id, value_date, transaction_date)`
     - `bank_deposit_slip(bank_account_id, deposit_date, status)`
     - `accounting_journal_line(account_code, voucher_id)`
     - `accounting_voucher(branch_id, voucher_date, status)`
   - Pure `SELECT` queries with no pessimistic row locks (`FOR UPDATE` is NOT used during calculation).

---

## 13. Zero-Mutation Guarantee

Step 4.10.5-D-B operates under a **strict zero-mutation invariant**:
- 0 `INSERT` statements into `accounting_voucher`.
- 0 `INSERT` statements into `accounting_journal_entry`.
- 0 `INSERT` statements into `accounting_journal_line`.
- 0 `INSERT` statements into `bank_reconciliation_match`.
- 0 `UPDATE` statements on `bank_statement_line`.
- 0 `UPDATE` statements on `bank_deposit_slip`.
- 0 postings to suspense account 1119.
- All HTTP route handlers are strictly `GET`.

Stage-2 clearance posting (`Dr 1112 / Cr 1118`) remains 100% exclusively owned by Step 4.10.5-C.

---

## 14. API Regression Strategy

Prior to requesting implementation authorization, the verification plan is fully defined:

### Test Suite: `frontend/scratch/test_step4_10_5D_B_brs_api.js`

**Test Domains:**
1. **Pre-test Baseline Verification**: Verify 99 accounts, 0 test vouchers, 0 test journals, 0 test sessions, 173 historical orders, 53 historical payments, 424 inventory items.
2. **Route Mounting & Handler Verification**: Confirm `GET` handler in `src/app/api/v1/[...path]/route.ts` correctly captures all `admin/bank-reconciliation/*` subpaths.
3. **Authentication Verification**:
   - Unauthenticated caller returns `401 UNAUTHORIZED`.
   - Customer token returns `403 FORBIDDEN`.
   - Anonymous caller returns `403 FORBIDDEN`.
4. **RBAC Verification**:
   - Staff lacking `BANK.RECON_VIEW` returns `403 FORBIDDEN`.
   - Staff with `BANK.RECON_VIEW` passes authorization.
   - `SUPER_ADMIN` passes authorization.
5. **Branch & Enterprise Isolation**:
   - Branch staff querying Enterprise bank account returns `403 FORBIDDEN`.
   - Branch 1 staff querying Branch 2 bank account returns `403 FORBIDDEN`.
   - Branch 1 staff querying Branch 1 bank account succeeds `200 OK`.
   - `SUPER_ADMIN` querying Branch 1 account succeeds `200 OK`.
6. **BOLA & Parameter Validation**:
   - Missing `bank_account_id` returns `400 BAD_REQUEST`.
   - Malformed `as_of_date` (e.g. `2026/09/15`, `invalid-date`) returns `400 BAD_REQUEST`.
   - Non-existent `bank_account_id` returns `404 NOT_FOUND`.
   - Cross-account `session_id` mismatch returns `400 BAD_REQUEST`.
7. **BRS Calculation Accuracy**:
   - Mathematical identity validation: $R_{\text{paise}} = B_{\text{bank}} + D_{\text{transit}} - P_{\text{outstanding}} + U_{\text{debit}} - U_{\text{credit}}$.
   - Exact integer paise returned alongside decimal amounts.
   - Both balanced ($\Delta = 0$) and unbalanced ($\Delta \neq 0$) statement scenarios.
8. **Paginated Schedules Verification**:
   - `uncleared-deposits`: checks items array, totalCount, totalAmount, limit clamping ($\le 200$), offset slicing.
   - `outstanding-disbursements`: checks items array, totalCount, totalAmount, limit, offset.
   - `unmatched-lines`: checks items array, totalDebitAmount, totalCreditAmount, type filtering (`ALL`, `DEBIT`, `CREDIT`).
   - `sessions`: checks session array, totalCount, status filtering.
   - `sessions/:id`: returns single session with bank account metadata.
9. **Zero-Mutation Enforcement**:
   - Verify 0 financial vouchers created during test runs.
   - Verify 0 journal entries created during test runs.
   - Verify 0 match records created.
   - Verify 0 statement line updates.
10. **Lifecycle Clean Teardown**:
    - Complete cleanup of test bank account fixtures.
    - Explicit `await closeDbPool()`.
    - Explicit `process.exit(0)` on success.
    - Full post-test baseline audit confirming 100% pristine database state.

---

## 15. Gate Conclusion & Authorization Request

The forensic and design inspection for **Phase 4F Step 4.10 Substep 4.10.5-D-B (BRS REST API Endpoints)** is complete.
- All architectural invariants are locked.
- Zero code modifications have been made to application source files.
- The PostgreSQL database baseline remains 100% pristine.
- All regression suites from Step 4.10.2 through Step 4.10.5-D-A remain frozen and passing.

**Current State**:
- Step 4.10.5-D-A: **FROZEN 🔒**
- Step 4.10.5-D-B: **DESIGN GATE COMPLETE 📋 — READY FOR AUTHORIZATION**
- Step 4.10.5-E: **NOT STARTED ⏸**

**Awaiting user authorization to proceed with Step 4.10.5-D-B implementation.**

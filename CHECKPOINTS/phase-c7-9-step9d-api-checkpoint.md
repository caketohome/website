# CakeToHome ERP — Phase C7.9 Step 9D API & RBAC Controller Checkpoint
## Corporate Account Subsystem REST API, RBAC Matrix & Decision Q1 Credit Enforcement

> **Document Status**: 🔒 **STEP C7.9d VERIFIED & INDEPENDENTLY AUDITED**  
> **Preservation Baseline**: Group 7 commit `d231cee7e55f716526e62f5799cc7377c555fed3` on `checkpoint/c-phases-baseline`  
> **Date**: 2026-10-12  
> **Execution Mode**: STRICTLY BOUNDED API CONTROLLERS & RBAC — NO UNAPPROVED GL POSTING, LOCKED 100-ACCOUNT COA PRESERVED  

---

### 1. Executive Summary

Phase C7.9 Step 9D delivers the complete REST API controller layer, authoritative server-side RBAC evaluation, fail-closed authorization, PII masking for non-privileged viewers, mass-assignment defense, and credit activation enforcement governed by Decision Q1.

Key capabilities delivered and verified in Step 9D:
1. **CorporateAccountController (`corporate-account.controller.ts`)**:
   - Dispatches all HTTP verbs (`GET`, `POST`, `PATCH`, `PUT`, `DELETE`) for accounts, contacts, members, employee roster, coordinate verification, and import batches.
   - Enforces static module permissions (`CORPORATE_ACCOUNTS.*`, `CORPORATE_EMPLOYEES.*`) via `StaffAccessControl`.
   - Propagates account-scoped member roles (`ROSTER_MANAGER`, `ROSTER_VIEWER`) with fail-closed cross-tenant guards.
   - Dynamic PII masking (`maskPhone`, `maskEmail`) applied automatically for non-privileged viewers (`ROSTER_VIEWER`, non-managing staff), while preserving raw PII for Super Admin and Roster Managers.
   - Mass-assignment defense: Strict DTO destructuring ignores malicious client inputs (e.g., status manipulation, balance injections).
   - Multipart and JSON Base64 Excel workbook parser for bulk roster import validation and commits.

2. **Decision Q1 Credit Activation Governance (`activateCredit`)**:
   - `CorporateAccountService.activateCredit` strictly requires Super Admin authority and account status `APPROVED`.
   - Delegates within the *same database transaction* to `BillsReceivableService.approveCorporateCredit`, maintaining advisory locks and immutable audit event logging (`CREDIT_ACTIVATED`).
   - Legacy endpoint bypass closed: `POST admin/corporate-customers/:id/credit-approval` and `BillsReceivableService.approveCorporateCredit` inspect `public.corporate_account`. If linked to a corporate account, non-Super Admin callers and accounts with non-approved statuses are strictly rejected with 403 / 400. Standalone retail customers retain their existing workflow.

3. **Route Integration (`route.ts`)**:
   - Wired `CorporateAccountController` across `GET`, `POST`, `PUT`, `PATCH`, and `DELETE` dispatch loops.
   - Exported `CorporateAccountController` in `frontend/src/lib/controllers/index.ts`.

---

### 2. Verification Evidence & Test Execution Results

| Test Suite | Command | Assertions Passed | Exit Code | Status |
|---|---|---|---|---|
| **Step 9D API & RBAC Suite** | `node frontend/scratch/test_phase_c7_9_step9d_api.js` | **11 / 11** | `0` | ✅ PASSED |
| **TypeScript Static Compilation** | `npx tsc --noEmit` (in `frontend`) | **0 Errors** | `0` | ✅ CLEAN |
| **Step 9B Domain Services Suite** | `node frontend/scratch/test_phase_c7_9_step9b_domain.js` | **18 / 18** | `0` | ✅ PASSED |
| **Step 9C Bulk Roster Import Suite** | `node frontend/scratch/test_phase_c7_9_step9c_import.js` | **9 / 9** | `0` | ✅ PASSED |
| **Accounting Invariants & DB Audit** | `node scratch/verify_postflight_9d.js` | **All 13 Invariants Verified** | `0` | ✅ CLEAN |

---

### 3. Step 9D Test Scenarios (11/11 Passed)

1. `TEST [1] PASS`: Unauthenticated calls rejected with 401 UNAUTHORIZED.
2. `TEST [2] PASS`: Static RBAC enforces module-level VIEW and CREATE permissions (403 for unprivileged callers, 200 for operations staff).
3. `TEST [3] PASS`: Corporate account created via controller with `PENDING` status, primary contact, and automatic canonical customer synchronization.
4. `TEST [4] PASS`: Four-Eyes approval strictly enforced (`creator !== approver`, Super Admin only; creator Super Admin rejected when approving own account).
5. `TEST [5] PASS`: Retail customer linkage restricted to Super Admin with 1:1 uniqueness enforcement (conflict returns 409).
6. `TEST [6] PASS`: Corporate account status lifecycle (`SUSPEND <-> REACTIVATE`) governed strictly by Super Admin.
7. `TEST [7] PASS`: Credit activation secured per Decision Q1 (Super Admin only, bypass closed on legacy credit approval route).
8. `TEST [8] PASS`: Corporate membership scoping (`ROSTER_MANAGER`, `ROSTER_VIEWER`) & cross-tenant access isolation strictly enforced.
9. `TEST [9] PASS`: Employee roster lifecycle, phone reuse warning, and mass-assignment defense verified.
10. `TEST [10] PASS`: Dynamic PII masking enforced for non-privileged viewers (`ROSTER_VIEWER` receives masked phone/email; Super Admin receives unmasked data).
11. `TEST [11] PASS`: Bulk roster import API verified (template download, dry-run validation with line-item diagnostics, commit, and SHA-256 replay protection).

---

### 4. Independent Database Audit Verification

Independent audit via live PostgreSQL connection:
```json
{
  "coaCount": 100,
  "vouchers": 6,
  "journalEntries": 4,
  "journalLines": 10,
  "trialBalanceDebit": "3380.00",
  "trialBalanceCredit": "3380.00",
  "forbiddenCandidateAccounts": 0,
  "corporateAccountRows": 0,
  "corporateContactRows": 0,
  "corporateMemberRows": 0,
  "corporateEmployeeRows": 0,
  "employeeEventRows": 0,
  "accountEventRows": 0,
  "importBatchRows": 0
}
```

- **CoA Account Count**: Exactly 100 accounts (Zero drift).
- **Trial Balance**: Dr ₹3,380.00 = Cr ₹3,380.00 (Balanced).
- **Candidate Accounts**: Zero forbidden codes (`1118B`, `2118`, `2119`, `5114`, `5115`).
- **Isolation**: Corporate tables contain 0 rows post-test; all test fixtures cleanly teared down.

# CakeToHome ERP — Phase C7.9 Step 9E Corporate Admin UI Panels Checkpoint
## Corporate Account Master, Employee Roster Management & Bulk Import Wizard Panels

> **Document Status**: 🔒 **STEP C7.9e VERIFIED & CLEANLY COMPILED**  
> **Preservation Baseline**: Group 7 commit `d231cee7e55f716526e62f5799cc7377c555fed3` on `checkpoint/c-phases-baseline`  
> **Date**: 2026-10-12  
> **Execution Mode**: STRICTLY BOUNDED ADMIN UI PANELS — FULL TYPESCRIPT TYPE SAFETY, NO UNAPPROVED GL POSTING  

---

### 1. Executive Summary

Phase C7.9 Step 9E delivers the complete, production-ready corporate management user interface for the CakeToHome Super Admin Dashboard, fully adhering to the approved design lock, permissions model, and component architecture.

Components and capabilities delivered:
1. **CorporateAccountsPanel (`frontend/src/components/dashboard/admin/corporate-accounts-panel.tsx`)**:
   - **Account Directory & Metrics**:
     - Key metrics overview: Total Accounts, Pending Approval, Approved & Active, Suspended/Closed.
     - Fast search by Legal Name, Trade Name, GSTIN, PAN.
     - Status filtering tabs (`ALL`, `PENDING`, `APPROVED`, `SUSPENDED`).
   - **Corporate Registration Wizard Modal**:
     - Input fields for Legal Name, Trade Name, GSTIN (15-char regex enforced), PAN (10-char regex enforced).
     - Primary Contact Person sub-form (Name, Designation, Email, Phone).
     - Submits to `POST /api/v1/admin/corporate-accounts`, auto-creating canonical customer and initializing status to `PENDING`.
   - **Account Detail & Governance View**:
     - Master details header: Legal Name, Trade Name, Status badge, ID, Customer UID, GSTIN, PAN, Created At.
     - Four-Eyes Approval modal: Highlights Segregation of Duties (creator !== approver, Super Admin required).
     - Suspension & Reactivation modals with mandatory audit reasons.
   - **Decision Q1 Credit Governance**:
     - Displays requested credit limit and terms.
     - "Request Credit" modal for operations staff (`CORPORATE_ACCOUNTS.CREDIT_REQUEST`).
     - "Activate Credit" modal restricted to Super Admin, delegating to `BillsReceivableService.approveCorporateCredit` in the same transaction.
   - **Delegated Contacts & Scoped Members**:
     - Contact directory enforcing exactly one active `PRIMARY` contact per account.
     - Scoped membership management for `ROSTER_MANAGER` and `ROSTER_VIEWER` roles.
   - **Employee Roster Management Sub-Panel**:
     - Comprehensive employee roster table: Code, Full Name, Phone, Email, Department, Designation, Coordinates, Status.
     - Dynamic PII protection: Obfuscates sensitive contact information for non-privileged viewers while displaying unmasked values to Super Admin and Roster Managers.
     - Coordinates Verification: Latitude/Longitude display with plausibility verification indicator and Super Admin verification action.
     - Soft-Deactivation & Rehire/Reactivation modals with mandatory audit reasons (re-joining employees preserve original ID).
   - **Bulk Employee Roster Import Wizard**:
     - Official Excel template download button (`GET /api/v1/admin/corporate-accounts/:id/employees/import/template`).
     - File picker and drag-and-drop supporting `.xlsx`.
     - Read-only Dry-Run Validation trigger (`POST /api/v1/admin/corporate-accounts/:id/employees/import/validate`).
     - Validation Diagnostics Report: Total Rows, Valid Rows, Invalid Rows, Duplicate Rows, Phone Reuse Warnings, row-level error breakdown with line numbers, and SHA-256 file hash display.
     - Atomic Commit button (`POST /api/v1/admin/corporate-accounts/:id/employees/import/commit`) with replay protection and double-submit defense.
     - Historical import batches list with status badges and timestamps.

2. **Dashboard Navigation Integration**:
   - `admin-tabs.tsx`: Added `{ id: "corporate_accounts", label: "Corporate Accounts & Roster", icon: Building2 }`.
   - `AdminSidebar.tsx`: Added `{ id: "corporate_accounts", label: "Corporate Accounts & Roster", icon: Building2, tabId: "corporate_accounts" }` under the Customers navigation group.
   - `dashboard/page.tsx`: Dynamically imported `CorporateAccountsPanel` via `createDynamicPanel` and wired it into `AdminTabId` and `PANEL_MAP`.
   - `staff-access-control.ts`: Added `corporate_accounts: { module: "CORPORATE_ACCOUNTS", action: "VIEW" }` to `TAB_PERMISSION_MAP`.

---

### 2. Verification Evidence

| Verification Suite | Command | Result | Status |
|---|---|---|---|
| **TypeScript Static Compilation** | `npx tsc --noEmit` (in `frontend`) | **0 Errors** (Clean build) | ✅ PASS |
| **Step 9D API Test Suite** | `node frontend/scratch/test_phase_c7_9_step9d_api.js` | **11 / 11 Passed** | ✅ PASS |
| **Step 9B Domain Services Suite** | `node frontend/scratch/test_phase_c7_9_step9b_domain.js` | **18 / 18 Passed** | ✅ PASS |
| **Step 9C Bulk Roster Import Suite** | `node frontend/scratch/test_phase_c7_9_step9c_import.js` | **9 / 9 Passed** | ✅ PASS |
| **Independent PostgreSQL Audit** | `node scratch/verify_postflight_9d.js` | **All 13 Invariants Verified** | ✅ CLEAN |

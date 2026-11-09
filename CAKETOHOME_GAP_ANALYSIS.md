# CakeToHome ERP — Comprehensive Gap Analysis & Remediation Plan

**Document Version:** 1.0.0  
**Audit Timestamp:** 2026-10-22T17:25:00+05:30  
**Auditor Roles:** Principal Software Architect, PostgreSQL Database Administrator, ERP Compliance Auditor, Security Lead  
**Governing Arena Seed:** `772911` (Champion: `a003`)  
**Standardized Status Labels:** `VERIFIED`, `PARTIALLY VERIFIED`, `FAILED`, `BLOCKED`, `NOT IMPLEMENTED`, `NOT RECHECKED`

---

## 1. Statutory & Regulatory Compliance Gaps

### GAP-STAT-01: 13 Historical Completed Test Orders Lacking Invoice Allocation
- **Classification:** Statutory / Compliance Blocker (Gate 1)
- **Forensic Reconciliation:** Live database contains exactly 13 test orders (`ord_test_cod_1792216816562` through `ord_test_cod_1792220817636`), each with `metadata->>'total' = 350` (13 × ₹350 = ₹4,550.00 aggregate face value, not ₹11,438 which was based on non-existent IDs). 7 orders have linked settlement deposit vouchers; zero statutory invoices allocated.
- **Statutory Risk:** Under Rule 46 of the CGST Rules 2017, completed supplies require invoices unless formally exempted.
- **Remediation Path:** Staged memorandum `AUTH-CFO-2026-10-22-EX01` and Option A SQL script prepared for Finance Controller authorization.
- **Production Gate:** Strictly **BLOCKED**. Zero production writes may occur until explicit written authorization is received from the Finance Controller.
- **Status:** `BLOCKED`

### GAP-STAT-02: 188-Number Statutory Sequence Watermark Discrepancy
- **Classification:** Statutory Accounting Architecture (Gate 2)
- **Root Cause:** `public.invoice_sequence` has `last_seq = 193`, but `public.invoice` contains only 5 rows (`CTH/26-27/000031` to `CTH/26-27/000035`). Sequence numbers `000001` through `000030` (30 numbers) and `000036` through `000193` (158 numbers) were consumed during sequence stress testing and rollbacks.
- **Statutory Risk:** Section 31 of the CGST Act 2017 requires consecutive serial numbering. Rewinding the sequence back to 1 or 6 would violate the immutability invariant and create duplicate invoice number collisions with previously issued test invoices.
- **Remediation Path:** Inviolable forward progression. Sequence counter must **NOT** be rewound. The next statutory invoice must be strictly `CTH/26-27/000194`. The 188 missing sequence numbers must be formally registered in the Company's Statutory Invalidation & Cancelled Invoice Register as test-consumed sequences prior to commercial go-live.
- **Status:** `VERIFIED` (Architectural Rule Enforced & Watermark 193 Rechecked)

### GAP-STAT-03: Company Legal Master & Multi-State GSTIN Initialization
- **Classification:** Corporate Governance & Setup (Gate 3)
- **Resolution:** Backend Next.js API re-wired to `CompanyService` and `GstRegistrationService`. Server-side validation (PAN format `^[A-Z]{5}[0-9]{4}[A-Z]$`, 2-digit state codes) and `SUPER_ADMIN` RBAC enforced. Verified in real Playwright browser testing: invalid PAN rejected, valid synthetic profile saved, post-refresh persistence confirmed, and committed rows verified in `public.company` and `public.gst_registration`.
- **Status:** `VERIFIED` (Technical & Browser) / `PENDING` (Live Production Data Input by Super Admin)

---

## 2. Operational & Domain Gaps

### GAP-OPS-01: Vendor Procurement & Accounts Payable Onboarding
- **Classification:** Supply Chain & Procurement
- **Root Cause:** `public.purchase` and `public.purchase_item` have 0 records in the live database. While `PurchaseService`, `BillsPayableService`, and `PurchasePostingService` are fully coded and tested, no live supplier vendor accounts exist.
- **Operational Impact:** Central bakery purchasing of flour, chocolate, dairy, and packaging cannot be booked through ERP AP workflows until suppliers are created.
- **Remediation Path:** Onboard suppliers via `/dashboard/admin/purchases` during pre-launch operations.
- **Production Blocking:** Non-blocking for customer storefront launch; required for Phase 2 supply chain operations.
- **Status:** `NOT IMPLEMENTED`

### GAP-OPS-02: Cash & Banking End-of-Day Deposit Slip Slips
- **Classification:** Treasury & Branch Cash Operations
- **Root Cause:** `public.bank_deposit_slip` currently has 0 rows. Daily branch cash drawers (`public.teller_session` with 54 rows and `public.teller_movement` with 67 rows) are active, but branch managers have not yet executed end-of-day bank deposits with scanned deposit slips.
- **Operational Impact:** Physical cash collected at stores must be reconciled with bank statements weekly.
- **Remediation Path:** Perform operational training with Indiranagar and Koramangala store managers on the Bank Deposit Slip upload flow.
- **Status:** `PARTIALLY VERIFIED`

### GAP-OPS-03: Accounting Cutover Date Configuration
- **Classification:** Financial General Ledger (Gate 4)
- **Resolution:** `setting.accounting_start_date` set to `2026-04-01` in `public.setting`. Accounting Setup Panel displays date and locked banner. Boundary tested in real Playwright browser: mutation attempts rejected with HTTP 409 `START_DATE_IMMUTABLE` due to 56 existing posted journal entries.
- **Status:** `VERIFIED`

---

## 3. Data Integrity & Persistence Gaps

### GAP-DATA-01: Anti-JSON & Zero File Persistence Audit
- **Classification:** Data Architecture
- **Root Cause:** Legacy Medusa and early Next.js iterations stored cart and temporary logs in `.json` files.
- **Audit Findings:** Scanned 589 files across the entire codebase (`scripts/verify-no-json-runtime.mjs`). **0** file-system JSON stores detected. All state is maintained in PostgreSQL with memory cache hydration.
- **Remediation Path:** Complete. Enforcement script integrated into continuous integration.
- **Status:** `VERIFIED`

### GAP-DATA-02: Connection Pooler Resilience Under Test Mode
- **Classification:** Infrastructure Reliability
- **Root Cause:** Background persistence workers in `db-persistence.ts` attempted live database updates even when test suites ran without `DATABASE_URL`, causing `ECONNREFUSED` uncaught exceptions.
- **Remediation Path:** Implemented early-return guards `if (!process.env.DATABASE_URL || process.env.SKIP_DB_PERSISTENCE === "true") return;` across `persistDeliveryPartnerToDb`, `persistOrderToDb`, `persistCustomerToDb`, and `persistBranchToDb`.
- **Status:** `VERIFIED`

---

## 4. Technical Debt & Code Maintainability

### GAP-TECH-01: Legacy Medusa Restaurant ID Aliases
- **Classification:** Code Maintainability
- **Root Cause:** Historical seed branches used Medusa restaurant keys like `res_01KXYMAHGFPRY1G9TZKEVGAGAT` alongside canonical branch IDs like `br_indiranagar`.
- **Audit Findings:** `ApiEngine.resolveBranchRecord`, `ApiEngine.isOrderInBranch`, and `StaffAccessControl` now support bidirectional alias translation.
- **Remediation Path:** Maintain legacy alias compatibility layers to ensure zero regression for historical data while standardizing new entities on `br_<slug>`.
- **Status:** `VERIFIED`

### GAP-TECH-02: Public Static Memory Store Getter Availability
- **Classification:** Developer Experience & Testing API
- **Root Cause:** Static test scripts accessing `(ApiEngine as any).memoryStore` previously hit undefined property errors because `memoryStore` was a file-scoped variable.
- **Remediation Path:** Added `static get memoryStore() { ApiEngine.ensureOrdersStore(); ApiEngine.ensureDeliveryPartnersStore(); return memoryStore; }` to `ApiEngine`.
- **Status:** `VERIFIED`

---

## 5. Comprehensive Gap Remediation Summary

| Gap ID | Description | Severity | Remediation Action | Sign-off Required | Target Timeline | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **GAP-STAT-01** | 13 test orders un-invoiced | Critical | Execute Option A staging SQL after Finance written approval | Finance Controller | Pre-Launch | `BLOCKED` |
| **GAP-STAT-02** | Watermark 193 sequence gap | Critical | Reaffirm sequence at 193; file Statutory Invalidation Register | Statutory Auditor | Pre-Launch | `BLOCKED` |
| **GAP-STAT-03** | Company master unconfigured | High | Super Admin legal onboarding in Settings | Super Admin | Pre-Launch | `NOT IMPLEMENTED` |
| **GAP-OPS-01** | Vendor procurement master | Medium | Onboard suppliers post-launch | Purchasing Manager | Post-Launch | `NOT IMPLEMENTED` |
| **GAP-OPS-02** | Bank deposit slip training | Medium | Branch manager workflow training | Ops Lead | Pre-Launch | `PARTIALLY VERIFIED` |
| **GAP-OPS-03** | Accounting start date | High | Populate `accounting_start_date` in `public.setting` | Finance Controller | Pre-Launch | `PARTIALLY VERIFIED` |
| **GAP-DATA-01** | Zero JSON stores | Critical | Completed and verified across 589 files | Principal Architect | Immediate | `VERIFIED` |
| **GAP-DATA-02** | Pooler test resilience | Critical | Added safe persistence guards | Principal Architect | Immediate | `VERIFIED` |
| **GAP-TECH-01** | Medusa ID aliases | Medium | Bidirectional mapping implemented | Senior Engineer | Immediate | `VERIFIED` |
| **GAP-TECH-02** | ApiEngine memoryStore | Low | Static getter implemented | Senior Engineer | Immediate | `VERIFIED` |

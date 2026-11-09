# CakeToHome ERP — Teller Version Inventory & Architectural Assessment

**Document ID:** `docs/teller/teller_version_inventory.md`  
**Date:** 2026-10-17T07:30:00+05:30  
**Author:** Principal Software Architect, Senior Full-Stack Engineer & Financial Controls Specialist  
**Status:** Canonical & Audited  

---

## 1. Executive Summary & Intended Version Identification

Based on a forensic audit of the entire CakeToHome ERP repository, Git commit history, schema migrations, and accounting checkpoints, **two distinct implementations of teller / cash drawer functionality** were discovered in the codebase:

1. **Version 1: The Canonical Relational Teller Cash Custody & Shift Management System (Phase C4.2)**
   - **Origin & Git History:** Introduced in database migration `20261004_phase_c_teller_management.sql` and committed in `b93d864` (`feat(accounting): commit Phase A, B, C foundations`). Formally frozen and approved in checkpoint `CHECKPOINTS/phase-c4-2-teller-cash-custody-ui.md`.
   - **Architectural Core:** Backed by dedicated relational PostgreSQL tables (`public.teller`, `public.teller_session`, `public.teller_movement`, `public.vault_custody_transfer`). Enforces strict 3-tier Segregation of Duties (Opener != Verifier != Settler) and integrates directly with `PostingService` to post balanced General Ledger journal vouchers (Account `5296 Cash Over/Short` vs Account `1111 Cash in Hand`).
   - **Verdict:** **INTENDED CANONICAL VERSION TO RETAIN.**

2. **Version 2: The Legacy Disconnected Branch Manager Cash Drawer (Step 5.4)**
   - **Origin & Git History:** Added in commit `e1aeca9` (`feat(accounting): implement step 5.4 distributed branch operations`).
   - **Architectural Flaws:** Stores cash drawer opening float and closing count directly in a mutable JSONB column on the branch table (`branch.metadata->'drawer_session'`). Bypasses `public.teller_session`, bypasses `public.teller_movement`, lacks 3-tier Segregation of Duties, does not generate General Ledger settlement vouchers, and fails closed when integrated with `ExpensePostingService` and `PurchasePaymentService`.
   - **Verdict:** **OBSOLETE & CONFLICTING DUPLICATE TO BE REMOVED.**

---

## 2. Comprehensive Teller Version Inventory

| Implementation Name | File Path | Features & Workflows Supported | API Routes Used | Database Tables Used | Module Dependencies | Classification & Status |
|:---|:---|:---|:---|:---|:---|:---|
| **Canonical Teller Master Panel** | `frontend/src/components/dashboard/admin/teller-custody-panel.tsx` | Master tab container, branch selector, role-based tab gating | None (client container) | None directly | `ActiveDrawerTab`, `BranchCashTab`, `SessionHistoryTab`, `TellerMasterTab`, `VerificationSettlementQueueTab` | **CANONICAL & RETAINED** |
| **Canonical Active Till Drawer** | `frontend/src/components/dashboard/admin/teller/ActiveDrawerTab.tsx` | Shift opening float declaration, live 4-card metric displays (Float, Inflows, Outflows, Expected Cash), real-time movement feed, closing count modal | `GET /api/v1/admin/teller/sessions/active`, `POST /api/v1/admin/teller/sessions/open`, `POST /api/v1/admin/teller/sessions/:id/movements`, `POST /api/v1/admin/teller/sessions/:id/close` | `public.teller`, `public.teller_session`, `public.teller_movement` | `MovementLedgerTable`, `ManualAdjustmentModal`, `CloseSessionModal` | **CANONICAL & RETAINED** |
| **Canonical Work Queue (SoD)** | `frontend/src/components/dashboard/admin/teller/VerificationSettlementQueueTab.tsx` | Dual-stream queue: Supervisor Count Verification and Accountant Settlement; SoD validation | `GET /api/v1/admin/teller/sessions?status=CLOSING`, `POST /api/v1/admin/teller/sessions/:id/verify`, `GET /api/v1/admin/teller/sessions/:id/prepare-settlement`, `POST /api/v1/admin/teller/sessions/:id/settle` | `public.teller_session`, `public.accounting_voucher`, `public.accounting_journal_entry` | `SupervisorVerificationModal`, `SettlementWorkspaceModal` | **CANONICAL & RETAINED** |
| **Canonical Session History** | `frontend/src/components/dashboard/admin/teller/SessionHistoryTab.tsx` | Historical shift audit trail, voucher deep links, movement inspection drawer | `GET /api/v1/admin/teller/sessions`, `GET /api/v1/admin/teller/sessions/:id/movements` | `public.teller_session`, `public.teller_movement` | `MovementLedgerTable` | **CANONICAL & RETAINED** |
| **Canonical Station Master** | `frontend/src/components/dashboard/admin/teller/TellerMasterTab.tsx` | Physical counter station provisioning, operator assignment, station activation toggle | `GET /api/v1/admin/tellers`, `POST /api/v1/admin/tellers`, `PATCH /api/v1/admin/tellers/:id` | `public.teller`, `public.user`, `public.branch` | `TellerRepository` | **CANONICAL & RETAINED** |
| **Enterprise Branch Cash Tab** | `frontend/src/components/dashboard/admin/teller/BranchCashTab.tsx` | Multi-branch cash position, safe drops, safe-to-till replenishments, GL 1111 reconciliation | `/api/v1/admin/teller/vault-movements`, `/api/v1/admin/teller/branch-cash-reconciliation` | `public.branch_vault_movement`, `public.vault_custody_transfer`, `public.accounting_journal_line` | `branch-cash.service.ts`, `vault-custody.service.ts` | **SUPPORTING & RETAINED** |
| **Shift Closing Modal** | `frontend/src/components/dashboard/admin/teller/CloseSessionModal.tsx` | Cashier physical count entry, variance preview, shift transition (`OPEN -> CLOSING`) | `POST /api/v1/admin/teller/sessions/:id/close` | `public.teller_session` | `TellerSessionService` | **CANONICAL & RETAINED** |
| **Manual Cash Adjustment Modal** | `frontend/src/components/dashboard/admin/teller/ManualAdjustmentModal.tsx` | Cash injection (`IN`) and petty withdrawal (`OUT`) during active shifts | `POST /api/v1/admin/teller/sessions/:id/movements` | `public.teller_movement` | `TellerMovementService` | **CANONICAL & RETAINED** |
| **Supervisor Verification Modal** | `frontend/src/components/dashboard/admin/teller/SupervisorVerificationModal.tsx` | Independent count verification by supervisor (`CLOSING -> PENDING_VERIFICATION`), SoD guard | `POST /api/v1/admin/teller/sessions/:id/verify` | `public.teller_session` | `TellerSessionService` | **CANONICAL & RETAINED** |
| **Settlement Workspace Modal** | `frontend/src/components/dashboard/admin/teller/SettlementWorkspaceModal.tsx` | Preflight GL preview, accountant variance sign-off (`PENDING_VERIFICATION -> SETTLED`), GL voucher posting | `GET /api/v1/admin/teller/sessions/:id/prepare-settlement`, `POST /api/v1/admin/teller/sessions/:id/settle` | `public.teller_session`, `public.accounting_voucher` | `PostingService`, `TellerSessionService` | **CANONICAL & RETAINED** |
| **Canonical Teller Domain Services** | `frontend/src/lib/services/teller*.service.ts` | Relational domain logic: atomic opening, movement recording, overdraft validation, SoD enforcement, GL voucher creation | Domain invocation by API route handlers | `public.teller`, `public.teller_session`, `public.teller_movement` | `PostingService`, `dbTransaction` | **CANONICAL & RETAINED** |
| **Canonical Teller Repositories** | `frontend/src/lib/repositories/teller*.repository.ts` | Type-safe PostgreSQL queries with `SELECT FOR UPDATE` locking | Domain invocation | `public.teller`, `public.teller_session`, `public.teller_movement` | `pg.PoolClient` | **CANONICAL & RETAINED** |
| **Legacy Manager Drawer Controls** | `frontend/src/components/dashboard/shop/branch-operations-manager.tsx` (Lines 1169–1315) | Form inputs for `openingFloatInput` and `closingCountInput` updating JSON metadata | `POST /api/v1/manager/cash/drawer/open`, `POST /api/v1/manager/cash/drawer/close` | `branch.metadata->'drawer_session'` (JSONB) | `manager.ts` (`recordDrawerOpeningFloat`, `recordDrawerClosingCount`) | **OBSOLETE & TO REMOVE** |
| **Legacy Manager Drawer Client SDK** | `frontend/src/lib/data/manager.ts` (`recordDrawerOpeningFloat`, `recordDrawerClosingCount`) | Thin wrappers around legacy `POST /api/v1/manager/cash/drawer/open` and `close` | `POST /api/v1/manager/cash/drawer/open`, `POST /api/v1/manager/cash/drawer/close` | `branch.metadata` | Consumed exclusively by `branch-operations-manager.tsx` Section 1 | **OBSOLETE & TO REMOVE** |
| **Legacy Manager Drawer Endpoints** | `frontend/src/app/api/v1/[...path]/route.ts` (Lines 9397–9577) | Expressive JSON handlers that attempted to bridge JSON metadata with relational records | `manager/cash/drawer/open`, `manager/cash/drawer/close` | `branch.metadata`, `public.teller_session` | Replaced by canonical `/api/v1/admin/teller/sessions/*` | **OBSOLETE & TO REMOVE** |

---

## 3. Explaining Both Systems (Beginner-Friendly Comparison)

### The Canonical Teller System (Version 1)
- **What it is:** Like a locked, audited cash register in a reputable department store.
- **Why it exists:** When money enters or leaves a physical cash drawer, two people must verify what happened, and every rupee must match the central general ledger.
- **How it works:**
  1. An authorized cashier opens a station and counts their opening change float (e.g. ₹500).
  2. Every time a cash purchase or approved cash expense occurs, the computer checks that the drawer has enough money. If someone tries to spend ₹600 from a ₹500 drawer, the computer refuses.
  3. At the end of the shift, the cashier counts the physical cash and enters the number.
  4. The supervisor must independently verify the physical cash count. The cashier cannot verify their own cash.
  5. The accountant reviews the variance (if any) and posts an official accounting voucher (`Dr 5296 / Cr 1111` for cash shortages).
- **The Result:** 100% financial integrity, zero lost money, zero phantom balances.

### The Obsolete Legacy Drawer (Version 2)
- **What it was:** A makeshift digital notepad that merely wrote `status: "OPEN", float: 500` inside a JSON text box on the branch record.
- **Why it is broken:**
  1. It never recorded who actually took the cash.
  2. It had no supervisor verification step.
  3. When an expense was recorded, the database checked the official relational teller table and saw nothing, throwing an error.
  4. When the manager closed the shift, no accounting voucher was posted to the general ledger, leaving financial statements out of balance.

---

## 4. Safety Plan & Dependency Verification Before Removal

Before removing any code:
1. **Preserve Shared Operations:** `branch-operations-manager.tsx` contains vital operational tabs:
   - Orders processing, Kitchen Order Tickets (KOT), Packing, and Delivery Rider Assignment.
   - Branch Purchases and GRN Receipts.
   - Branch Expenses and Bill Submissions.
   - Inventory stock counts and damage reporting.
   - Delivery Rider COD Remittance Handover (lines 1317–1457) — which is part of COD remittance control.
   - Bank Cash Deposit Slips (lines 1459–1500) — which is part of bank deposit slip creation.
   - `GET /api/v1/manager/cash/position` — which computes daily cash sales and delivered COD custody.
2. **Targeted Removal Scope:**
   - ONLY Section 1 of Tab 5 ("Cash Drawer Opening & Closing Float", lines 1169–1315) in `branch-operations-manager.tsx` is obsolete. It will be replaced with an integrated view linking or directly displaying the canonical `TellerCustodyPanel` / `ActiveDrawerTab`.
   - The obsolete methods `recordDrawerOpeningFloat` and `recordDrawerClosingCount` in `frontend/src/lib/data/manager.ts` will be safely removed.
   - The obsolete endpoints `POST manager/cash/drawer/open` and `POST manager/cash/drawer/close` in `route.ts` will be retired with clean `410 GONE` / `400 BAD_REQUEST` redirects pointing callers to canonical `/api/v1/admin/teller/sessions/*`.

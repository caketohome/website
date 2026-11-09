# CakeToHome ERP — Phase 2: Pre-Cleanup Teller Consolidation Checkpoint

**Checkpoint ID:** `CHECKPOINT_PHASE2_PRE_CLEANUP_TELLER_CONSOLIDATION`  
**Timestamp:** 2026-10-17T07:35:00+05:30  
**Phase:** Phase 2 Task 2 — Safe Removal of Obsolete Teller Implementations  
**Repository Path:** `E:\vig\cakes2home-main\cakes2home-main`  
**Git Branch:** `task/dev`  
**Status:** Pre-Cleanup Safety Baseline Established  

---

## 1. Objective
Establish a formal, recoverable audit checkpoint before applying the cleanup phase that safely removes obsolete, duplicate teller implementations and consolidates all teller and cash drawer custody into the canonical relational engine (`public.teller`, `public.teller_session`, `public.teller_movement`).

---

## 2. Intended Version Retained (100% Preserved)
The **Canonical Relational Teller Cash Custody & Shift Management System (Phase C4.2)** is fully preserved with all its dependencies:
1. `frontend/src/components/dashboard/admin/teller-custody-panel.tsx`
2. `frontend/src/components/dashboard/admin/teller/ActiveDrawerTab.tsx`
3. `frontend/src/components/dashboard/admin/teller/BranchCashTab.tsx`
4. `frontend/src/components/dashboard/admin/teller/CloseSessionModal.tsx`
5. `frontend/src/components/dashboard/admin/teller/ManualAdjustmentModal.tsx`
6. `frontend/src/components/dashboard/admin/teller/MovementLedgerTable.tsx`
7. `frontend/src/components/dashboard/admin/teller/SessionHistoryTab.tsx`
8. `frontend/src/components/dashboard/admin/teller/SettlementWorkspaceModal.tsx`
9. `frontend/src/components/dashboard/admin/teller/SupervisorVerificationModal.tsx`
10. `frontend/src/components/dashboard/admin/teller/TellerMasterTab.tsx`
11. `frontend/src/components/dashboard/admin/teller/VerificationSettlementQueueTab.tsx`
12. Services: `teller.service.ts`, `teller-session.service.ts`, `teller-movement.service.ts`, `branch-cash.service.ts`, `vault-custody.service.ts`, `petty-cash.service.ts`
13. Repositories: `teller.repository.ts`, `teller-session.repository.ts`, `teller-movement.repository.ts`, `vault-custody.repository.ts`, `petty-cash.repository.ts`
14. Database tables: `public.teller`, `public.teller_session`, `public.teller_movement`, `public.vault_custody_transfer`, `public.branch_vault_movement`

---

## 3. List of Obsolete Code & Files to be Modified / Retired

| Target File | Change Scope | Rationale | Shared Code Affected |
|:---|:---|:---|:---|
| `frontend/src/lib/data/manager.ts` | Remove obsolete exports `recordDrawerOpeningFloat` and `recordDrawerClosingCount` (lines 370–388). | These functions bypassed canonical relational teller sessions and posted to deprecated JSONB endpoints. | Zero. All other manager functions (`orders`, `purchases`, `expenses`, `cod`, `deposits`) remain 100% intact. |
| `frontend/src/components/dashboard/shop/branch-operations-manager.tsx` | 1. Remove obsolete imports (`recordDrawerOpeningFloat`, `recordDrawerClosingCount`).<br>2. Remove unused state variables (`openingFloatInput`, `openingFloatNotes`, `closingCountInput`, `closingCountNotes`).<br>3. Replace duplicate Section 1 of Tab 5 (lines 1169–1315) with an authoritative, unified **Branch Teller Cash Drawer & Custody Terminal** card that displays live canonical status and links/directs the manager directly to `/dashboard?tab=teller_custody`. | Eliminates duplicate, un-audited drawer open & close buttons that bypassed 3-tier SoD and GL voucher creation, while retaining full cash visibility for the branch manager. | Zero. Sections 2 (Rider COD Remittance) and 3 (Bank Deposit Slips) and Tabs 1, 2, 3, 4, 6, 7 are 100% preserved. |
| `frontend/src/app/api/v1/[...path]/route.ts` | Retire routes `POST manager/cash/drawer/open` and `POST manager/cash/drawer/close` by returning HTTP `410 GONE`: `{ success: false, error: "OBSOLETE_ENDPOINT", message: "This legacy manager cash drawer endpoint is obsolete and retired. Use canonical Teller Custody routes under /api/v1/admin/teller/sessions/*." }`. | Prevents any stale client from mutating JSON metadata without canonical relational ledger posting. | Zero. `GET manager/cash/position` remains active to feed branch overview metric cards. |
| `scratch/test_all_accounting_and_teller_apis.js` | Update API acceptance test to verify canonical teller session operations (`/api/v1/admin/teller/sessions/*`) and assert that obsolete endpoints return `410 GONE`. | Ensures acceptance test reflects canonical architecture. | Test fixture only. |

---

## 4. Rollback and Recovery Instructions
If any rollback is required:
1. Re-read this checkpoint.
2. The exact pre-cleanup diff can be inspected via Git.
3. Zero database rows are dropped or truncated during this cleanup; the relational schema remains pristine.

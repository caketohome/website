# CakeToHome — Dead & Redundant Code Audit Report (DEAD_CODE_REPORT.md)

**Generated**: 2026-08-18  
**Audit Purpose**: Complete dead code detection, unused export analysis, obsolete one-off script audit, and verification of zero active references.

---

## 1. Dead Code Detection & Import Trace Ledger

| File / Entity Path | Current Classification | References Found | Confidence | Deletion Action Plan |
| :--- | :--- | :--- | :--- | :--- |
| `frontend/src/app/scroll-debug/` | `SAFE_TO_REMOVE` | 0 references across entire codebase (empty directory) | 100% | Safe to remove. |
| `frontend/src/app/scroll-debug-overlay/` | `SAFE_TO_REMOVE` | 0 references across entire codebase (empty directory) | 100% | Safe to remove. |
| `frontend/scripts/clean-api-client-safely.ts` | `LEGACY_SCRATCH` | 0 references; one-off duplicate cleanup script from Phase 8.5 | 100% | Safe to archive / clean. |
| `frontend/scripts/clean-api-engine.ts` | `LEGACY_SCRATCH` | 0 references; one-off duplicate cleanup script from Phase 8.5 | 100% | Safe to archive / clean. |
| `frontend/scripts/find-api-client-duplicates.ts` | `LEGACY_SCRATCH` | 0 references; one-off verification tool | 100% | Safe to archive / clean. |
| `frontend/scripts/find-duplicates.ts` | `LEGACY_SCRATCH` | 0 references; one-off verification tool | 100% | Safe to archive / clean. |
| `frontend/scripts/fix-api-client-duplicates.ts` | `LEGACY_SCRATCH` | 0 references; one-off AST modifier | 100% | Safe to archive / clean. |
| `frontend/scripts/fix-api-engine-duplicates.ts` | `LEGACY_SCRATCH` | 0 references; one-off AST modifier | 100% | Safe to archive / clean. |
| `frontend/scripts/fix-broken-assets-and-proxy.ts` | `LEGACY_SCRATCH` | 0 references; one-off repair tool | 100% | Safe to archive / clean. |
| `frontend/scripts/fix-final-duplicates.ts` | `LEGACY_SCRATCH` | 0 references; one-off repair tool | 100% | Safe to archive / clean. |
| `frontend/scripts/fix-type-issues.ts` | `LEGACY_SCRATCH` | 0 references; one-off type fixer | 100% | Safe to archive / clean. |
| `frontend/scripts/test-cors-image.ts` | `LEGACY_SCRATCH` | 0 references; one-off CORS diagnostic | 100% | Safe to archive / clean. |
| `frontend/scripts/inspect-real-scroll.ts` | `LEGACY_SCRATCH` | 0 references; one-off canvas inspector | 100% | Safe to archive / clean. |

---

## 2. Active Core Test Suites (MUST BE PRESERVED)

The following test suites are **ACTIVE** and form the core regression harness for Phase 8:
- `frontend/scripts/test-master-identity-chain-e2e.ts` (Active Master Identity Suite)
- `frontend/scripts/verify-master-identity-playwright.ts` (Active Master Identity Browser Suite)
- `frontend/scripts/test-telemarketing-reorder-engine-e2e.ts` (Active Telemarketing Intelligence Suite)
- `frontend/scripts/verify-telemarketing-playwright.ts` (Active Telemarketing Browser Suite)
- `frontend/scripts/test-telecaller-rbac-staff-assignment-e2e.ts` (Active RBAC Suite)
- `frontend/scripts/verify-telecaller-rbac-playwright.ts` (Active RBAC Browser Suite)
- `frontend/scripts/test-outreach-order-linking-e2e.ts` (Active Outreach Conversion Suite)
- `frontend/scripts/verify-outreach-order-linking-playwright.ts` (Active Outreach Conversion Browser Suite)
- `frontend/scripts/test-n8n-outbox-complete-e2e.ts` (Active Webhooks Outbox Suite)
- `frontend/scripts/verify-n8n-webhooks-playwright.ts` (Active Webhooks Outbox Browser Suite)
- `frontend/scripts/test-popup-complete-engine-e2e.ts` (Active Popups Engine Suite)
- `frontend/scripts/test-scroll-frame-hero-112-e2e.ts` (Active 112-Frame Animation Suite)

---

## 3. Duplicate Method Audit & Clean Architecture Guarantee

All duplicate static methods in `ApiEngine` and duplicate async methods in `CakeToHomeApiClient` have been pruned and unified:
- `normalizePhone` $\rightarrow$ Unified in `src/lib/crm/crm-engine.ts`
- `normalizeEmail` $\rightarrow$ Unified in `src/lib/crm/crm-engine.ts`
- `fireWebhookEvent` $\rightarrow$ Unified in `ApiEngine.fireWebhookEvent` (5-argument signature forwarding to `WebhookEngine.emitEvent`)
- `attributeRecoveryOrder` $\rightarrow$ Unified in `ApiEngine.attributeRecoveryOrder`
- `recordAttributedOrder` $\rightarrow$ Unified in `TelemarketingEngine.recordAttributedOrder`

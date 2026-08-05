# 07 — Migration Plan

## Master Migration Timeline

```
+-----------------------------------------------------------------------------------+
| Phase 0: System Architecture & Single Source of Truth Documentation              | [COMPLETED]
+-----------------------------------------------------------------------------------+
| Phase 1: Core Express Engine & Customer Identity / Auth Module                   | [IN PROGRESS]
+-----------------------------------------------------------------------------------+
| Phase A: Business Module Freeze & Architecture Freeze                             | [COMPLETED]
+-----------------------------------------------------------------------------------+
| Phase B: Core Infrastructure (Express, Prisma, DTO Mappers, Health, Error)        | [COMPLETED]
+-----------------------------------------------------------------------------------+
| Phase C: API Compatibility Gateway & Coexistence Middleware                       | [COMPLETED]
+-----------------------------------------------------------------------------------+
| Phase A: Business Module Freeze & Architecture Freeze                             | [✅ VERIFIED]
+-----------------------------------------------------------------------------------+
| Phase B: Core Infrastructure (Express, Prisma, DTO Mappers, Health, Error)        | [⚠️ IMPLEMENTED — VERIFICATION INCOMPLETE]
+-----------------------------------------------------------------------------------+
| Phase C: API Compatibility Gateway & Coexistence Middleware                       | [⚠️ IMPLEMENTED — VERIFICATION INCOMPLETE]
+-----------------------------------------------------------------------------------+
| Phase B: Core Infrastructure (Express, Prisma, DTO Mappers, Health, Error)        | [✅ VERIFIED]
+-----------------------------------------------------------------------------------+
| Phase C: API Compatibility Gateway & Coexistence Middleware                       | [✅ VERIFIED]
+-----------------------------------------------------------------------------------+
| Phase 2.5: Infrastructure Verification Sprint & Evidence Capture                  | [✅ VERIFIED]
+-----------------------------------------------------------------------------------+
| Phase 3: Catalog, Metadata & Search Module                                       | [READY FOR VERIFIED MIGRATION]
+-----------------------------------------------------------------------------------+
| Phase 4: Multi-Branch Inventory Matrix Module                                     | [PENDING]
+-----------------------------------------------------------------------------------+
| Phase 5: Delivery Zones & Capacity Slots Module                                   | [PENDING]
+-----------------------------------------------------------------------------------+
| System Architecture & Framework Specifications                                   | [✅ COMPLETE]
+-----------------------------------------------------------------------------------+
| Migration Methodology & Operational Policies                                     | [✅ COMPLETE]
+-----------------------------------------------------------------------------------+
| Capability Delivery & Track Execution                                            | [🔄 IN PROGRESS]
+-----------------------------------------------------------------------------------+
| Production Validation & SLO Observation Windows                                  | [🔄 ONGOING]
+-----------------------------------------------------------------------------------+
```

---

## Status Breakdown

* **Complete (Specifications & Governance)**:
  * 23-Doc Specification Suite ([docs/00](file:///e:/vig/cakes2home-main/cakes2home-main/docs/00-project-overview.md) to [docs/23](file:///e:/vig/cakes2home-main/cakes2home-main/docs/23-verification-evidence.md)) + 10 ADR Records.
  * Express Enterprise Engine, API Gateway Middleware, and DTO Mappers.
  * Formalized 10-Step Release Cadence & 4 Execution Tracks.
* **In Progress (Capability Delivery)**:
  * Capabilities 3.1 (Product Listing) & 3.3 (Categories) implemented and verified.
* **Ongoing (Production Validation)**:
  * Observing SLO windows and performing capability rollouts across tracks.
* **Pending**:
  * Phases 4 through 11.
* **Blocked**:
  * None.

---

## Architectural Decisions Log (ADR)

| Decision ID | Date | Title | Context & Rationale | Status |
| :--- | :--- | :--- | :--- | :--- |
| **ADR-001** | 2026-07-30 | Migrate Medusa Backend to Enterprise Node.js / Express | To eliminate framework constraints, achieve clean architecture layer control, and enable high horizontal throughput. | **Accepted** |
| **ADR-002** | 2026-07-30 | Enforce Single Source of Truth Documentation System (`/docs/`) | Standardized `/docs/00` to `/docs/09` specifications to ensure architectural consistency across sessions. | **Accepted** |
| **ADR-003** | 2026-07-30 | Adopt Prisma ORM & PostgreSQL Row Locking | Provides typed queries and safe `$transaction` row locks (`SELECT FOR UPDATE`) for double-booking prevention. | **Accepted** |
| **ADR-004** | 2026-07-30 | Enforce Strict RESTful Naming (Zero Verbs in Paths) | Standardize HTTP endpoints using resource nouns and standard HTTP methods. | **Accepted** |

---

## Risk Matrix

| Risk | Impact | Mitigation Strategy |
| :--- | :--- | :--- |
| **Storefront Breakage** | High | Preserve existing client SDK request/response contract shape in Next.js storefront. |
| **Database Migration Data Loss** | Critical | Execute incremental migrations using Prisma Migrate with shadow databases and data backfills. |
| **Inventory Double Booking** | High | Retain atomic row locking (`SELECT FOR UPDATE`) during order placement. |

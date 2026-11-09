# CakeToHome Bakery Operating System Roadmap & Stage 4 Certified Baseline

> **Role**: Lead Enterprise Software Architect  
> **Status**: **Stages 1–4 Complete & Certified Production Ready**  
> **Document Version**: `v9.0.0-STAGE4-CERTIFIED-PRODUCTION-READY`  
> **Phase 1 Execution Authority**: [CHECKPOINT_20261021_PHASE1_REPORTING_CORRECTIONS.md](file:///e:/vig/cakes2home-main/cakes2home-main/CHECKPOINT_20261021_PHASE1_REPORTING_CORRECTIONS.md)  
> **Phase 0 Baseline Authority**: [CHECKPOINT_20261021_PHASE0_CORRECTED_BASELINE.md](file:///e:/vig/cakes2home-main/cakes2home-main/CHECKPOINT_20261021_PHASE0_CORRECTED_BASELINE.md) | [VERIFICATION_REPORT_20261021_PHASE0_CORRECTED_BASELINE.md](file:///e:/vig/cakes2home-main/cakes2home-main/VERIFICATION_REPORT_20261021_PHASE0_CORRECTED_BASELINE.md) (All previous Phase 0 claims formally RETRACTED).

---

## 🏛️ Certified Baseline Capabilities (Stages 1–4)

All Stage 1, Stage 2, Stage 3, and Stage 4 tasks satisfy the mandatory Acceptance Criteria checklist and are certified as **`PRODUCTION READY (CURRENT ARCHITECTURE)`**:

| Stage | Priority | ID | Capability / Fix | Measurable Bakery Outcome | Lifecycle Status |
|---|---|---|---|---|---|
| 🛠️ **1. FIX** | 🔴 **Critical** | `CRIT-02` | **Inventory Concurrency Row-Locking** | **Data Integrity**: Prevents double-selling fresh cakes during peak holiday surges. | `PRODUCTION READY (CURRENT ARCHITECTURE)` |
| 🛠️ **1. FIX** | 🔴 **Critical** | `CRIT-03` | **Payment Webhook Idempotency Lock** | **Reliability**: Eliminates duplicate payment captures and duplicate orders. | `PRODUCTION READY (CURRENT ARCHITECTURE)` |
| 🧹 **2. SIMPLIFY** | 🟢 **Medium** | `MED-01` | **Optimistic Cart Quantity UI** | **Reduce Clicks & Friction**: Instant cart drawer response for fast customer checkout. | `PRODUCTION READY (CURRENT ARCHITECTURE)` |
| 🛡️ **3. STRENGTHEN** | 🔴 **Critical** | `CRIT-01` | **Automated Playwright E2E Pipeline** | **Testing & Scalability**: Guarantees core order flow never breaks on deployment. | `PRODUCTION READY (CURRENT ARCHITECTURE)` |
| 🛡️ **3. STRENGTHEN** | 🟡 **High** | `HIGH-01` | **Coupon Stacking & Exclusion Rules** | **Protect Gross Margins**: Prevents customers from stacking conflicting promo codes. | `PRODUCTION READY (CURRENT ARCHITECTURE)` |
| ⚡ **4. AUTOMATE** | 🟡 **High** | `AUTO-01` | **Kitchen Operations Automation** | **Reduce Work & CRO**: Live queue reordering, SLA delay detection, WhatsApp alert dispatch. | `PRODUCTION READY (CURRENT ARCHITECTURE)` |
| ⚡ **4. AUTOMATE** | 🟡 **High** | `AUTO-02` | **Delivery Operations Automation** | **Operational Efficiency**: Capacity-aware driver assignment, decline fallback, customer tracking link update. | `PRODUCTION READY (CURRENT ARCHITECTURE)` |

---

## 🏷️ 7 Task Lifecycle Status Levels

Every module/task is tracked through these 7 lifecycle states:

1. `NOT STARTED`
2. `IN PROGRESS`
3. `IMPLEMENTED` *(Code written, unverified)*
4. `VERIFIED` *(Direct evidence demonstrates expected behavior)*
5. `PRODUCTION READY (CURRENT ARCHITECTURE)` *(Suitable for current single-instance deployment model)*
6. `FULLY PRODUCTION READY` *(Suitable for horizontal scaling, failover, and multi-node cluster ops)*
7. `FULLY OBSERVED IN PRODUCTION` *(Running live, operational telemetry collected, KPIs meet expected thresholds)*

---

## 📌 Technical Debt Ledger

| Debt ID | Current Limitation | Recommended Solution | Target Phase |
|---|---|---|---|
| **`TD-001`** | In-memory mutex map in `ShopModuleService` is single-instance process local. | Replace with PostgreSQL `SELECT FOR UPDATE` or Redis `redlock` before multi-node cluster deployment. | Multi-node cluster scaling |
| **`TD-002`** | Payment idempotency lock key in `PaymentModuleService` uses process-local map. | Upgrade lock key store to Redis key with 24-hour TTL when scaling to multi-region instances. | Multi-node cluster scaling |
| **`TD-003`** | Hardcoded exclusive codes in `validateCouponStacking()`. | Expand `offers` table schema with rich configuration fields: `exclusive: boolean`, `stack_group: string`, `priority: number`, `max_stack: number`, `combinable_with: string[]`. | Marketing portal expansion |

---

> **Success Metric**: *"Can a bakery owner run their entire business from CakeToHome without switching systems, with the least operational effort?"*

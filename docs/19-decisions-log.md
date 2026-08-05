# 19 — Decisions Log

## Chronological Index of Architecture Decisions (ADRs)

| ADR ID | Title | Status | Date |
| :--- | :--- | :--- | :--- |
| **[ADR-001](file:///e:/vig/cakes2home-main/cakes2home-main/docs/adr/ADR-001-node-runtime.md)** | Adoption of Node.js & Express.js Enterprise Runtime | Accepted | 2026-07-30 |
| **[ADR-002](file:///e:/vig/cakes2home-main/cakes2home-main/docs/adr/ADR-002-prisma.md)** | Adoption of Prisma ORM & PostgreSQL Database | Accepted | 2026-07-30 |
| **[ADR-003](file:///e:/vig/cakes2home-main/cakes2home-main/docs/adr/ADR-003-auth.md)** | Mobile Phone OTP & Role-Based JWT Authentication | Accepted | 2026-07-30 |
| **[ADR-004](file:///e:/vig/cakes2home-main/cakes2home-main/docs/adr/ADR-004-api.md)** | Strict RESTful Resource Naming (Zero Verbs in Paths) | Accepted | 2026-07-30 |
| **[ADR-005](file:///e:/vig/cakes2home-main/cakes2home-main/docs/adr/ADR-005-events.md)** | Event-Driven Architecture & Outbox Pattern | Accepted | 2026-07-30 |
| **[ADR-006](file:///e:/vig/cakes2home-main/cakes2home-main/docs/adr/ADR-006-caching.md)** | Redis Distributed Caching & Rate Limiting | Accepted | 2026-07-30 |
| **[ADR-007](file:///e:/vig/cakes2home-main/cakes2home-main/docs/adr/ADR-007-background-jobs.md)** | BullMQ Distributed Queue for Background Processing | Accepted | 2026-07-30 |
| **ADR-008** | 4-Tier Capability Maturity Model (Tier 1 Read-Only to Tier 3 Financial) | Accepted | 2026-07-30 |
| **ADR-009** | API Versioning & 6-Month Sunset Policy | Accepted | 2026-07-30 |
| **ADR-010** | Disaster Recovery RTO < 30s & RPO = 0 Blueprint | Accepted | 2026-07-30 |

---

## 🏷️ Governance Baseline Versioning Policy

* **Current Governance Specification**: 🏷️ **v1.0.0 (FROZEN)**.
* **Versioning Protocol**: Any future ADR modifying governance rules or baseline architectural specifications increments the minor or major version (e.g. `v1.1.0` or `v2.0.0`).
* **Audit Trail**: Every release metadata artifact links to the active Governance Baseline version.

---

## 🔒 3 Operating Rules for ADR-Based Change Management

1. **Baseline Freeze**: Specifications under `/docs/00` to `/docs/23` are baseline frozen documents. Structural evolution occurs strictly via new ADRs in `/docs/adr/ADR-[N].md`.
2. **DORA & Operational Metrics**: Framework effectiveness is measured via:
   * **Lead Time**: From Backlog to `Production Done`.
   * **Deployment Frequency**: Capability release velocity.
   * **Change Failure Rate**: Percentage of canary rollbacks.
   * **Mean Time to Recovery (MTTR)**: Automatic circuit breaker rollback duration ($<30\text{s}$).
3. **Operational Feedback Loop**: Insights from live capability execution feed back into ADRs rather than modifying baseline documents.

---

## 🗂️ 3-Tier Change Taxonomy & Exit Criteria

* **Category 1 (Feature Implementation)**: Standard 10-step Capability Release Cadence.
* **Category 2 (Operational Tuning)**: Dashboards, alerts, and runbooks tuning without baseline specification changes.
* **Category 3 (Structural Architecture)**: Formal ADR submission, review, and approval before implementation.

### Program Stage Exit Criteria:
* **Capability Delivery**: All 15 planned capabilities implemented.
* **Production Validation**: All capabilities satisfy Checkpoint 2 (Production Done).
* **Operational Optimization**: 99.9% SLO met, stable DORA metrics, zero Sev-1/Sev-2 issues.
* **ADR-Driven Evolution**: Used strictly when production evidence justifies architectural changes.

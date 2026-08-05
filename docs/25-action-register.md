# 25 — Operational Action & Risk Register

> [!NOTE]
> This is an **operational living document**. While baseline specifications (`/docs/00` to `/docs/23`) are frozen, this action and risk register tracks commitments and operational risks arising from weekly engineering and monthly architecture reviews.

---

## 📋 Action Register

| Action ID | Source Review | Owner | Due Date | Status | Target Capability | Related ADR | Action Description |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **ACT-001** | Weekly Review #01 | Catalog Team | 2026-08-05 | `In Progress` | `3.5` PDP | N/A | Add OpenAPI response schema for custom cake weight variants |
| **ACT-002** | Weekly Review #01 | Platform Team| 2026-08-10 | `Open` | `Platform` | ADR-006 | Wire Redis latency alert threshold in Prometheus exporter |

---

## 🚨 Risk Register

| Risk ID | Source Review | Risk Description | Severity | Mitigating Control | Status | Owner |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **RSK-001** | Architecture Review | High concurrency stock lock contention during flash sales | Medium | PostgreSQL `SELECT FOR UPDATE` row locks inside Prisma transactions | `Mitigated` | Commerce Team |

---

## 🎯 Action & Risk Lifecycle States

1. `Open`: Action/Risk logged during review; owner assigned.
2. `In Progress`: Active engineering work underway.
3. `Mitigated`: Compensating security/logging control active.
4. `Done`: Action item completed, verified, and closed.

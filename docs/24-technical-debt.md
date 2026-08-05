# 24 — Living Technical Debt Register

> [!NOTE]
> This is an **operational living document**. While baseline specifications (`/docs/00` to `/docs/23`) are frozen, this technical debt register is continuously updated as implementation compromises or performance optimization targets are identified during capability execution.

---

## 📋 Technical Debt Registry

| Debt ID | Capability ID | Risk Level | Owner | Business Impact | Proposed Remediation | Target Milestone | Current Status | Linked ADR | Date Identified | Next Review Date |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TD-001** | `3.1` | Low | Catalog Team | In-memory catalog repository fallback used during offline test mocks | Wire production PostgreSQL Prisma model queries | Stage 3 Validation | `Scheduled` | N/A | 2026-07-30 | 2026-08-15 |
| **TD-002** | `3.3` | Low | Catalog Team | Static category hierarchy fallback used in standalone dev mode | Connect nested category tree recursive query | Stage 3 Validation | `Scheduled` | N/A | 2026-07-30 | 2026-08-15 |
| **TD-003** | `1.1` | Medium | Auth Team | Static HMAC salt fallback used if `OTP_SECRET` env variable is missing | Enforce strict env boot check in production main.ts | Stage 2 Delivery | `Open` | N/A | 2026-07-30 | 2026-08-05 |

---

## ⚡ Technical Debt Service-Level Objectives (Debt SLOs)

To prevent debt accumulation, all items MUST satisfy target resolution timelines:

| Debt Risk Level | Target Review Window | Target Resolution Window | Escalation Policy |
| :--- | :--- | :--- | :--- |
| **High Risk** | Within **7 Days** | Before next production release milestone | **Mandatory Release Block** (Unless formal exception granted) |
| **Medium Risk** | Within **30 Days** | Within current or next program stage | Governance Exception Review |
| **Low Risk** | Next scheduled review | As engineering capacity permits | Periodic Triage |

---

## 🚨 Controlled Debt Exception Policy & Exception Budget

If a high-risk debt item cannot be resolved before a release milestone, a **Controlled Debt Exception** requires:

1. **Business Justification**: Documented operational reason for deferral.
2. **Mitigating Controls**: Compensating security, logging, or fallback guards active in production.
3. **Formal Approval**: Explicit sign-off from both Engineering Lead and Product Lead.
4. **Time-Bound Expiry**: Maximum exception duration of **14 days**.
5. **Automatic Re-Evaluation**: System automatically flags expired exceptions as critical release blockers.
6. **Exception Budget Guard**: Maximum **2 active high-risk exceptions** permitted simultaneously across the entire platform. Exceeding this budget requires Executive Architecture Board sign-off.
7. **Exception Burn Down Metric**: Tracked alongside DORA metrics to measure exception resolution velocity.

---

## ⏱️ Operational Review Cadence & 7-Point Dashboard Agenda

| Review Forum | Frequency | Target Operational Scope | Primary Review Artifact |
| :--- | :--- | :--- | :--- |
| **Weekly Engineering Review** | Every 7 Days | DORA metrics, Exception Burn-Down & Capability Velocity | [`verification/dashboard.json`](file:///e:/vig/cakes2home-main/cakes2home-main/verification/dashboard.json) |
| **Monthly Architecture Review**| Every 30 Days | Technical Debt SLO compliance, ADR proposals, and baseline performance | [`verification/dashboard.json`](file:///e:/vig/cakes2home-main/cakes2home-main/verification/dashboard.json) |

### Standard 7-Point Engineering Review Agenda:
1. **Capability Velocity**: Which capabilities moved to `Engineering Done` or `Production Done` this week?
2. **Blocker Analysis**: Which capabilities are currently blocked, and what is the root cause?
3. **Quality Gate Failure**: Did any unit, integration, contract, or 4/4 AST fitness checks fail?
4. **DORA Telemetry Trends**: Are Lead Time, Deployment Frequency, Change Failure Rate, and MTTR improving or regressing?
5. **SLO & Error Budgets**: Are 99.9% Uptime and P95 Latency SLAs compliant?
6. **Technical Debt Velocity**: Is technical debt decreasing within Debt SLO windows?
7. **ADR Justification**: Does empirical production evidence justify submitting a new formal ADR under `/docs/adr/`?

### 📋 3 Mandatory Review Outputs:
Every review MUST conclude with three explicit outputs recorded in meeting logs:
1. **Decisions**: Formal decisions agreed upon during the review.
2. **Actions**: Remediation tasks assigned with explicit owners and due dates.
3. **Risks**: Unresolved operational risks flagged for monitoring.

### Immediate Intervention Triggers (Emergency Review Required):
* 🚨 **Budget Violation**: Active high-risk debt exceptions exceed the platform limit ($> 2$).
* 🚨 **Exception Expiry**: Any high-risk exception exceeds its 14-day duration window.
* 🚨 **Flat Burn-Down**: Exception burn-down velocity remains $0$ over 2 consecutive weekly review cycles.

---

## 🎯 Technical Debt Lifecycle States

1. `Open`: Debt identified and registered; pending triage.
2. `Accepted`: Consciously accepted low-risk compromise for current phase.
3. `Scheduled`: Remediation task scheduled for specific target milestone.
4. `Exception`: Time-bound high-risk exception granted (max 14 days, max 2 active).
5. `Resolved`: Remediation completed, verified, and merged.

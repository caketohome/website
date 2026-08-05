# 10 — Testing Strategy & Quality Gates

## Test Pyramid & Coverage Target

```
                    / \
                   /   \  E2E / Playwright (Critical Journeys)
                  /-----\
                 /  API  \ Supertest HTTP Integration Tests
                /---------\
               /           \ Unit Tests (Services & Repositories)
              /-------------\
```

* **Coverage Threshold**: **80%+ test coverage** mandated on all domain services and repositories before merging into `main`.
* **Test Suites**:
  1. **Unit Tests (`*.unit.spec.ts`)**: Pure logic verification (Jest / Vitest).
  2. **Integration Tests (`*.integration.spec.ts`)**: Prisma database queries & repository logic against isolated test PostgreSQL instance.
  3. **API Tests (`*.api.spec.ts`)**: HTTP endpoints request/response envelope verification via Supertest.
  4. **E2E Tests**: Playwright browser automated testing covering customer checkout, OTP login, KDS order status updates, and driver job claims.

---

## 🎯 Two-Checkpoint Definition of Done

* **Checkpoint 1: Engineering Done**:
  * Code merged, **Risk-Based Test Coverage** ($\ge 90\%$ Critical Business Logic, $\ge 80\%$ Services), OpenAPI contract tests passing, Architecture Fitness passing (4/4 AST rules), Security review complete, P95 latency within SLA.
* **Checkpoint 2: Production Done**:
  * Shadow parity sustained ($\ge 99.9\%$), Canary promotion completed ($1\% \rightarrow 5\% \rightarrow 25\% \rightarrow 50\%$), SLO observation window passed without error budget loss, 1-Click Rollback verified, Operational scorecard finalized ([scorecard.json](file:///e:/vig/cakes2home-main/cakes2home-main/verification/cap-3.1/scorecard.json)), Capability manifest updated to 100% production traffic.

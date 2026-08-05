# 11 — Deployment & Infrastructure

## Infrastructure & Environment Promotion

```
[ Developer Local ] ──► [ QA Server ] ──► [ Staging Environment ] ──► [ Production Cluster ]
```

* **Containerization**: Docker multi-stage builds (`Dockerfile`) outputting lightweight Node.js production images (`node:20-alpine`).
* **Orchestration**: `docker-compose.yml` defining API container, PostgreSQL 16 database container, and Redis 7 cache container.
* **Environments**:
  1. `Development`: Local environment with dev OTP surfacing and debug logs.
  2. `QA`: Automated integration test runner.
  3. `Staging`: Production replica with staging payment gateways and live SMS stubs.
  4. `Production`: Production cluster with SSL, production database pools, and live gateway keys.

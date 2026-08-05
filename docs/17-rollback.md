# 17 — Database & Code Rollback Strategy

## Zero-Downtime Rollback Blueprint

### 1. Database Schema Rollback
* Database migrations are strictly additive (new columns nullable or defaulted).
* Down migrations are generated alongside every Prisma migration script (`prisma migrate diff --script`).
* Rolling back code does NOT require instant database schema revert, preserving data safety.

### 2. Code Deployment Rollback
* If HTTP error rates spike above 1% within 10 minutes post-deployment, the CI/CD pipeline triggers an automated container rollback to the previous Docker image SHA digest.
* API Gateway reroutes traffic to the previous healthy container instance.

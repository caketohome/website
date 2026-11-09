# Deployment Pipeline Security Audit

## 1. Pipeline Gate Enforcement
The deployment pipeline requires:
1. Migration Linter (`lint_migrations.cjs --remediated-baseline`) must exit with code 0.
2. Un-remediated baseline (missing c7_13) triggers non-zero exit code (1), halting CI.
3. TypeScript compilation (`tsc --noEmit`) must exit with code 0.
4. Database migrations must execute inside atomic transactions (`BEGIN ... COMMIT`).
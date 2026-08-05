# 16 — CI/CD Pipeline & Release Gates

## GitHub Actions Automated Pipeline

```
[ Git Push ] ──► [ Lint & Type Check ] ──► [ Unit & Integration Tests ] ──► [ Docker Build ] ──► [ Deploy ]
```

Every Pull Request must satisfy:
1. `npm run lint` & `tsc --noEmit` pass cleanly.
2. 100% test pass rate across Jest & Supertest integration suites.
3. Code coverage threshold $\ge 80\%$.
4. Clean Docker image build.

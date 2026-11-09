# Invoice Allocation Regression Audit Report

## 1. Regression Scenarios Executed
- `TEST-P44-ALLOC-01`: Revoked SAFE-TEST/PRT-8899 allocation rejected (**PASS**).
- `TEST-P44-ALLOC-02`: Unapproved PROPOSED-only allocation rejected (**PASS**).
- `TEST-P44-ALLOC-03`: Sequential allocation on approved series generates monotonic counter (**PASS**).
- `TEST-P44-ALLOC-04`: Format compliance: 16-character limit and Indian FY string (`ALxx/26-27/000x`) (**PASS**).
- `TEST-P44-ALLOC-05`: 5 concurrent simultaneous allocation requests with advisory locks produce gapless sequence (**PASS**).
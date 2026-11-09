# PHASE 6.1 — DATABASE VERIFICATION REPORT

### 1. Active Rehearsal Database (`cth_rehearsal_phase5`)
- **Port:** 5433
- **Total Tables:** 72 tables
- **Orders:** 165
- **Invoices:** 78
- **CoA Accounts:** 107
- **Trial Balance Equality:** Dr ₹1344610.40 == Cr ₹1344610.40 (Diff: ₹0.00)

### 2. Protected Baseline Database (`cth_test`)
- **Port:** 5433
- **Baseline Orders:** 127 | Verified: 127
- **Baseline Invoices:** 71 | Verified: 71
- **Baseline Payments:** 40 | Verified: 40
- **Writes Detected:** **0 (STRICT ZERO-WRITE INTEGRITY MAINTAINED)**

# Phase 4.6 and Phase 4.7 Claim Reconciliation

This audit cross-references the findings and claims reported in Phase 4.6 and Phase 4.7 against actual database and filesystem ground truth.

| Prior Phase Claim | Claimed Value | Actual Ground Truth | Variance / Audit Note |
|---|---|---|---|
| Synthetic Invoice Count | 13 synthetic invoices | **15 synthetic invoices** | Prior report undercounted CONC rows (14 CONC + 1 SAFE-TEST = 15). All 15 isolated. |
| Invoiced Orders Count | 58 invoiced orders | **58 invoiced orders** | 100% confirmed matching. |
| Delivered Unbilled Orders | 21 delivered unbilled | **21 delivered unbilled** | Confirmed: 18 validation scenario tests + 3 historical orders. |
| Unbilled Orders Total | 69 unbilled orders | **69 unbilled orders** | 100% confirmed matching. |
| CTH Sequence Rows | 55 persisted invoices | **55 persisted invoices** | Confirmed: sequence range 1 to 74 with 19 missing invoice rows. |
| CTH Allocation Log Rows | 63 allocation records | **63 allocation records** | Confirmed: 55 persisted + 8 allocation-only = 63. |
| CTH Sequence Gaps | 11 unallocated gaps | **11 unallocated gaps** | Confirmed: positions 52..62 jumped during test rollback. |
| Board Submission Status | Proposed | **PROPOSED_FOR_BOARD_CONSIDERATION** | Confirmed: No adopted Board resolution exists. |

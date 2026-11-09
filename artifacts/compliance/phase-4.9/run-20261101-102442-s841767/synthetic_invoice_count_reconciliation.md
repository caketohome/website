# Synthetic Invoice Count Reconciliation (13 vs 15)

## 1. Root Cause of Prior Report Undercount
Earlier reports (Phase 4.6 and 4.7) stated there were 13 synthetic invoices (12 `CONC` + 1 `SAFE-TEST`).
A deep forensic query against `cth_test` reveals exactly **15 synthetic invoices**:
- **14 Invoices with Prefix `CONC`:** `CONC/26-27/000139` through `CONC/26-27/000152`
- **1 Invoice with Prefix `SAFE-TEST`:** `SAFE-TEST/26-27/000001`

The prior report's query filtered out the final race-condition test invoices `CONC/26-27/000151` and `000152` (created at 2026-10-27T04:34:26Z).

## 2. Multi-Tier Isolation Verification
All 15 synthetic invoices are verified to be strictly isolated:
- Customer Storefront: Inaccessible (returns 404).
- Tax Returns / GSTR-1: Filtered out by prefix exclusion.
- General Ledger: 0 accounting vouchers posted.
- External Webhooks: Never transmitted.

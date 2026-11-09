# Unresolved Delivered Order Investigation (21 Orders)

## 1. Forensic Categorization of the 21 Delivered Unbilled Orders

The 21 delivered orders without invoices fall cleanly into two distinct forensic categories:

### Category A: Validation Scenario Test Orders (18 Orders)
- **Order Identifiers:** `ord_case_*`, `ord_test_scen_*`, `ord_bad_*`, `order_preservation_*`
- **Origin:** Synthetic test harnesses created during QA testing to validate edge cases (missing seller GSTIN, invalid item rates, zero amounts).
- **Statutory Status:** **VOID / TEST DATA**. No real supply of goods occurred. No real tax liability exists.

### Category B: Non-Scenario Historical Records (3 Orders)
- **Order 1:** `ord_persist_1792703206362` (₹1,450.50, created 2026-10-22, paid online, `seller_gstin` NULL)
- **Order 2:** `ord_test9_1792703331575` (₹1,450.50, created 2026-10-22, paid online, `seller_gstin` NULL)
- **Order 3:** `ord_committed_valid_test` (₹1,800.00, created 2026-10-25, paid online, customer: Ananya Iyer, seller: CakeToHome Retail India Pvt Ltd `29AAACC1234F1Z5`)

## 2. Statutory Treatment Recommendation
1. For Category A (18 orders): Retain as historical QA artifact; flag as `TEST_VALIDATION`.
2. For Category B (3 orders): Submit to Chartered Accountant for formal review. No customer complaints or delivery PODs exist on file. CA should recommend writing off or issuing supplementary invoices if deemed legitimate historical supply.

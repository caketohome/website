# Delivered Order Classification Reconciliation (16 vs 18 vs 3)

## 1. Census of 21 Delivered Unbilled Orders
Querying `public.order WHERE status = 'delivered' AND id NOT IN (SELECT order_id FROM public.invoice)` returns exactly **21 orders**.

## 2. Resolution of the 16 vs 18 Test Order Discrepancy
Earlier reports categorized 16 as test scenarios and 5 as historical orders.
Detailed inspection of the 5 orders revealed that 2 (`ord_erp_invalid_items_*` and `order_preservation_*`) were created by the ERP validation test runner.
Thus, exactly **18 orders are validation scenario test records** (void, synthetic).

## 3. The 3 Historical Non-Scenario Orders
Exactly 3 orders are genuine/potentially genuine historical records:
1. `ord_persist_1792703206362` (₹1,450.50, paid online, `seller_gstin` NULL)
2. `ord_test9_1792703331575` (₹1,450.50, paid online, `seller_gstin` NULL)
3. `ord_committed_valid_test` (₹1,800.00, customer: Ananya Iyer, seller: CakeToHome Retail India Private Limited `29AAACC1234F1Z5`)

**Action:** Submitted to Chartered Accountant for formal review and write-off.

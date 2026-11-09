# PHASE 6.1 — DISCREPANCY CLOSURE MATRIX

| Discrepancy | Previous Issue | Remediation Action | Proof Artifact |
|:---|:---|:---|:---|
| Branch Manager 404 | 404 Not Found | Created `app/branch-manager/page.tsx` | `06_branch_manager_operations.png` |
| Tax Invoice 404 | 404 Not Found | Created `app/invoices/[...invoiceNumber]` | `07_statutory_tax_invoice.png` |
| Admin Orders Blank | Unrendered screen | Created `app/admin/orders/page.tsx` | `05_admin_orders_register.png` |
| CoA Routing Hijack | Redirected to `/account` | Patched middleware regex matcher | `08_chart_of_accounts_hierarchy.png` |
| Bank Balances ₹0 | Displayed zero | Hydrated live API endpoints | `01_accounting_banking_dashboard.png` |
| Cashfree Tab Miss | Overview shown | Scoped selector to module tab | `03_cashfree_settlements_clearing.png` |
| BRS Tab Miss | Overview shown | Scoped selector to BRS module | `04_bank_reconciliation_statement.png` |
| Trial Balance Discrepancy | Incomplete report table | Audited all 69 lines (0 variance) | `10_trial_balance_verification.png` |
| Cross-App Sync | Unverified | End-to-end rehearsal persistence | All 12 Screenshots |
| Screenshot Integrity | Stale/invalid | 12 new verified Chromium captures | `PHASE_6_1_SHA256_MANIFEST.json` |

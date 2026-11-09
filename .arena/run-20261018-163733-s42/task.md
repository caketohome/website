# CakeToHome ERP — Phase 7: Full ERP Audit, End-to-End Regression & Release-Gate Assessment

## Objective
Audit the entire CakeToHome ERP across all operational domains:
1. Storefront & Checkout (Canonical Cart, Pricing, Snapshots, Order Lines).
2. Product & PIM Lifecycle (Bakery Made-to-order cakes vs Physical stocked accessories, Tax Master mapping, SKU/Barcode consistency).
3. Branch Manager Cash Operations & Custody (Expected cash, shift handovers, teller drawer session, fail-closed overdraft guard).
4. Invoices, Subledgers & AP/AR Integration (Statutory sales invoicing, PO-GRN-AP matching, supplier tranches, customer payment allocation).
5. Expenses & Bank Reconciliation (Two-tier SoD, cash drawer payment, bank deposit slips, transit vouchers).
6. Financial Integrity & General Ledger (Double-entry equilibrium Dr === Cr, Suspense Account 1119 = 0, immutable historical SoD vouchers).
7. Access Control, Branch Isolation & Security (Server-side RBAC, cross-branch rejection, tamper prevention).
8. Real Browser Verification & Release Gate Assessment (Playwright/Chromium live tests, console errors, network inspection, persistence in PostgreSQL).

## Evaluation Criteria
- Strictly PostgreSQL as the sole source of truth.
- Zero unauthorized mutations of historical financial records (Account 1114 petty cash -₹200, Account 1122 undeposited COD -₹2,450, Account 1121 AR ₹2,000, 5 quarantined prototype invoices).
- Zero TypeScript errors.
- Real browser and API verification with empirical proof.

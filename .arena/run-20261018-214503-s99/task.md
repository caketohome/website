# Task: CakeToHome ERP — Forensic System-Wide Debugging, 404 Investigation, All-Role E2E Testing & Database Synchronization Repair

## Mission & Scope
The application has observed defects:
1. Multiple pages return 404 errors.
2. Interactive controls (switches, buttons, toggles, forms, selectors) are broken or do not synchronize.
3. Not all user roles and workflows have been tested in real browser sessions.
4. Branches, products, orders, and operational records do not synchronize correctly across UI, API, and PostgreSQL.
5. Inconsistencies exist between database relationships, API responses, and UI state.
6. Real-world browser behavior contradicts previously published green reports.

The mission is to diagnose the actual application, reproduce failures in Playwright/Chromium, trace root causes, apply authorized architectural fixes, verify database persistence in PostgreSQL, and provide verifiable evidence.

## Mandatory Competitor Requirements
1. **Forensic 404 Diagnosis & Routing Recovery**:
   - Discover all Next.js App Router routes, navigation links, and API handlers.
   - Test every route in a real Playwright/Chromium browser and record every 404.
   - Differentiate genuine missing routes from 401/403/redirects/bad params.
   - Resolve routing/link mismatches without blanket 200 fallbacks or catch-all redirects.

2. **UI Control & Switch Verification**:
   - Discover every rendered interactive control (switches, toggles, buttons, forms, dropdowns).
   - Verify callback execution, API requests, state toggles (ON/OFF), reload persistence, and authorization.

3. **All-Role End-to-End Testing**:
   - Test all 9 roles: Super Admin, Internal Admin, Finance Controller, Branch Manager, Branch Staff, Delivery Partner, Delivery Manager, Planner, Customer.
   - Verify role-specific landing pages, accessible navigation, branch/partner isolation, and privilege escalation guards.

4. **Database Synchronization Repair**:
   - PostgreSQL 17.6 is the sole source of truth.
   - Trace entities: Browser -> API -> Domain Service -> Repository -> PostgreSQL.
   - Fix synchronization across Branches, Products & Inventory, Orders, Customers, and Partners.
   - Verify schema constraints, foreign keys, and transaction integrity.

5. **Financial Integrity & Domain Safeguards**:
   - Preserve double-entry equilibrium (Debits === Credits === ₹14,625.00).
   - Zero unauthorized modifications to historical vouchers or quarantined invoices 31-35.
   - Preserve Tax Master statutory tax snapshots and cash custody balances.

6. **Deliverables**:
   - Complete 404 and routing defect report.
   - Control-by-control UI test inventory.
   - Complete role and permission test matrix.
   - Branch/product/order synchronization report.
   - Reproducible defect register with root causes and fixes.
   - Playwright test evidence and independent PostgreSQL verification.

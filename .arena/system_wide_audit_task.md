# Task: CakeToHome ERP — Complete System-Wide Functional Audit, All Roles, All Features, Browser E2E & Independent Verification

## Mission & Scope
Perform an exhaustive system-wide audit and verification of the entire CakeToHome ERP application across every discoverable role, feature, route, API, user role, permission, partner workflow, form, button, table, filter, search, dashboard, report, status transition, integration, and persisted PostgreSQL business operation.
The scope encompasses the entire system, not only Phase 7 or previously tested workflows:
1. Platform Owner / Super Admin
2. Internal Administrators and Finance Users
3. Branch Manager (Indiranagar, Koramangala, etc.)
4. Branch Staff and Operational Employees
5. Customers (Storefront, PDP, Cart, Checkout, Profile, Orders, Notifications)
6. Delivery Partners (Onboarding, Shifts, Task allocation, Deliveries, Proof of Delivery OTP, COD Handovers)
7. Delivery Partner Managers, Dispatchers, and other configured partner roles
8. Planner / Planning Users (Order planning, slot checks, capacity allocation, batch routing)
9. Configured vendor, supplier, purchase, inventory, sales, warehouse, or other partner roles
10. Any additional roles, permissions, modules, or user types discovered in the repository and database.

## Critical Invariants & Governance
1. Authoritative Source of Truth: PostgreSQL is the single source of truth. Verify the entire chain: Browser -> API -> Domain Service -> Repository -> PostgreSQL.
2. Mandatory Skills Applied: Smart Coder, Lazy Coder, PostgreSQL / Supabase, Clean Architecture, Security Auditing / OWASP, Playwright / QA Automation, Systematic Debugging.
3. Preserve Financial Safeguards: Double-entry equilibrium (Debits == Credits == ₹14,925.00), Suspense Account (1119) == ₹0.00, preserve Account 1111 (+₹4,675.00), Account 1114 (-₹200.00), Account 1122 (-₹2,450.00), Account 1121 (+₹2,000.00), and Quarantined Invoices 31-35. Zero unapproved adjustments.
4. Test Every Role Independently: Auth matrix, valid/invalid sessions, role dashboards, representative unauthorized attempts, branch/partner isolation, horizontal/vertical privilege escalation tests.
5. Real Browser E2E Automation: Playwright across desktop (1920x1080), tablet (768x1024), and mobile (375x667) viewports with actual screenshots and zero console errors.
6. Traceable Deliverables: Produce complete inventory, role-feature matrix, browser E2E report, API & persistence report, security & auth report, financial integrity report, defect register, checkpoints, and roadmap updates.

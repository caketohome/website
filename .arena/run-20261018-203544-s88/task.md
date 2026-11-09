# Task: CakeToHome ERP — Deep Browser Forensics, 404 Investigation, All-Role Functional QA and Complete Interactive Control Verification

## Objective
Conduct a browser-first, forensic investigation of the live CakeToHome ERP application. Identify the root cause of every reproducible 404, broken route, failed API request, non-functional button, switch, toggle, form, workflow, permission boundary, and incorrect persisted state across all 9 roles. Then fix authorized defects, rerun workflows in Chromium, and verify persistence in PostgreSQL.

## Target Application & Constraints
- Frontend: Next.js 14 App Router on `http://localhost:3001`
- Database: Supabase PostgreSQL 17.6 pooler (`aws-1-ap-south-1.pooler.supabase.com:6543/postgres`)
- Financial safeguards: Double-entry equilibrium must hold, no unapproved adjustments, preserve quarantined invoices 31-35, preserve negative balances in accounts 1114/1122.
- Testing Requirement: Browser automation (Playwright/Chromium) with real network capture and database assertion. No static-only claims.

## Required Deliverables
1. Root cause taxonomy of all 404s and broken API routes.
2. Complete Route & 404 Ledger (`COMPLETE_ROUTE_404_LEDGER.md`).
3. Complete Interactive Control Ledger (`COMPLETE_INTERACTIVE_CONTROL_LEDGER.md`).
4. All-Role Functional QA Matrix (9 roles).
5. Defect fixes in Next.js routes/pages and verification via automated tests and PostgreSQL query logs.

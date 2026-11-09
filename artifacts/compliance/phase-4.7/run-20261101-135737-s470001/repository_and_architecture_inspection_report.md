# Repository and Architecture Inspection Report
**Repository:** `e:/vig/cakes2home-main/cakes2home-main`  
**Git HEAD:** `d231cee7e55f716526e62f5799cc7377c555fed3`  
**Branch:** `checkpoint/c-phases-baseline`  
**Environment:** Windows Server / Embedded PostgreSQL 16.14 on port 5433  

## 1. Architecture Summary
- **Frontend / Full-Stack:** Next.js 14 App Router, React 18, TypeScript, Tailwind CSS.
- **Backend Services:** `frontend/src/lib/services/`:
  - `DeliveryInvoicingService`: Core invoice creation and lifecycle coordinator.
  - `OrderService`: Order placement and financial totals calculator.
  - `AccountsReceivableService`: Ledger postings and AR tracking.
- **Database Architecture:** PostgreSQL 16.14 with schemas `public`.
  - `public.order`: 127 customer orders.
  - `public.invoice`: 71 historical invoices.
  - `public.invoice_sequence`: Sequences per prefix, entity, and fiscal year.
  - `public.invoice_allocation_log`: Audit log of all sequence allocations.
  - `public.accounting_voucher`: 4 journal vouchers.

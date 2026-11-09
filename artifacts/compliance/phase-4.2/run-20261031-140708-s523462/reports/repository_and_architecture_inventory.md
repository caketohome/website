# Repository and Architecture Inventory — Phase 4.2 Independent Forensic Audit

## 1. Repository & Execution Environment Baseline

| Attribute | Verified Value | Evidence Source |
| :--- | :--- | :--- |
| **Repository Path** | `e:/vig/cakes2home-main/cakes2home-main` | Local working tree verification |
| **Git Baseline Commit** | `d231cee7e55f716526e62f5799cc7377c555fed3` | `git rev-parse HEAD` |
| **Git Branch** | `checkpoint/c-phases-baseline` | `git branch -a` |
| **Commit Message** | `feat(delivery): wire platform delivery bridges, customer receipts, and gateway settlements for Phase 5C` | `git log -n 1 --oneline` |
| **PostgreSQL Version** | PostgreSQL 16.14 (Visual C++ build 1944, 64-bit) | `SELECT version()` |
| **PostgreSQL Daemon** | Port 5433 (PID running via `@embedded-postgres`) | Task `task-661` |
| **Protected Database** | `cth_test` (Host: 127.0.0.1:5433, User: `cth_test_user`) | Read-only connection verification |
| **Disposable Test Database** | `cth_disposable_phase4_2` (Host: 127.0.0.1:5433, User: `cth_test_user`) | Cloned from `cth_test` template |
| **Node.js Runtime** | Node.js v24.12.0 | `node --version` |
| **Arena Tournament Run ID** | `run-20261031-140708-s523462` | `.arena/run-20261031-140708-s523462/arena.json` |
| **Arena Winning Strategy** | Candidate `a004` (Decomposition + Write, then restructure + Maximal rigour) | 99.15/100 Champion score |

---

## 2. End-to-End Invoicing Architecture Map

The statutory tax invoicing pipeline traverses the following authoritative execution stages:

```
[Customer Checkout / Order Delivery Event]
                  │
                  ▼
       Order Status Transition ('delivered')
                  │
                  ▼
 [DeliveryInvoicingService.generateInvoiceOnDelivery]
                  │
   ├─► Idempotency Check 1: In-memory & DB check (public.invoice WHERE order_id = $1)
   ├─► Pre-allocation Guard: Line item count > 0 & HSN classification regex (/^[0-9]{4,8}$/)
   ├─► Seller Context Resolution: branch -> company_id + gst_registration_id
   ├─► Dynamic Fiscal Year: resolveIndianFiscalYear(issueDate) -> Asia/Kolkata
   └─► Statutory Series Lookup: public.invoice_sequence WHERE gstin=$1 AND fy=$2 AND status='APPROVED' AND is_active=true
                  │
                  ▼
 [PostgreSQL Stored Procedure: public.allocate_invoice_number]
                  │
   ├─► SET search_path TO 'public', 'pg_temp'; SECURITY DEFINER
   ├─► Statutory Prefix & 15-char GSTIN regex validation
   ├─► Concurrency Advisory Lock: pg_advisory_xact_lock(hashtext(entity_id || '::' || prefix || '::' || fy)::bigint)
   ├─► Idempotency Check 2: public.invoice_allocation_log for order_id -> return existing without burning sequence
   ├─► Scope Conflict Guard: Verify prefix in FY is not bound to a different GSTIN
   ├─► Approval & Active Status Guard: approval_status = 'APPROVED' AND is_active = true
   ├─► Monotonic Sequence Increment: UPDATE public.invoice_sequence SET last_seq = last_seq + 1 ... RETURNING last_seq
   └─► Audit Persistence: INSERT INTO public.invoice_allocation_log (status='ALLOCATED')
                  │
                  ▼
   Invoice Persistence (INSERT INTO public.invoice)
                  │
                  ▼
   Order-Invoice Association (order.invoice_number, order.invoice_id)
                  │
                  ▼
   Audit Commit (SELECT public.commit_invoice_allocation(order_id, invoice_id))
                  │
                  ▼
   API Response / Client Notification
```

---

## 3. Data Ownership & Authoritative Sources of Truth

| Data Element | Authoritative Source of Truth | Verification Status |
| :--- | :--- | :---: |
| **Legal Entity Identity** | `public.company` (`legal_name`, `cin`, `pan`, `is_active`) | VERIFIED PASS |
| **GST Registration** | `public.gst_registration` (`gstin`, `state_code`, `company_id`, `is_active`) | VERIFIED PASS |
| **Branch Seller Context** | Foreign keys `public.branch.company_id` and `public.branch.gst_registration_id` | VERIFIED PASS |
| **Invoice-Series Prefix** | Persisted row in `public.invoice_sequence` (`approval_status = 'APPROVED'`, `is_active = true`) | VERIFIED PASS |
| **Statutory Fiscal Year** | Interpreted via `resolveIndianFiscalYear` in `Asia/Kolkata` time zone | VERIFIED PASS |
| **Sequence Counter** | Transactionally serialized `public.invoice_sequence.last_seq` protected by `pg_advisory_xact_lock` | VERIFIED PASS |
| **Order Allocation State** | `public.invoice.order_id` unique constraint & `public.invoice_allocation_log` | VERIFIED PASS |
| **Approver Identity** | Authenticated session token `userCtx.userId` captured server-side upon approval | VERIFIED PASS |
| **Invoice Number** | Formatted statutory string: `{prefix}/{YY-YY}/{000000}` | VERIFIED PASS |

---

## 4. Subsystems and Service Boundaries

1. **Retail Delivery Invoicing (`DeliveryInvoicingService`)**:
   - Authoritative location: [`frontend/src/lib/services/delivery-invoicing.service.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/delivery-invoicing.service.ts).
   - Fully database-driven. Dynamic seller resolution, fail-closed series verification, idempotent replay, and single sequence authority.
2. **Corporate Invoicing (`BillsReceivableService`)**:
   - Authoritative location: [`frontend/src/lib/services/bills-receivable.service.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/bills-receivable.service.ts).
   - Audited in Phase 4.2: Identified legacy hardcoded `"CTH"` call; remediated to dynamically resolve approved series for `branchGstin` and `fiscalYear`, failing closed with `UNAUTHORIZED_INVOICE_SERIES` if no approved series exists.
3. **Statutory Sequence Allocator (`public.allocate_invoice_number`)**:
   - Authoritative definition: [`frontend/src/lib/migrations/c7_12_database_driven_gst_and_invoice_series.sql`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/migrations/c7_12_database_driven_gst_and_invoice_series.sql#L56-L180).
   - Enforces CGST Rule 46 fail-closed guarantees at the PostgreSQL engine level.
4. **Admin Statutory Compliance API**:
   - Authoritative routes in [`frontend/src/app/api/v1/[...path]/route.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/app/api/v1/[...path]/route.ts):
     - `GET admin/compliance/legal-entities`
     - `GET admin/compliance/invoice-series`
     - `POST admin/compliance/invoice-series/propose`
     - `POST admin/compliance/invoice-series/approve`
5. **Admin Statutory Compliance UI**:
   - Authoritative component: [`frontend/src/components/dashboard/admin/compliance/invoice-billing-tab.tsx`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/components/dashboard/admin/compliance/invoice-billing-tab.tsx).


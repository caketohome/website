# Invoice Number Generation Path Inventory
**Application:** CakeToHome Fullstack Next.js / PostgreSQL  

---

## 1. Single Authoritative Generation Authority
All invoice number allocations in CakeToHome route through a single, centralized database authority:
- **PostgreSQL Stored Procedure:** `public.allocate_invoice_number(p_prefix, p_order_id, p_entity_id, p_gstin, p_issue_date)`
- **Security Context:** `SECURITY DEFINER`, `SET search_path TO 'public', 'pg_temp'`.
- **Locking:** Explicit `pg_advisory_xact_lock` per `(entity_id, prefix, fiscal_year)`.

## 2. Inbound Caller Inventory

| Service / Module | File Path | Call Site | Trigger Condition |
| :--- | :--- | :--- | :--- |
| **Delivery Invoicing Service** | `frontend/src/lib/services/delivery-invoicing.service.ts` | Line 639 | Customer Order status transitions to `DELIVERED` |
| **Bills Receivable Service** | `frontend/src/lib/services/bills-receivable.service.ts` | Line 1079 | Corporate Billing Invoice Generation |

No frontend UI component, background worker, or PDF generator generates invoice serial numbers independently.

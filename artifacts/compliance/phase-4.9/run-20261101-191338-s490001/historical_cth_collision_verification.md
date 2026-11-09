# Historical CTH Collision Verification Report — Phase 4.9
**Target Collision:** Record `inv_1792901376459_xlxkf` in `public.invoice`  

---

## 1. Physical Database Proof
- **Record ID:** `inv_1792901376459_xlxkf`
- **Invoice Number:** `CTH/26-27/000001`
- **Supplier GSTIN:** `29AAACC1234F1Z5` (Historical dummy staging GSTIN)
- **Constraint:** `invoice_invoice_number_key` (UNIQUE constraint on `invoice_number`)

## 2. SQL Reproduction in Rehearsal Database
```sql
INSERT INTO public.invoice (id, invoice_number, status, invoice_type, issue_date, supplier_gstin, customer_name, total_amount, total_tax, created_at, updated_at)
VALUES ('inv_test_collision', 'CTH/26-27/000001', 'draft', 'tax_invoice', CURRENT_DATE, '29AABCC1234F1Z5', 'Test', 100, 18, NOW(), NOW());
-- ERROR: duplicate key value violates unique constraint "invoice_invoice_number_key"
-- DETAIL: Key (invoice_number)=(CTH/26-27/000001) already exists.
-- SQLSTATE: 23505
```
This proves conclusively that prefix `CTH` cannot be used for production without breaking relational integrity.

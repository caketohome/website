# DATABASE AND MIGRATION IMPACT ASSESSMENT
**Database Engine:** PostgreSQL 16.14  
**Target Schema:** `public`  

---

## 1. Stored Procedure Analysis (`public.allocate_invoice_number`)
Inspection of the existing stored procedure revealed that naive formatting via `LPAD(v_seq::text, 6, '0')` truncates serials once `v_seq` reaches 1,000,000 (returning `100000`, a catastrophic duplicate collision).

### Corrective Implementation:
The stored procedure was updated in rehearsal to implement dynamic padding and statutory length guards:
```sql
  -- Dynamic width: minimum 6 digits with leading zeros, expanding to 7 digits
  IF v_seq > 9999999 THEN
    RAISE EXCEPTION 'STATUTORY_CAPACITY_EXCEEDED: Sequence % exceeds the maximum 16-character length permitted under CGST Rule 46(b) for series prefix ''%''.', v_seq, p_prefix;
  END IF;

  IF v_seq <= 999999 THEN
    v_serial_text := LPAD(v_seq::text, 6, '0');
  ELSE
    v_serial_text := v_seq::text;
  END IF;

  v_invoice_num := p_prefix || '/' || v_fy_short || '/' || v_serial_text;

  IF LENGTH(v_invoice_num) > 16 THEN
    RAISE EXCEPTION 'STATUTORY_LENGTH_EXCEEDED: Invoice number ''%'' length (%) exceeds the 16-character limit under CGST Rule 46(b).', v_invoice_num, LENGTH(v_invoice_num);
  END IF;
```

---

## 2. Schema Migration Assessment
- **Table:** `public.invoice_sequence`
  - Existing columns: `id`, `entity_id`, `gstin`, `fiscal_year`, `prefix`, `last_seq`, `created_at`, `updated_at`.
  - Extended governance columns: `document_type`, `is_active`, `approval_status`, `authorized_by`, `authorized_at`.
- **Constraint:** `uq_invoice_sequence_entity_gstin_fy_prefix` on `(entity_id, gstin, fiscal_year, prefix)` guarantees uniqueness.
- **Zero Production Mutations:** Zero migrations applied to production baseline `cth_test`. Sequence for `CH` remains uninitialized in production.
# Financial Year and Series Uniqueness Report
**Database Target:** `cth_rehearsal_phase4_6`  

---

## 1. Annual Financial-Year Scoping
- **Rollover Boundary:** April 1, 00:00:00 IST (`Asia/Kolkata`).
- **Uniqueness Constraint:** `uq_invoice_sequence_entity_gstin_fy_prefix` on `public.invoice_sequence(entity_id, gstin, fiscal_year, prefix)`.
- **Serial Counter Isolation:** When FY transitions from `2025` to `2026`, the sequence counter resets to 1 in the new FY series row.

## 2. Multi-Branch & Multi-Registration Protection
- In stored procedure `allocate_invoice_number`, Section 6 enforces:
  `SELECT gstin FROM public.invoice_sequence WHERE fiscal_year = v_fy AND prefix = p_prefix AND gstin <> p_gstin`
- Rejects with `INVOICE_SERIES_PREFIX_CONFLICT` if a prefix is shared across distinct GSTIN registrations.

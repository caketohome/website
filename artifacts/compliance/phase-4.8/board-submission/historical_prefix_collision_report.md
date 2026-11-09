# HISTORICAL PREFIX COLLISION REPORT
**Database Target:** `public.invoice`  
**Constraint:** `invoice_invoice_number_key` (`UNIQUE (invoice_number)`)  

## Collision Forensic Finding
- Record `inv_1792901376459_xlxkf` exists in `public.invoice` with `invoice_number = 'CTH/26-27/000001'`.
- Seller GSTIN: `29AAACC1234F1Z5` (predecessor retail entity).
- Inserting `CTH/26-27/000001` for `29AABCC1234F1Z5` causes PostgreSQL error:
  `duplicate key value violates unique constraint "invoice_invoice_number_key" (SQLSTATE 23505)`.

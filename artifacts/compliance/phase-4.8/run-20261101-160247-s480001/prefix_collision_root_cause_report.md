# Prefix Collision Root Cause Report
**Investigated Object:** `public.invoice.invoice_number`  
**Constraint:** `invoice_invoice_number_key`  

## Root Cause
- Historical invoice `inv_1792901376459_xlxkf` holds serial `CTH/26-27/000001` under previous entity GSTIN `29AAACC1234F1Z5`.
- PostgreSQL enforces table-wide uniqueness. Attempting to issue `CTH/26-27/000001` for new entity `29AABCC1234F1Z5` raises SQLSTATE 23505.

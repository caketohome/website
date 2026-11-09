# Historical Collision Forensic Audit
Analysis of historical invoice `inv_1792901376459_xlxkf`:
- Consumed: `CTH/26-27/000001`
- Dummy GSTIN: `29AAACC1234F1Z5`
- Database Constraint: `invoice_invoice_number_key` enforces uniqueness across all supplier GSTINs.
- Collision confirmed in rehearsal with error `SQLSTATE 23505`.
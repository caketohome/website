# Historical CTH Entity Conflict Investigation
**Entity 1 (Historical):** CakeToHome Retail India Private Limited (GSTIN: `29AAACC1234F1Z5`)  
**Entity 2 (Operating):** CakeToHome India Private Limited (GSTIN: `29AABCC1234F1Z5`)  

### 1. Database Evidence
- In `cth_test`, `public.invoice_sequence` has row:
  - `entity_id: CAKETOHOME_PARENT`
  - `gstin: 29AAACC1234F1Z5`
  - `prefix: CTH`
  - `last_seq: 74`
- `public.invoice` contains 55 rows with `invoice_number` matching `CTH/26-27/000001` through `CTH/26-27/000074`.
- `public.invoice` enforces `invoice_invoice_number_key UNIQUE (invoice_number)`.

### 2. The Conflict & Collision Proof
When an insertion was simulated for `29AABCC1234F1Z5` with `CTH/26-27/000001`, PostgreSQL raised:
`duplicate key value violates unique constraint "invoice_invoice_number_key"` (SQLSTATE 23505).

### 3. Conflict Resolution Paths
- **Path 1 (Clean Distinct Prefix):** Adopt `CTHI` or `C2H`. Completely avoids table collision, preserves historical audit records, allows consecutive sequence starting from 1.
- **Path 2 (Sequence Offset):** Start `CTH` sequence at 75 for `29AABCC1234F1Z5`. Skips 1-74, creating audit questions regarding initial sequence numbering.
- **Path 3 (Schema Partitioning):** Drop table-wide uniqueness in favor of composite `(seller_gstin, invoice_number)`. Prohibited during release freeze without re-architecting constraints.

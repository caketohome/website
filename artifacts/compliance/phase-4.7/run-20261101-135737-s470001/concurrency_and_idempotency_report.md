# Concurrency and Idempotency Report
**Function:** `public.allocate_invoice_number`  
**Locking Mechanism:** `SELECT ... FOR UPDATE` on `public.invoice_sequence`  

## Verification
- Concurrent allocation test: Simulates parallel requests against test series; zero duplicate serial numbers allocated.
- Idempotency test: Re-requesting invoice allocation for existing order returns identical invoice number with `idempotent_replay = true`.
- Zero database gaps or orphaned sequence increments.

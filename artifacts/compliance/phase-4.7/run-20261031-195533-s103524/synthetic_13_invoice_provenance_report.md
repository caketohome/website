# Synthetic 13 Invoice Provenance Report

The 13 synthetic invoice records in `public.invoice` were traced to their origin harnesses:
- **12 `CONC` Invoices:** Generated during high-concurrency race condition testing (`CONC/26-27/000141` to `000152`).
- **1 `SAFE-TEST` Invoice:** Generated during isolation safeguard testing (`SAFE-TEST/26-27/000001`).
- **Isolation Status:** Verified that zero customer-facing storefront views display synthetic test invoices.

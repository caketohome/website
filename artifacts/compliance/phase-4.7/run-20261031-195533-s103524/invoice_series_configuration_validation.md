# Invoice Series Configuration Validation
**Target Database:** `cth_rehearsal_phase4_7`  

- Validated schema constraints on `invoice_sequence`:
  - `prefix` matches `^[A-Z0-9-]{2,10}$`.
  - `status` in (`DRAFT`, `APPROVED`, `REVOKED_SYNTHETIC`, `DECOMMISSIONED`).
  - Triggers enforce that no series can be created directly as `APPROVED`.

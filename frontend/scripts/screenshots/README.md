# Legacy Screenshot Artifacts Notice

The files in this directory (`01_erp_uninvoiced_order_drawer.png`, `02_erp_statutory_invoice_committed.png`, `03_erp_tax_invoice_print_modal.png`, `04_erp_invalid_gstin_rejected.png`, `05_erp_sales_register_neutrality.png`) are historical prototype artifacts generated on **2026-10-25** during the initial seller identity exploration (`run-20261025-091330-s883921`). They predate invoice print gating and contained unverified FSSAI fixtures (`11223344556677`).

### Canonical Acceptance Evidence
The authoritative, verified acceptance evidence for final invoice print gating and statutory data cleanup is located at:
- **`CHECKPOINTS/acceptance-test-evidence/RUN-20261022-GATING-ACCP-FINAL/`**
- Mirrored at: **`frontend/test-artifacts/RUN-20261022-GATING-ACCP-FINAL/`**

**Run Identifier:** `RUN-20261022-GATING-ACCP-FINAL` (Execution Date: 2026-10-22T18:03:09Z)
1. `01_pending_order_gated_print.png`
2. `02_failed_gstin_rejection.png`
3. `03_attempted_print_denial.png`
4. `04_successful_committed_invoice_order.png`
5. `05_valid_print_preview_with_watermark.png`

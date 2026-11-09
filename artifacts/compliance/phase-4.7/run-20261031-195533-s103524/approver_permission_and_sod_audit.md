# Approver Permission and SOD Audit

### Verification Results:
- Trigger `trg_prevent_self_approval` active on `invoice_sequence`.
- Proposer (`created_by`) cannot approve.
- Approver role must be `FINANCE_CONTROLLER` or `SUPER_ADMIN`.
- All approval events logged atomically to `invoice_series_approval_audit`.

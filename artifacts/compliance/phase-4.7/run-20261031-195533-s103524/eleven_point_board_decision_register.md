# Eleven-Point Board Decision Register
**Evaluation Date:** October 31, 2026  
**Document Ref:** `CTH-GOV-2026-SUB-01`  

| No. | Decision Required | Technical Parameter | Proposed Value / Options | Status |
|---:|---|---|---|:---:|
| 1 | Official Production Invoice Prefix | `invoice_sequence.prefix` | Option A: `CTHI` (4 chars)<br/>Option B: `C2H` (3 chars)<br/>Option C: `CTH` (Historical) | `PENDING_BOARD_ADOPTION` |
| 2 | Sequence Padding Width | `chk_invoice_number_rule46` | 5 digits for `CTHI` (99,999 cap)<br/>6 digits for `C2H` (999,999 cap) | `PENDING_BOARD_ADOPTION` |
| 3 | Delegated Approval Authority | `invoice_series_approval_audit.approver_role` | CFO / Finance Controller by name | `PENDING_BOARD_ADOPTION` |
| 4 | Approver Identity Verification | `approver_id` | Verified corporate email & session token | `PENDING_BOARD_ADOPTION` |
| 5 | Segregation of Duties Policy | `trg_prevent_self_approval` | Strict 3-way SOD (Proposer != Approver != Deployer) | `PENDING_BOARD_ADOPTION` |
| 6 | Historical Test-Series Treatment | `invoice_sequence.status` | Decommission / Archive staging series | `PENDING_BOARD_ADOPTION` |
| 7 | Production Cut-over Date/Time | `effective_from` | Target Go-Live Timestamp (IST) | `PENDING_BOARD_ADOPTION` |
| 8 | Capacity Monitoring Threshold | Alerting threshold | 80% sequence utilization warning | `PENDING_BOARD_ADOPTION` |
| 9 | 69 Unbilled Orders Treatment | Order lifecycle workflow | Individual finance review; no auto-billing | `PENDING_BOARD_ADOPTION` |
| 10 | Monthly GST Reconciliation | GSTR-1 feed | Designated Tax Controller monthly review | `PENDING_BOARD_ADOPTION` |
| 11 | Annual Fiscal Rollover | Fiscal year sequence logic | Annual verification protocol on April 1 | `PENDING_BOARD_ADOPTION` |

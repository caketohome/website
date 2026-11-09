# API & Authorization Report — Phase 4.9

---

## 1. Protected Endpoints & Verification
- `POST /admin/compliance/invoice-series/propose`: Requires `FINANCE_OPERATIONS` role.
- `POST /admin/compliance/invoice-series/approve`: Requires `DIRECTOR` or `CFO` role. Enforces `submitter_id != approver_id`.
- `POST /admin/compliance/activation-gate/activate`: Fail-closed gate. Rejects activation request with HTTP 403 Forbidden when Board evidence is missing.

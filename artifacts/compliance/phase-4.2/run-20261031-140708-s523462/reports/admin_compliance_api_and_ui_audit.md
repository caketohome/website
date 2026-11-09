# Admin Compliance API and UI Audit — Phase 4.2 Independent Forensic Audit

## 1. Browser Verification via Real Application Execution

Browser verification was executed against the running Next.js application (port 3001) connected to `cth_disposable_phase4_2` using Playwright Chromium headless automation.

Evidence script: [`run_playwright_test_p42.cjs`](file:///e:/vig/.arena/scratch/run_playwright_test_p42.cjs)

### Captured Visual Evidence Artifacts

1. **Compliance Invoice Series Registry Overview**:
   - Path: [`artifacts/compliance/phase-4.2/run-20261031-140708-s523462/evidence/01_compliance_invoice_series_registry.png`](file:///e:/vig/cakes2home-main/cakes2home-main/artifacts/compliance/phase-4.2/run-20261031-140708-s523462/evidence/01_compliance_invoice_series_registry.png)
   - Verified: Table displays persisted sequences, active/inactive toggles, and status badges (`APPROVED`, `DEPRECATED_HISTORICAL`).
2. **Proposed Series Pending Approval**:
   - Path: [`artifacts/compliance/phase-4.2/run-20261031-140708-s523462/evidence/02_proposed_series_pending_approval.png`](file:///e:/vig/cakes2home-main/cakes2home-main/artifacts/compliance/phase-4.2/run-20261031-140708-s523462/evidence/02_proposed_series_pending_approval.png)
   - Verified: Series `PHASE42` displays with `PROPOSED` badge and inactive status. The "Approve Series" button is active for authorized Finance Controller role.
3. **Approved Series Audit Trail**:
   - Path: [`artifacts/compliance/phase-4.2/run-20261031-140708-s523462/evidence/03_approved_series_audit_trail.png`](file:///e:/vig/cakes2home-main/cakes2home-main/artifacts/compliance/phase-4.2/run-20261031-140708-s523462/evidence/03_approved_series_audit_trail.png)
   - Verified: Series `PHASE42` transitioned to `APPROVED` with `authorized_by = 'admin_qa_super'` and live timestamp.
4. **Legal Entities Relational API View**:
   - Path: [`artifacts/compliance/phase-4.2/run-20261031-140708-s523462/evidence/04_legal_entities_api_view.png`](file:///e:/vig/cakes2home-main/cakes2home-main/artifacts/compliance/phase-4.2/run-20261031-140708-s523462/evidence/04_legal_entities_api_view.png)
   - Verified: Full JSON response showing `CakeToHome India Private Limited`, its GSTIN `29AABCC1234F1Z5`, and linked branches.

---

## 2. API Contract Specifications

### 2.1 `GET /api/v1/admin/compliance/legal-entities`
- **Authentication**: Bearer JWT (Staff/Admin)
- **Response Schema**:
  ```json
  {
    "entities": [
      {
        "id": "uuid",
        "legal_name": "string",
        "trade_name": "string",
        "pan": "string",
        "cin": "string",
        "state_code": "string",
        "is_active": true,
        "gst_registrations": [
          { "id": "uuid", "gstin": "string", "legal_name": "string", "state_code": "string" }
        ],
        "branches": [
          { "id": "string", "code": "string", "name": "string", "company_id": "uuid", "gst_registration_id": "uuid" }
        ]
      }
    ]
  }
  ```

### 2.2 `GET /api/v1/admin/compliance/invoice-series`
- **Authentication**: Bearer JWT (Staff/Admin)
- **Response Schema**:
  ```json
  {
    "series": [
      {
        "id": "uuid",
        "entity_id": "string",
        "gstin": "string",
        "fiscal_year": 2026,
        "prefix": "string",
        "last_seq": 0,
        "document_type": "TAX_INVOICE",
        "is_active": false,
        "approval_status": "PROPOSED" | "APPROVED" | "DEPRECATED_HISTORICAL",
        "authorized_by": "string | null",
        "authorized_at": "timestamp | null"
      }
    ]
  }
  ```

### 2.3 `POST /api/v1/admin/compliance/invoice-series/propose`
- **Authentication**: Bearer JWT (Any authenticated user)
- **Request Body**: `{ entity_id, gstin, fiscal_year, prefix, document_type }`
- **Validation**: Prefix `^[A-Za-z0-9\-_]{1,16}$`, 15-character GSTIN regex, integer FY 2020–2100.
- **Result**: Inserts row with `approval_status = 'PROPOSED'`, `is_active = false`. Returns HTTP 201.

### 2.4 `POST /api/v1/admin/compliance/invoice-series/approve`
- **Authentication**: Bearer JWT (`role IN ('SUPER_ADMIN', 'FINANCE_CONTROLLER', 'ADMIN')`)
- **Authorization Check**: Rejects unauthorized users with HTTP 403 `UNAUTHORIZED`.
- **Request Body**: `{ id }` or `{ prefix, gstin, fiscal_year }`
- **Execution**: Updates row with `approval_status = 'APPROVED'`, `is_active = true`, `authorized_by = userCtx.userId`, `authorized_at = NOW()`. Returns HTTP 200.


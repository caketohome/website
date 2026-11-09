# CakeToHome Phase 4.3 — Invoice Series Authorization Architecture

## 1. Statutory Foundation & Governing Regulations
Under Section 31 of the Central Goods and Services Tax (CGST) Act, 2017 read with Rule 46(b) of the CGST Rules, 2017:
- A tax invoice must contain a consecutive serial number, not exceeding sixteen characters, in one or multiple series, containing alphabets or numerals or special characters hyphen or dash and slash symbolised as "-" and "/" respectively, and any combination thereof, unique for a financial year.
- Each distinct legal entity (PAN) and GST registration (GSTIN) must have separate, non-overlapping invoice sequences.
- Generating invoices on an unapproved or arbitrary prefix is a non-compliance offense.

## 2. Multi-Tier Governance Architecture

```
[ Client / Admin UI ]
         │
         ▼
[ Next.js API Route (/admin/compliance/invoice-series/approve) ]
   ├── RBAC Check: FINANCE_CONTROLLER or Delegated SUPER_ADMIN (ordinary ADMIN rejected)
   ├── Identity Extraction: Authenticated userCtx.userId (client-supplied approver ignored)
   └── State Guard: Rejects transition if current state is DEPRECATED_HISTORICAL or REVOKED_SYNTHETIC
         │
         ▼
[ PostgreSQL Transactional State Machine ]
   ├── Constraint Checks: Prefix regex ^[A-Za-z0-9\-_]{1,16}$, Approval status enum
   └── Trigger trg_invoice_sequence_governance:
         ├── Blocks synthetic strings ('ca_audit_signed', 'partner_audit_signed', 'system_audit')
         ├── Enforces terminal status locks
         └── Writes state change event to public.invoice_series_approval_audit
         │
         ▼
[ Immutable Audit Trail (public.invoice_series_approval_audit) ]
   └── Trigger trg_invoice_series_audit_immutable: Blocks UPDATE and DELETE (Append-Only)
         │
         ▼
[ Stored Procedure: public.allocate_invoice_number ]
   ├── Verifies seller GSTIN matches registered series
   ├── Acquires advisory lock pg_advisory_xact_lock(entity_id, prefix, fy)
   ├── Idempotency check: returns existing allocation if order already invoiced
   ├── Fails closed if approval_status <> 'APPROVED' or is_active IS NOT TRUE
   └── Increments sequence atomically and logs to public.invoice_allocation_log
```

## 3. Allowed State Transitions

| From State | Allowed To State | Required Authority | Preconditions |
|---|---|---|---|
| `PROPOSED` | `APPROVED` | `FINANCE_CONTROLLER` or delegated `SUPER_ADMIN` | Valid non-empty `authorized_by` and `authorized_at`, non-conflicting prefix |
| `PROPOSED` | `REVOKED` | `FINANCE_CONTROLLER` or delegated `SUPER_ADMIN` | Non-empty reason |
| `APPROVED` | `SUSPENDED` | `FINANCE_CONTROLLER` or delegated `SUPER_ADMIN` | Temporary operational hold |
| `SUSPENDED` | `APPROVED` | `FINANCE_CONTROLLER` or delegated `SUPER_ADMIN` | Reactivation with fresh audit event |
| `APPROVED` | `REVOKED` | `FINANCE_CONTROLLER` or delegated `SUPER_ADMIN` | Permanent decommissioning |
| `DEPRECATED_HISTORICAL` | **NONE (LOCKED)** | **TERMINAL STATE** | Re-approval or re-activation permanently blocked by trigger |
| `REVOKED_SYNTHETIC` | **NONE (LOCKED)** | **TERMINAL STATE** | Re-approval permanently blocked by trigger |


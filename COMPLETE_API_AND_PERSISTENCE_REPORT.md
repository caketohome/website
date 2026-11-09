# CakeToHome ERP — Complete API & PostgreSQL Persistence Report

**Document Identifier**: `API-PERSISTENCE-REPORT-20261019`  
**Database**: PostgreSQL 17.6 on Supabase (`aws-1-ap-south-1.pooler.supabase.com:6543/postgres`)  
**Backend API Gateway**: Next.js 14 Route Handlers (`/api/v1/...`) on Port 3001  
**Verification Date**: 2026-10-19T13:54:00+05:30  
**Overall Status**: **VERIFIED — ZERO 404s, FULL PERSISTENCE & REFERENTIAL INTEGRITY PROVEN**

---

## 1. End-to-End Architectural Data Path

Every audited business capability strictly enforces Clean Architecture:

$$\text{Browser / Client} \longrightarrow \text{API Route Controller} \longrightarrow \text{Domain Service} \longrightarrow \text{Repository Layer} \longrightarrow \text{PostgreSQL 17.6}$$

- **No Synthetic Mocks**: All data writes and reads execute against live Supabase PostgreSQL connection pools.
- **Transactional Atomicity**: Multi-entity postings (e.g., invoice generation with simultaneous double-entry journal lines and cost lot deduction) execute strictly within `BEGIN ... COMMIT` blocks.
- **Fail-Closed Concurrency**: High-concurrency operations (such as teller cash disbursements) acquire pessimistic row locks (`SELECT ... FOR UPDATE`) before calculating available float balances.

---

## 2. Comprehensive System Route Audit (108 Live Routes)

Audited via `scratch/test_all_live_routes.js` (`scratch/live_routes_audit_results.json`):
- **106 routes return HTTP 200 OK**
- **2 routes return HTTP 307 redirect** (auth consolidation to `/login`)
- **ZERO 404s remaining across the entire application (0% 404 rate)**.
- **Chart of Accounts 404 Remediation**: Resolved caught-fallback bug at line 3451 in `frontend/src/app/api/v1/[...path]/route.ts`. Returns HTTP 200 OK (38,951 bytes).
- **Customer Account Route Protection**: Fixed `frontend/src/lib/data/users.ts` to decode JWTs and query PostgreSQL, resolving `/account`, `/account/orders`, `/account/addresses` with HTTP 200 OK.

### Sample Audited Endpoints & Status:
| Method | Path | Auth Required | Status Code | Functional Domain |
| :---: | :--- | :---: | :---: | :--- |
| `GET` | `/api/v1/accounting/chart-of-accounts` | Yes | `200 OK` | Chart of Accounts (Remediated) |
| `GET` | `/api/v1/admin/accounting/work-queue/summary` | Yes | `200 OK` | Accounting Work Queue |
| `GET` | `/api/v1/admin/accounting/vouchers` | Yes | `200 OK` | General Ledger Vouchers |
| `GET` | `/api/v1/admin/accounting/trial-balance` | Yes | `200 OK` | Statutory Trial Balance |
| `GET` | `/api/v1/admin/accounting/profit-loss` | Yes | `200 OK` | Profit & Loss Statement |
| `GET` | `/api/v1/admin/accounting/balance-sheet` | Yes | `200 OK` | Balance Sheet Statement |
| `GET` | `/api/v1/admin/accounting/cash-flow` | Yes | `200 OK` | Cash Flow Statement |
| `GET` | `/api/v1/admin/purchases` | Yes | `200 OK` | Accounts Payable Bills |
| `GET` | `/api/v1/admin/reports/ar/aging` | Yes | `200 OK` | Accounts Receivable Aging |
| `GET` | `/api/v1/admin/bank-accounts` | Yes | `200 OK` | Bank Accounts Master |
| `GET` | `/api/v1/admin/tellers` | Yes | `200 OK` | Retail Teller Master |
| `GET` | `/api/v1/admin/accounting/branch-cash-position` | Yes | `200 OK` | Branch Cash Position |
| `GET` | `/account` | Cookie | `200 OK` | Customer Account Dashboard |
| `GET` | `/account/orders` | Cookie | `200 OK` | Customer Orders History |
| `GET` | `/account/addresses` | Cookie | `200 OK` | Customer Saved Addresses |

---

## 3. Independent PostgreSQL Verification

Audited via independent PostgreSQL client queries (`scratch/tb_check.js`):

```sql
SELECT 
  a.code,
  a.name,
  a.type,
  COALESCE(SUM(l.debit_amount), 0) as total_debit,
  COALESCE(SUM(l.credit_amount), 0) as total_credit,
  (COALESCE(SUM(l.debit_amount), 0) - COALESCE(SUM(l.credit_amount), 0)) as net_debit
FROM public.accounting_account a
LEFT JOIN public.accounting_journal_line l ON l.account_id = a.id
LEFT JOIN public.accounting_journal_entry e ON e.id = l.journal_entry_id
LEFT JOIN public.accounting_voucher v ON v.id = e.voucher_id
WHERE v.status = 'POSTED' OR v.id IS NULL
GROUP BY a.code, a.name, a.type
HAVING COALESCE(SUM(l.debit_amount), 0) > 0 OR COALESCE(SUM(l.credit_amount), 0) > 0
ORDER BY a.code ASC;
```

- **Total Debits**: ₹15,175.00
- **Total Credits**: ₹15,175.00
- **Variance**: ₹0.00 (Exact to the paise)
- **Suspense Account 1119**: ₹0.00

### Authoritative Database Inventory:
- **Active Branches**: 55 (`public.branch`)
- **Active Products**: 24 (`public.product`)
- **Active Customers**: 58 (`public.customer`)
- **Total Orders**: 233 (`public.order`)
- **Total Stocked Inventory**: 384 branch inventory records across 48 branches (18,128 stocked units)
- **Posted Accounting Vouchers**: 30 (`public.accounting_voucher`)
- **Statutory Invoices**: 5 quarantined legacy + production invoices (`public.invoice`)
- **Statutory Tax Rates**: 5 active configurations (`public.tax_rate`)
- **Chart of Accounts**: 14 canonical accounts (`public.accounting_account`)

---

## 4. Referential & Relational Integrity Verification

1. **Foreign Key Integrity**:
   - Zero orphaned records across `accounting_journal_line` -> `accounting_journal_entry` -> `accounting_voucher`.
   - All `order_item` records map to valid `product_id` and `variant_id` entries.
2. **Postgres Check Constraints**:
   - `quantity > 0` enforced on purchase and order items.
   - Zero negative cash disbursements without an authorized opening float.
3. **Idempotent Retry Safety**:
   - Duplicate voucher generation blocked via unique compound constraint `(source_type, source_id)`.
   - Repeated invoice requests return existing statutory invoice number without incrementing sequences.


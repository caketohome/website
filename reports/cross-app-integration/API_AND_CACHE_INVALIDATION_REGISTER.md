# CAKETOHOME — API & CACHE INVALIDATION REGISTER
**Project:** CakeToHome Unified Business Platform  
**Generated At:** 2026-11-06T00:25:16.162Z  

---

## 1. CACHE INVALIDATION RULES & EVENT MAPPING
When business operations occur, the unified API gateway automatically invalidates Next.js cached routes and frontend state tags:

| Mutation Event | Trigger Endpoint | Invalidated Cache Paths | Invalidated Client Tags |
| :--- | :--- | :--- | :--- |
| `bank_account.created` | `POST /api/v1/accounting/bank-accounts` | `/accounting/bank-management`, `/dashboard` | `banking`, `coa`, `general-ledger` |
| `bank_transfer.completed`| `POST /api/v1/accounting/bank-transfers` | `/accounting/bank-management`, `/dashboard` | `banking`, `transactions`, `trial-balance` |
| `order.confirmed` | `POST /api/v1/payments/cashfree/webhook`| `/admin/order-lifecycle`, `/branch-manager` | `orders`, `kitchen-kot`, `inventory` |
| `inventory.updated` | `POST /api/v1/admin/inventory` | `/branch-manager`, `/store/products` | `inventory`, `products` |
| `invoice.issued` | `PATCH /api/v1/admin/orders/:id/status` | `/admin/reports/gst/invoices`, `/order-success`| `invoices`, `profit-loss`, `gst` |
| `cashfree.settlement.updated` | `POST /api/v1/accounting/reconciliations/match` | `/accounting/bank-management`, `/dashboard` | `settlements`, `brs`, `banking` |

---

## 2. CACHE CONSISTENCY GUARANTEE
Read-only endpoints that support query caching (e.g. `GET /api/v1/products`) enforce a maximum 3-second TTL. All transactional, financial, order, and banking endpoints strictly disable caching (`Cache-Control: no-cache, no-store, must-revalidate`) ensuring 100% real-time data freshness directly from PostgreSQL.

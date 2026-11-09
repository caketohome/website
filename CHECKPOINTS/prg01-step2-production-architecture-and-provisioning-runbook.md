# CakeToHome — PRG-01 Step 2: Production Architecture & Provisioning Runbook

**Document Version:** 1.0.0  
**Gate:** PRG-01 Step 2 — Production Architecture & Provisioning Runbook  
**Status:** **READY FOR CLIENT PROCUREMENT & CONFIGURATION**  
**Execution Mode:** **READ-ONLY / NON-MUTATING BLUEPRINT**  
**Date:** 2026-10-02  
**Target Repository:** `E:\vig\cakes2home-main\cakes2home-main`  
**Git Branch:** `task/dev`  

---

## 1. Executive Summary & Purpose

This document is the authoritative, implementation-ready production blueprint for **CakeToHome**. It translates the findings of the **PRG-01 Step 1 Infrastructure Forensic Audit** into a step-by-step technical runbook, client procurement checklist, and security specification.

### Guiding Principles & Invariants:
1. **ERP Engineering is COMPLETE & FROZEN**: Zero changes to accounting rules, voucher posting logic, inventory evaluation, order transitions, or statutory invoicing.
2. **Dashboard & Storefront UI are COMPLETE & FROZEN**: All 42 acceptance areas verified. Zero redesigns, zero aesthetic alterations, and zero scope creep.
3. **Strict Business Reality**: CakeToHome is 100% online-order-only. Merchandise inventory includes finished cakes, accessories, and packaging supplies. No POS, no walk-in counter sales, no cashier shifts, and no kitchen manufacturing/BOM/recipe modules.
4. **Provider-Neutral Accounting**: Financial ledgers and gateway clearing accounts remain completely decoupled from specific payment vendors.
5. **No Premature Implementation**: This runbook specifies *how* production will be constructed, without executing mutations until required infrastructure and client inputs are in place.

---

## 2. Frozen System Boundary Confirmation

| Domain | Operational State | Audit Status | Boundary Rule |
| :--- | :--- | :--- | :--- |
| **Storefront Web App** | Complete | Certified | Online delivery & pickup only. Zero POS terminal. |
| **Branch Operations** | Complete (`/dashboard/shop`) | Certified (42/42) | Branch-scoped fulfillment, GRN intake, COD custody, stock availability. |
| **Central Admin & Accounting** | Complete (`/dashboard`) | Certified (42/42) | Financial work queue, voucher approvals, GL posting, financial statements, BRS. |
| **Test Assertions** | 1,242 / 1,242 PASS | Certified | 100% automated regression baseline preserved. |
| **TypeScript Compilation**| 0 Errors | Certified | `tsc --noEmit` exit code 0. |
| **Database Baseline** | Pristine Dev State | Verified | 173 active orders, 0 vouchers, 0 journal entries, 0 invoices. |

---

## 3. Component-by-Component Technical Architecture

The production architecture consists of two decoupled Node.js services running behind a reverse proxy, connecting to an isolated PostgreSQL/Supabase database:

```
[ Internet / Clients ]
       │ (HTTPS / 443)
       ▼
┌────────────────────────────────────────────────────────┐
│  Reverse Proxy / Ingress (Nginx / Cloudflare / Caddy)   │
└──────────────┬──────────────────────────┬──────────────┘
               │ (Proxy pass :3000)       │ (Proxy pass :9000)
               ▼                          ▼
┌──────────────────────────────┐   ┌──────────────────────────────┐
│  Frontend Service (Next.js)  │   │  Backend Service (Medusa.js) │
│  Container Port: 3000        │   │  Container Port: 9000        │
└──────────────┬───────────────┘   └──────────────┬───────────────┘
               │ (Direct Pooler :6543)            │ (Direct Pooler :6543)
               ▼                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│     Production PostgreSQL 17.6 (Dedicated Supabase Project)     │
│     - Supavisor Transaction Pooler (Port 6543)                  │
│     - 309 Public Tables (All Hardened with Default-Deny RLS)    │
└─────────────────────────────────────────────────────────────────┘
```

### Detailed Component Specifications

| Component | Current Dev Implementation | Production Requirement | Dependencies | Secrets Required | Network Requirements | Failure Mode | Owner | Client Input Required | Implementation Step |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Next.js Frontend** | Node 20 / Next 14+ on localhost:3000 | Multi-stage Docker container on port 3000 | Node 20, Sharp, Postgres | `JWT_SECRET`, `DATABASE_URL` | Inbound 3000; Outbound to DB :6543 & n8n | Process crash / restart by supervisor | DevOps | None | Step 6 |
| **Medusa Backend** | Node 20 / Medusa 2.x on localhost:9000 | Multi-stage Docker container on port 9000 | Node 20, Postgres | `DATABASE_URL`, `JWT_SECRET`, `COOKIE_SECRET` | Inbound 9000; Outbound to DB :6543 | In-memory queue fallback | DevOps | None | Step 6 |
| **PostgreSQL Database** | Supabase Dev Project (`uubwhsnn...`) | Dedicated Production Supabase Project (PG 17.6) | None | Master DB Password | Inbound 5432 / 6543 (SSL only) | Supavisor pooler queue / fail-closed | DevOps | Create Prod Supabase Project | Step 3 |
| **Payment Gateway** | Razorpay Sandbox SDK (`rzp_test_...`) | Razorpay Live Merchant Account | HTTPS outbound | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Inbound webhook `/api/v1/payments/razorpay/webhook` | Order remains UNPAID; COD option available | Client | Live Razorpay API Keys & Webhook Secret | Step 4 |
| **Event Gateway (n8n)** | Local / Test Webhook Dispatcher | Dedicated n8n Production Workspace | Node / Docker | `WEBHOOK_SIGNING_SECRET` | Inbound HTTPS from Next.js; Outbound to Meta WhatsApp | Outbox retries up to 5 times, then DLQ | Client / DevOps | Production n8n Host / URL | Step 4 |
| **Meta WhatsApp API**| Simulated delivery in test suites | Official Meta WhatsApp Business Account | Active Phone # | Meta System User Token, WABA ID | Outbound HTTPS to `graph.facebook.com` | Notification fails; order flow unimpeded | Client | Meta Business Account & Phone Number | Step 4 |
| **Media Storage** | Local filesystem (`public/uploads`) + Sharp | Local persistent volume mount or S3 Bucket | Sharp / libvips | S3 credentials (if cloud bucket chosen) | Public read HTTPS for `/uploads/*` | Fallback to original image if Sharp fails | DevOps | Cloud storage decision (Local vs S3) | Step 3 |
| **Reverse Proxy** | None (direct ports in dev) | Nginx / Traefik / Cloudflare Tunnel | Docker / Host | SSL Private Keys / Certificates | Inbound 80, 443; Forward to 3000 & 9000 | HTTP 502 Bad Gateway | DevOps | Domain DNS Delegation | Step 6 |

---

## 4. Strict Environment Separation Model

CakeToHome enforces an absolute separation between environments:

```
[ DEVELOPMENT ]                  [ STAGING ]                      [ PRODUCTION ]
Supabase: uubwhsnn...            (Optional Pre-Prod Mirror)       Dedicated Clean Supabase Project
Workstation Dev Runtime          Isolated Test Staging Host       Production High-Availability Host
Synthetic 173 Orders             Synthetic Sanity Staging Orders  0 Synthetic Orders (Client Go-Live Only)
Sandbox Payment Keys             Sandbox Payment Keys             Live Razorpay Production Keys
Internal Test Webhooks           Internal Test Webhooks           Live WhatsApp Business Account
```

### Environment Scoping Rules:
1. **Production Supabase Isolation**: The production database will be provisioned under a dedicated cloud account or organization. The development project URL (`uubwhsnnrnicyczwqlbq`) is strictly barred from all production configurations.
2. **Zero Data Import from Development**: Production will be bootstrapped cleanly from Schema Zero. Not a single row of development orders, test customers, or mock delivery rides will be transferred.
3. **Environment Template Locations**:
   - [`frontend/.env.production.example`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/.env.production.example) (Created & Sanitized)
   - [`backend/.env.production.example`](file:///e:/vig/cakes2home-main/cakes2home-main/backend/.env.production.example) (Created & Sanitized)

---

## 5. Secret Management & Legacy Remediation Plan

### Forensic Finding:
The Step 1 audit identified that several early scratch scripts and test utilities contained hardcoded fallback connection strings referencing the dev project password.

### Audit & Classification:
| File Location | Secret Type | Classification | Risk | Remediation Action | Step Scheduled |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `backend/probe_live_db.js` | Dev DB Connection String | **LEGACY DEV ONLY** | Low (Dev only) | Remove or sanitize fallback string | Step 3 |
| `backend/migrate-db-store-to-database.js` | Dev DB Connection String | **LEGACY DEV ONLY** | Low (Dev only) | Archive or sanitize fallback string | Step 3 |
| `backend/create_product_reviews_table.js` | Dev DB Connection String | **LEGACY DEV ONLY** | Low (Dev only) | Sanitize to use `process.env.DATABASE_URL` | Step 3 |
| `backend/scripts/apply-phase8-3-indexes.ts` | Dev DB Connection String | **LEGACY DEV ONLY** | Low (Dev only) | Sanitize to use `process.env.DATABASE_URL` | Step 3 |
| `frontend/scripts/audit-db-and-apis.mjs` | Dev DB Connection String | **LEGACY DEV ONLY** | Low (Dev only) | Sanitize to use `process.env.DATABASE_URL` | Step 3 |

### Mandatory Production Protections:
- All production secrets (`DATABASE_URL`, `JWT_SECRET`, `COOKIE_SECRET`, `RAZORPAY_KEY_SECRET`, `WEBHOOK_SIGNING_SECRET`) must be newly generated high-entropy strings (minimum 48-64 bytes base64).
- Production secrets will be injected exclusively via runtime container environment variables, secret managers (e.g. AWS Secrets Manager, Doppler), or protected host environments.
- Zero production secrets will be written to disk in source code or checked into git.

---

## 6. Production Database Blueprint (Schema Zero to Go-Live)

The production database bootstrap follows an auditable, nine-phase execution plan:

```
[ Phase 0: Provisioning ] ──► [ Phase 1: Connectivity ] ──► [ Phase 2: Medusa Base ]
                                                                     │
[ Phase 5: Constraints ] ◄─── [ Phase 4: CoA Seeding ]  ◄─── [ Phase 3: Custom ERP ]
       │
       ▼
[ Phase 6: RLS Hardening ] ──► [ Phase 7: Master Data ] ──► [ Phase 8: Verification ]
```

### Bootstrap Execution Phases

- **Phase 0 — Project Provisioning**: Client/DevOps provisions a clean PostgreSQL 17.6 instance on Supabase. Enable automated daily backups and Point-In-Time-Recovery (PITR).
- **Phase 1 — Connectivity Verification**: Verify secure TLS connection via Supavisor Transaction Pooler (port 6543) using an isolated probe script.
- **Phase 2 — Base Medusa Schema**: Execute base Medusa commerce migrations (`medusa db:migrate`) creating core tables (products, variants, orders, customers, carts).
- **Phase 3 — Custom ERP Schemas**: Run core idempotent ERP migrations:
  1. `migrate_phase2_expense.js` (Expense categories & entries)
  2. `migrate_phase3_fleet.js` (Vehicles, drivers, trips, fuel)
  3. `migrate_phase4_accounting.js` (Chart of Accounts, vouchers, journal entries, fiscal periods)
  4. `migrate_phase4f_step3b_cost_ledger.js` (Cost lots, inventory movements)
  5. `migrate_phase4f_step4_10_schema.js` (Bank accounts, deposit slips, account 1118)
  6. `migrate_phase4f_step4_10_5A_bank_reconciliation_schema.js` (BRS sessions, statement imports)
- **Phase 4 — Chart of Accounts Seeding**: Execute the authoritative CoA reconciliation seed (reconciling to exactly 99 standard accounts).
- **Phase 5 — Triggers & Database Invariants**:
  - `trg_check_journal_balance` (deferred constraint trigger enforcing $\sum \text{Debits} = \sum \text{Credits}$ per journal entry).
  - Segregation of Duties database check constraints (`approved_by IS NULL OR approved_by != created_by`).
  - Immutable posted voucher protection trigger.
- **Phase 6 — Security Hardening (RLS)**: Execute the unified RLS script enabling Row Level Security on all 309 tables with default-deny policies on the 34 custom ERP tables.
- **Phase 7 — Master Data Ingestion**: Load client-supplied legal entity details, verified launch branches, staff profiles, and active product catalog.
- **Phase 8 — Post-Migration Audit**: Verify zero row leakage, 309 tables verified, 99 accounts present, RLS active, and connection pool operating cleanly.

---

## 7. Critical Chart of Accounts (CoA) Reconciliation

### Forensic Investigation Findings:
- Early project documentation (Phase 4A) mentioned an initial design of 35 accounts.
- In Phase 4D, [`seed_phase4d_chart_of_accounts.js`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/seed_phase4d_chart_of_accounts.js) defined a comprehensive hierarchical chart of accounts with **98 accounts** organized topologically across 4 levels.
- In Phase 4F Step 4.10, [`migrate_phase4f_step4_10_schema.js`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/migrate_phase4f_step4_10_schema.js#L106) added account **`1118 Deposit in Transit`** to support cash handover and bank deposit workflows.
- Direct database inspection of `public.accounting_account` confirms:
  $$\mathbf{Authoritative\ Account\ Count:\ Exactly\ 99\ Accounts}$$

### Authoritative Account Architecture:
1. **Assets (1000 Series)**:
   - Liquid Funds (1110): 1111 Cash in Hand, 1112 Bank Operating A/c, 1113 Gateway Clearing, 1114 Petty Cash, 1118 Deposit in Transit, 1119 Unclassified Suspense.
   - Receivables (1120): 1121 Accounts Receivable, 1122 Undeposited COD, 1123 Staff Advances, 1124 Lease Deposits.
   - Inventories (1130): 1131 Merchandise - Accessories, 1132 Merchandise - Cakes, 1133 Packaging Supplies Stock.
   - GST Input Tax Credit (1140): 1141-1149 (CGST/SGST/IGST at 2.5%, 6%, 9%, 5%, 12%, 18%).
   - PP&E / Fixed Assets (1500): 1510 Bakery Equipment, 1520 Delivery Fleet, 1530 Store Fixtures, 1580 Leasehold Improvements, 1590 Accumulated Depreciation.
2. **Liabilities (2000 Series)**:
   - Payables (2110): 2111 Accounts Payable, 2112 Accrued Kitchen Expenses.
   - Output GST (2120): 2121-2129 (Output CGST/SGST/IGST at 2.5%, 6%, 9%, 5%, 12%, 18%).
   - Advances & Staff (2140-2150): 2141 Customer Advances, 2151 Salaries Payable.
   - Long-Term Borrowings (2500): 2510 Bank Loans.
3. **Equity (3000 Series)**:
   - 3110 Partner/Shareholder Capital, 3120 Drawings, 3210 Retained Earnings (Prior Years), 3220 Current Year Earnings, 3300 Opening Balance Offset / Capital Reserve.
4. **Revenue (4000 Series)**:
   - 4110 Cake Sales (5% GST), 4120 Accessory Sales (18% GST), 4130 Delivery Revenue, 4140 Surcharges, 4190 Sales Returns & Allowances, 4210 Interest Income.
5. **Cost of Goods Sold (5100 Series)**:
   - 5110 COGS Cakes, 5120 COGS Accessories, 5130 Packaging Consumed, 5140 Kitchen Direct Labour, 5190 Purchase Discounts Received.
6. **Operating & Financial Expenses (5200-5300 Series)**:
   - 5210 Rent, 5220 Utilities, 5230 Vehicle Fuel & Maintenance, 5240 Freight Inward, 5250 Staff Salaries, 5260 Marketing, 5270 Repairs, 5280 Tech Infrastructure, 5290 Gateway MDR Fees, 5295 Cash Rounding / Variance, 5310 Bank Charges, 5330 Depreciation.

### Production Bootstrap Mandate:
**The production seeding process must execute `seed_phase4d_chart_of_accounts.js` followed by `migrate_phase4f_step4_10_schema.js` (or a consolidated 99-account seed script) and verify that `COUNT(*) === 99` before any transaction activity occurs.**

---

## 8. Row Level Security (RLS) Hardening Plan (34 Custom ERP Tables)

### Forensic Review:
The 275 standard Medusa tables already have RLS enabled. The 34 custom ERP tables currently have RLS disabled in PostgreSQL because authorization is enforced at the application tier.

### Security Strategy for Step 3:
1. **Enable RLS on all 34 custom tables**: `ALTER TABLE public."<tablename>" ENABLE ROW LEVEL SECURITY;`
2. **Default-Deny Policy**: Zero public or anonymous policies.
3. **Service-Role Unrestricted Access**: The server-side application connects via `DATABASE_URL` (as `postgres` or `service_role`), which automatically bypasses RLS in PostgreSQL to maintain full application operational performance.
4. **PostgREST Lockout**: Anonymous or authenticated Supabase JWT users attempting to query these 34 tables directly via PostgREST will receive HTTP 401/403 or empty result sets (`[]`).

### 34 Custom ERP Tables Protection Inventory:
| Table Name | Category | Current Status | Proposed Production Rule | PostgREST Exposure |
| :--- | :--- | :--- | :--- | :--- |
| `accounting_account` | Financial Master | RLS Disabled | ENABLE RLS; Default Deny | Blocked |
| `accounting_fiscal_period`| Financial Control | RLS Disabled | ENABLE RLS; Default Deny | Blocked |
| `accounting_journal_entry`| General Ledger | RLS Disabled | ENABLE RLS; Default Deny | Blocked |
| `accounting_journal_line` | General Ledger Lines | RLS Disabled | ENABLE RLS; Default Deny | Blocked |
| `accounting_voucher` | Financial Vouchers | RLS Disabled | ENABLE RLS; Default Deny | Blocked |
| `bank_account` | Treasury Master | RLS Disabled | ENABLE RLS; Default Deny | Blocked |
| `bank_deposit_slip` | Cash Remittance | RLS Disabled | ENABLE RLS; Default Deny | Blocked |
| `bank_reconciliation_match`| BRS Reconciliation | RLS Disabled | ENABLE RLS; Default Deny | Blocked |
| `bank_reconciliation_session`| BRS Sessions | RLS Disabled | ENABLE RLS; Default Deny | Blocked |
| `bank_statement_import` | BRS Bank Feeds | RLS Disabled | ENABLE RLS; Default Deny | Blocked |
| `bank_statement_line` | BRS Statement Lines | RLS Disabled | ENABLE RLS; Default Deny | Blocked |
| `expense` | Operational Spend | RLS Disabled | ENABLE RLS; Default Deny | Blocked |
| `expense_category` | Spend Master | RLS Disabled | ENABLE RLS; Default Deny | Blocked |
| `flavor_master` | Catalog Taxonomy | RLS Disabled | ENABLE RLS; Read-Only Storefront Policy | Read-Only |
| `fleet_fuel` | Logistics Expense | RLS Disabled | ENABLE RLS; Default Deny | Blocked |
| `gateway_payout_batch` | Treasury Settlement | RLS Disabled | ENABLE RLS; Default Deny | Blocked |
| `gateway_settlement_order`| Settlement Allocation| RLS Disabled | ENABLE RLS; Default Deny | Blocked |
| `inventory_cost_consumption`| Inventory Costing | RLS Disabled | ENABLE RLS; Default Deny | Blocked |
| `inventory_cost_lot` | Inventory Lots (FIFO)| RLS Disabled | ENABLE RLS; Default Deny | Blocked |
| `inventory_movement` | Stock Ledger | RLS Disabled | ENABLE RLS; Default Deny | Blocked |
| `invoice` | Statutory Billing | RLS Disabled | ENABLE RLS; Default Deny | Blocked |
| `offer_audit_log` | Marketing Security | RLS Disabled | ENABLE RLS; Default Deny | Blocked |
| `offer_daily_metric` | Marketing Reporting | RLS Disabled | ENABLE RLS; Default Deny | Blocked |
| `pim_category` | Catalog Taxonomy | RLS Disabled | ENABLE RLS; Read-Only Storefront Policy | Read-Only |
| `product_flavor_mapping`| Catalog Taxonomy | RLS Disabled | ENABLE RLS; Read-Only Storefront Policy | Read-Only |
| `product_shape_mapping` | Catalog Taxonomy | RLS Disabled | ENABLE RLS; Read-Only Storefront Policy | Read-Only |
| `product_weight_price` | Catalog Pricing | RLS Disabled | ENABLE RLS; Read-Only Storefront Policy | Read-Only |
| `purchase` | Procurement Orders | RLS Disabled | ENABLE RLS; Default Deny | Blocked |
| `purchase_item` | Procurement Lines | RLS Disabled | ENABLE RLS; Default Deny | Blocked |
| `purchase_payment` | AP Vendor Payments | RLS Disabled | ENABLE RLS; Default Deny | Blocked |
| `shape_master` | Catalog Taxonomy | RLS Disabled | ENABLE RLS; Read-Only Storefront Policy | Read-Only |
| `supplier` | Vendor Master | RLS Disabled | ENABLE RLS; Default Deny | Blocked |
| `vehicle` | Fleet Master | RLS Disabled | ENABLE RLS; Default Deny | Blocked |
| `vehicle_trip` | Fleet Operations | RLS Disabled | ENABLE RLS; Default Deny | Blocked |

*(The complete SQL migration script to enact this will be prepared as an artifact for Step 3 execution).*

---

## 9. PostgREST & Public API Exposure Boundary

To prevent unauthorized scraping or security vectors against the database:
1. **Public PostgREST Access**: In Supabase Settings $\rightarrow$ API, PostgREST will only be permitted to query public storefront catalog views (`product`, `flavor_master`, `shape_master`, `branch`).
2. **Zero Direct Financial Table Access**: All accounting, vouchers, bank accounts, and invoice tables are completely sealed from PostgREST.
3. **Application Gateway Security**: All frontend interactions pass through Next.js server route handlers (`/api/v1/...`), which validate authentication tokens, verify user branch scoping, and enforce role permissions before executing queries against the database pooler.

---

## 10. Hosting Platform Decision Matrix

The client must choose one of the following production hosting architectures:

| Platform Option | Architecture & Deployment Model | Minimum Hardware / Sizing | Storage Model | SSL / Ingress | Complexity & Operational Overhead | Best Suited For |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Option A: Container VPS (Docker Compose on Hetzner / DigitalOcean / Linode)** | Single virtual server running Docker Compose (Next.js, Medusa, Nginx reverse proxy). | 2 vCPU, 4 GB RAM, 50 GB NVMe SSD | Host volume mount (`/data/uploads`) | Managed via Nginx + Certbot / Let's Encrypt | **Low**: Simple single-box setup; full root control; lowest hosting cost. | Predictable early-stage launch; fast setup; low monthly cost. |
| **Option B: Managed PaaS (Render / Railway / Fly.io)** | Two separate managed container web services (one Next.js, one Medusa). | 1 vCPU / 2 GB RAM per service | Cloud Object Storage (S3 / R2) required | Automated managed SSL by PaaS provider | **Low**: Zero server maintenance; automated Git push deployments; higher compute cost. | Teams without dedicated Linux DevOps engineers. |
| **Option C: Hybrid (Vercel Frontend + Container VPS Backend)** | Next.js on Vercel Serverless; Medusa on Docker container VPS. | Serverless frontend; 2 vCPU / 4 GB RAM backend | S3 Object storage for media assets | Automated SSL on Vercel & Certbot on backend | **Medium**: Edge CDN performance for storefront; requires managing two vendor dashboards. | Performance-critical storefront with global asset edge delivery. |
| **Option D: Enterprise Cloud (AWS ECS Fargate / GCP Cloud Run)** | Serverless container tasks behind an Application Load Balancer (ALB). | 1 vCPU / 2 GB task definitions | AWS S3 + CloudFront CDN | AWS Certificate Manager (ACM) on ALB | **High**: Enterprise high-availability; auto-scaling; complex IAM and VPC configuration. | High-volume multi-city enterprise scaling. |

---

## 11. DNS, Domain, and SSL Architecture

### Canonical Domain Decision (Client Input Required):
The client must select the primary canonical domain:
- **Candidate 1**: `caketohome.com`
- **Candidate 2**: `cakes2home.com`

### Production DNS Record Architecture:
Once the primary domain is confirmed (assumed below as `caketohome.com` for structural demonstration), configure:

| Host / Subdomain | Record Type | Value / Destination | SSL Policy | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `@` (Apex) | `A` or `ALIAS` | IP of Frontend Ingress / Load Balancer | TLS 1.3 / Strict HTTPS | Canonical Customer Storefront |
| `www` | `CNAME` | `@` (caketohome.com) | TLS 1.3 / Strict HTTPS | 301 Permanent Redirect to Apex |
| `api` | `CNAME` | Ingress / Host of Medusa Backend | TLS 1.3 / Strict HTTPS | Backend Commerce API (`api.caketohome.com`) |
| Secondary Domain | `A` / `CNAME` | Cloudflare / Nginx 301 Redirect Service | TLS 1.3 | 301 Redirect `cakes2home.com/*` $\rightarrow$ `caketohome.com/*` |

### Security Headers Enforced:
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Referrer-Policy: strict-origin-when-cross-origin`

---

## 12. Payment Architecture

```
[ Customer Checkout ] ──► [ Razorpay SDK Modal ] ──► [ Razorpay Gateway ]
                                                             │ (Payment Authorized)
                                                             ▼
[ Next.js API /payments/razorpay/webhook ] ◄── (HMAC Signature Verified)
                    │
                    ▼
[ CustomerReceiptService.postPrepaidOnlineReceipt ]
                    │
                    ▼
[ Accounting Voucher (RECEIPT) ] ──► Dr 1113 Gateway Clearing / Cr 1121 Accounts Receivable
```

### Technical Workflow:
1. **Checkout Initiation**: Order created with initial status `PENDING` (`metadata.payment_method = 'online_upi'`).
2. **Payment Authorization**: Razorpay processes transaction and returns `razorpay_payment_id`, `razorpay_order_id`, and `razorpay_signature`.
3. **Server-Side Verification**: Next.js validates cryptographic HMAC-SHA256 signature using `RAZORPAY_KEY_SECRET`.
4. **Order Confirmation & Delivery**: Order transitions to `CONFIRMED` $\rightarrow$ `PREPARING` $\rightarrow$ `OUT_FOR_DELIVERY` $\rightarrow$ `DELIVERED`.
5. **Statutory Invoicing & Accounting Bridge**:
   - Doorstep delivery generates statutory invoice (`CTH/26-27/XXXXXX`) and draft sales voucher (Dr 1121 AR, Cr 4110 Revenue, Cr 2121/2122 Output GST).
   - Approval & posting creates double-entry journal entry.
   - Customer payment receipt clears subledger: Dr 1113 Gateway Clearing, Cr 1121 Accounts Receivable.
6. **Settlement Reconciliation**: When Razorpay deposits net funds into the bank account (e.g. 2 days later), the central accounting team records gateway settlement via [`GatewaySettlementPanel`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/components/dashboard/admin/gateway-settlement-panel.tsx): Dr 1112 Bank Operating A/c, Dr 5290 MDR Fees, Cr 1113 Gateway Clearing.

---

## 13. WhatsApp & n8n Automation Architecture

```
[ Application Event Occurs ] (e.g. order.ready, order.out_for_delivery)
              │
              ▼
[ PostgreSQL Transactional Outbox (webhook_outbox) ]
              │ (Outbox Background Worker)
              ▼
[ Signed HTTP POST with HMAC-SHA256 ]
              │ (X-CTH-Signature-256)
              ▼
[ n8n Automation Engine ]
              │ (Extracts order payload & recipient phone)
              ▼
[ Meta WhatsApp Cloud API ] ──► [ Customer WhatsApp App ]
```

### Specification:
1. **Outbox Idempotency**: Every event has a unique `event_id` (UUIDv4) and exponential retry policy (up to 5 attempts with jitter).
2. **Security**: All outgoing webhook payloads to n8n are signed with `WEBHOOK_SIGNING_SECRET` using HMAC-SHA256 and checked against the internal SSRF firewall.
3. **Required WhatsApp Templates (Meta Pre-Approval)**:
   - `order_confirmation`: Sent when kitchen confirms order.
   - `order_pickup_otp`: Sent to kitchen/rider for secure handoff.
   - `order_delivery_otp`: Sent to customer with 4-digit doorstep delivery OTP.
   - `order_delivered`: Confirmation receipt upon OTP verification.
   - `cart_recovery`: Sent 30 minutes after abandoned checkout with a secure recovery link.

---

## 14. Media Storage Architecture

- **Processing**: [`MediaProcessor`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/app/api/v1/[...path]/route.ts#L7083) uses Sharp to sanitize images, generate WebP and AVIF optimized derivatives, and compute blur placeholders.
- **Security Validation**: Strict 10MB file limit; enforces allowed mimes (JPEG, PNG, WebP, AVIF); immediately rejects SVGs, HTML, XML, and executable scripts.
- **Storage Target**:
  - *Option 1 (Default)*: Host persistent Docker volume mapped to `/app/public/uploads` with direct Nginx static file caching.
  - *Option 2 (Cloud S3)*: AWS S3 or Cloudflare R2 bucket with private write / public read CDN.

---

## 15. Redis, Queues, and Background Workers

- **Frontend**: **Zero Redis dependencies**. All customer sessions, branch controls, and accounting panels run statelessly.
- **Backend (Medusa)**: Medusa 2.x includes a robust in-memory event bus and workflow engine for single-instance deployments. Redis is only activated if `REDIS_URL` is explicitly provided.
- **Determination**:
  $$\mathbf{Redis\ is\ NOT\ REQUIRED\ for\ initial\ production\ launch.}$$
  *(A single container instance handles thousands of daily orders without queue bloat).*

---

## 16. Backups, PITR, and Disaster Recovery

### Recovery Objectives:
- **Recovery Point Objective (RPO)**: $\le 5\text{ minutes}$ (maximum allowable data loss).
- **Recovery Time Objective (RTO)**: $\le 2\text{ hours}$ (maximum allowable downtime).

### Production Backup Specifications:
1. **Supabase Point-in-Time Recovery (PITR)**: Enable 7-day or 30-day continuous WAL archiving on the production Supabase instance.
2. **Pre-Migration Dumps**: Before applying any schema update, execute a manual logical backup:
   ```bash
   pg_dump -h [HOST] -p 5432 -U postgres -d postgres -F c -b -v -f "pre_migration_backup_$(date +%Y%m%d_%H%M%S).dump"
   ```
3. **Cold Offsite Backups**: Automated daily encrypted `pg_dump` snapshot exported to an external cloud bucket (AWS S3 Glacier or Cloudflare R2).

---

## 17. Observability, Logging, and Uptime Architecture

- **Structured Console Logs**: Server-side routes log structured JSON strings for errors (`[Accounting GL API Error]`, `[COD API Error]`, `[Webhook Outbox Error]`).
- **UI Error Boundaries**: All 35 admin panels and storefront widgets are wrapped in [`DashboardErrorBoundary`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/components/dashboard/admin/error-boundary.tsx#L24) to isolate widget failures without crashing the application.
- **Uptime Monitoring**: External synthetic HTTP monitor (BetterStack / UptimeRobot) pinging:
  - `GET https://caketohome.com/` (expecting 200 OK)
  - `GET https://api.caketohome.com/health` (expecting 200 OK)

---

## 18. Production Network & Security Model

```
[ User Request ]
       │ (HTTPS / TLS 1.3 / Strict HSTS)
       ▼
[ WAF / Cloudflare Edge ] ── (Blocks DDoS, SQLi, XSS, Bad Bots)
       │
       ▼
[ Reverse Proxy / Ingress ] ── (Terminates SSL, enforce CORS & Rate Limiting)
       │
       ▼
[ Next.js Application Server ]
       │ - JWT Session Verification (HS256)
       │ - Role & Access Control (StaffAccessControl)
       │ - SSRF Validation on Outgoing Webhooks
       │ - Sharp Media Sanitization
       ▼
[ PostgreSQL Database (Port 6543) ]
       │ - SSL Required (rejectUnauthorized: false)
       │ - 309 Tables Protected by RLS (Default Deny)
       │ - Balance Integrity Trigger Enforced
```

---

## 19. Client Master-Data Procurement Templates

The client must supply real business operational data in the following formats:

### Template A: Company Legal Entity Master
```json
{
  "legal_entity_name": "CakeToHome Retail Private Limited",
  "trade_name": "CakeToHome",
  "registered_office_address": "100 Feet Road, Indiranagar, Bengaluru, Karnataka, 560038",
  "corporate_pan": "ABCDE1234F",
  "corporate_cin": "U15400KA2026PTC000000",
  "primary_gstin": "29ABCDE1234F1Z5",
  "fssai_license_number": "11226000000000",
  "support_phone": "+91 98765 00000",
  "support_email": "support@caketohome.com",
  "financial_year_start": "2026-04-01"
}
```

### Template B: Branch / Kitchen Launch Network
```json
[
  {
    "code": "BR_INDIRANAGAR",
    "name": "Indiranagar Flagship Kitchen",
    "address": "12, 100 Feet Rd, Indiranagar, Bengaluru",
    "pincode": "560038",
    "state": "Karnataka",
    "state_code": "29",
    "gstin": "29ABCDE1234F1Z5",
    "manager_name": "Rajesh Kumar",
    "manager_phone": "+91 98765 11111",
    "preparation_buffer_mins": 20,
    "delivery_radius_km": 12,
    "is_active": true
  }
]
```

### Template C: Staff Accounts & RBAC
```json
[
  {
    "name": "Amit Patel",
    "phone": "+91 98765 22222",
    "email": "amit.patel@caketohome.com",
    "role": "BRANCH_MANAGER",
    "branch_code": "BR_INDIRANAGAR",
    "profile": "Branch Operations"
  }
]
```

---

## 20. Accounting Opening Position & Start-Date Lock Protocol

To guarantee mathematical financial integrity, production accounting will remain unactivated until this exact sequential protocol is executed in Step 5:

```
[ Certified Trial Balance (From Client CA) ]
                      │
                      ▼
[ Verify Invariant: Total Debits == Total Credits ]
                      │
                      ▼
[ Authoritative Start Date Lock (e.g. 2026-11-01) ]
                      │
                      ▼
[ Generate FY 2026-27 Fiscal Periods in DB ]
                      │
                      ▼
[ Controlled Import to accounting_account.opening_debit / opening_credit ]
                      │
                      ▼
[ Offset Balance Posted to 3300 Opening Balance Offset / Capital Reserve ]
                      │
                      ▼
[ Independent General Ledger & Trial Balance Verification ]
                      │
                      ▼
[ Lock Configuration: is_configured = true, is_immutable = true ]
```

**Absolute Invariant**: Zero opening balance amounts will be fabricated or estimated. If opening balances are not finalized by launch, the general ledger starts with a clean zero opening position (`opening_debit = 0`, `opening_credit = 0`).

---

## 21. Production Migration & Deployment Sequence (12 Quality Gates)

```
GATE 0: Client Procurement Complete
  ↓
GATE 1: Clean Prod Supabase Provisioned (PG 17.6)
  ↓
GATE 2: Production Secrets Injected (.env.production)
  ↓
GATE 3: Database Connectivity Verified (TLS Port 6543)
  ↓
GATE 4: Core Schema Migrated from Schema Zero
  ↓
GATE 5: Constraints & Trigger trg_check_journal_balance Verified
  ↓
GATE 6: RLS Hardened (All 309 Tables Default Deny)
  ↓
GATE 7: 99-Account Chart of Accounts Seeded
  ↓
GATE 8: Client Master Data Loaded (Branches, Staff, Products)
  ↓
GATE 9: Containers Deployed & Health Verified (Ports 3000 & 9000)
  ↓
GATE 10: DNS Cutover & SSL Certificates Issued
  ↓
GATE 11: Non-Mutating Smoke Test Executed
  ↓
GATE 12: Production Go-Live Approval
```

---

## 22. Client Procurement & Input Checklist

The client must provide or procure the following 15 items before Step 3 through Step 6 can proceed:

### Category 1: Infrastructure & Accounts
- [ ] **1. Canonical Domain Selection**: Choose `caketohome.com` or `cakes2home.com`.
- [ ] **2. DNS Provider Access**: Access to Namecheap / GoDaddy / Cloudflare to add A/CNAME records.
- [ ] **3. Hosting Platform**: Provision Container VPS (DigitalOcean / Hetzner / AWS) or select PaaS.
- [ ] **4. Production Supabase Project**: Initialize dedicated Supabase project (separate from dev).
- [ ] **5. Production n8n Host**: Deploy n8n workspace or provide existing webhook URL.

### Category 2: Third-Party Gateway Credentials
- [ ] **6. Razorpay Live Credentials**: Live Key ID (`rzp_live_...`) and Key Secret.
- [ ] **7. Meta WhatsApp Business Account**: Live WABA ID, Phone Number ID, and System User Token.
- [ ] **8. Meta Message Templates**: Approved WhatsApp templates for order lifecycle notifications.

### Category 3: Statutory Master Data
- [ ] **9. Company Legal Profile**: Legal Name, Address, PAN, State GSTINs, and FSSAI License Number.
- [ ] **10. Active Kitchen List**: Physical launch addresses, operational hours, and manager contacts.
- [ ] **11. Staff Directory**: Employee names, mobile phone numbers, and operational roles.
- [ ] **12. Launch Product Catalog**: Cake catalog, retail prices, GST rates (5% cakes, 18% merchandise).

### Category 4: Financial Governance
- [ ] **13. CA-Certified Opening Trial Balance**: Finalized opening balance sheet from client accountant.
- [ ] **14. Authorized Accounting Start Date**: Approved go-live accounting date (e.g. `2026-11-01`).
- [ ] **15. Opening Bank Reconciliation**: Opening bank balances for settlement bank account.

---

## 23. Infrastructure Cost Category Breakdown

| Infrastructure Component | Cost Tier | Account Ownership | Estimated Category |
| :--- | :--- | :--- | :--- |
| **Production PostgreSQL (Supabase)** | Paid (Pro Tier: ~$25/mo) | Client Owned | Required for production compute, connection pooler, daily backups & PITR. |
| **Application Hosting (Container VPS)** | Paid (VPS: ~$20–$40/mo) | Client Owned | Required for 2 vCPU / 4 GB RAM container runner (Next.js + Medusa). |
| **Domain Registration & DNS** | Paid (~$12/year) | Client Owned | Existing asset owned by client. Cloudflare DNS is free. |
| **SSL / TLS Certificates** | Free ($0) | Managed | Free via Let's Encrypt / Certbot / Cloudflare. |
| **Payment Gateway (Razorpay)** | Transactional (2% per tx) | Client Owned | Standard merchant fees deducted automatically per successful payment. |
| **WhatsApp Notifications (Meta)** | Transactional (~$0.01/msg)| Client Owned | Billed directly by Meta per marketing/utility conversation. |
| **Automation Engine (n8n)** | Free self-hosted or Cloud | Client Owned | Self-hosted on VPS ($0 added) or n8n Cloud subscription. |
| **Media Storage (Local vs S3)** | Free (Local) or ~$5/mo | Client Owned | Local host volume is $0; S3/R2 object storage is low-cost utility billing. |

---

## 24. PRG-01 Production Readiness Matrix

| Area | Current Status | Blocker? | Owner | Input Required | Target Step | Verification Method |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Domain** | 2 domains referenced | **YES** | Client | Select primary domain | Step 2 / 6 | Client written confirmation |
| **2. DNS** | Not configured for prod | **YES** | Client / DevOps | Access to DNS control panel | Step 6 | `dig` / `nslookup` resolution |
| **3. Hosting** | Not selected | **YES** | Client | Select VPS / PaaS option | Step 2 / 6 | Host provisioned & SSH active |
| **4. Database** | Unprovisioned in prod | **YES** | Client / DevOps | Create Prod Supabase project | Step 3 | TLS connection probe on port 6543 |
| **5. Secrets** | Templates ready | **YES** | DevOps | Generate strong production keys | Step 3 / 6 | Container env inspection |
| **6. RLS** | 34 tables need hardening| **YES** | Engineering | Execute Step 3 RLS script | Step 3 | `pg_tables` audit confirms 309 enabled |
| **7. API** | Verified 100% frozen | NO | Engineering | None | Complete | 1,242 assertion regression suite |
| **8. Frontend** | Verified 100% frozen | NO | Engineering | None | Complete | TypeScript 0 errors / build check |
| **9. Backend** | Verified 100% frozen | NO | Engineering | None | Complete | Medusa startup check |
| **10. Payments**| Sandbox keys in dev | **YES** | Client | Live Razorpay Key & Secret | Step 4 | Signature verification test |
| **11. WhatsApp**| Mock dispatch in dev | **YES** | Client | Meta WABA ID & Access Token | Step 4 | Diagnostic test ping to n8n |
| **12. n8n** | Test webhooks active | **YES** | DevOps / Client | Production n8n instance URL | Step 4 | HMAC webhook delivery check |
| **13. Storage** | Local uploads working | NO | DevOps | Persistent volume mount | Step 3 | File upload & Sharp test |
| **14. Backups** | Dev backups active | **YES** | DevOps | Enable PITR on Prod project | Step 3 | Supabase dashboard audit |
| **15. Monitor** | Error boundaries active| NO | DevOps | Configure UptimeRobot URL | Step 6 | Synthetic HTTP check |
| **16. Company** | Dev placeholders | **YES** | Client | PAN, GSTIN, Legal Name | Step 4 | Master data query check |
| **17. Branch** | 57 dev branches | **YES** | Client | Launch kitchen addresses | Step 4 | `public.branch` query check |
| **18. Staff** | Pre-seeded mock staff | **YES** | Client | Real staff names & roles | Step 4 | Login session test |
| **19. Products**| 65 dev products | **YES** | Client | Authoritative launch menu | Step 4 | Catalog pricing check |
| **20. CoA Seed**| 99-account seed ready | NO | Engineering | Execute Step 3 seed runbook | Step 3 | `SELECT count(*) FROM accounting_account` === 99 |
| **21. Start Date**| Unconfigured in prod | **YES** | Client / CA | Approved start date | Step 5 | Start date locked immutable |
| **22. Open Bal**| Zero balances | **YES** | Client / CA | Certified Trial Balance | Step 5 | Debits == Credits invariant verified |
| **23. Deploy** | Dockerfiles ready | NO | DevOps | Execute Step 6 deploy script | Step 6 | Container port 3000/9000 healthy |
| **24. Cutover** | Pending hosting/DNS | NO | DevOps | Update DNS A/CNAME records | Step 6 | Browser navigation test |
| **25. Smoke** | Automated suites ready | NO | Engineering | Run read-only smoke suite | Step 7 | 100% pass on live domain |

---

## 25. Step 3 Entry Criteria

PRG-01 Step 3 (**Security Hardening & Clean Production Database Migration**) must **NOT** be initiated until the following mandatory prerequisites are met:

### Mandatory Entry Gates for Step 3:
1. **Production Supabase Project Created**: Client or DevOps has created a fresh, isolated PostgreSQL 17.6 Supabase project and provided the secure database URL.
2. **Production Hosting Platform Confirmed**: Client has designated the hosting environment (Container VPS, Render, or AWS).
3. **Database Secrets Available**: Master database password and connection string are securely accessible to the deployment engineer.
4. **Frozen Application Status Preserved**: Git repository confirms zero unauthorized source code changes.

*(Client master data, live payment keys, and WhatsApp credentials can be collected during Step 3 in preparation for Step 4).*

---

## 26. Verification & Stop Condition

### Post-Creation Verification:
- **Git Working Tree**: Verified clean with zero source code alterations. Only planning documentation and sanitized templates were added.
- **Database Baseline**: Development database remains 100% pristine (173 active orders, 0 accounting vouchers, 0 journal entries, 0 invoices).
- **Zero Production Mutation**: Zero cloud servers, databases, or live credentials were provisioned.

### Status Declaration:
$$\mathbf{PRG-01\ STEP\ 2:\ COMPLETE}$$
$$\mathbf{STATUS:\ READY\ FOR\ CLIENT\ PROCUREMENT\ \&\ CONFIGURATION}$$
$$\mathbf{NEXT\ STEP:\ PRG-01\ STEP\ 3\ (Security\ Hardening\ \&\ Clean\ Production\ DB\ Migration)}$$

*(Execution halted in accordance with gate protocol. Standing by for client procurement and instructions to proceed to Step 3).*

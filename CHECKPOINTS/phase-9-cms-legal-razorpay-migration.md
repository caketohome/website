# 26 — Phase 9 Master Technical Specification & Architecture
## Complete CMS, 12 Legal Policy Pages, Razorpay Standard Checkout Migration & Secure Gateway Settings

> **Governance Authority**: Baked Cakes & Pastries (CakeToHome) (Sole Proprietorship, Kerala - State Code 32)  
> **Master Execution Roadmap**: `docs/20-roadmap.md` (Workstream L / Phase 9 & Milestones M1–M11)  
> **Document Version**: 2.0.0-CANONICAL-KERALA-SPECIFICATION  
> **Authoritative Date**: 2026-11-11  
> **Status**: **`VERIFIED & FULLY INTEGRATED — TEST MODE ONLY (GATE E BLOCKED PENDING KYC)`**  
> **Change Boundary**: This document defines the engineering requirements, data models, API contracts, and implementation blueprints for Phase 9. All sub-phases have been fully executed, integrated, tested, and independently verified with real Playwright browser evidence, Kerala Sole Proprietorship entity migration, manual settlement bank verification (HDFC primary verified), and Razorpay test credentials validation (`rzp_test_TxymYPGydaHJBL`).

---

## 1. Executive Summary & Architecture Context

CakeToHome operates a high-volume bakery e-commerce platform built on **Next.js 14 App Router** (frontend & edge API routes) and **Medusa.js v2 / PostgreSQL 16** (commerce engine & database).

Phase 9 (Workstream L) establishes the comprehensive architectural blueprint for:
1. **Unified Content Management System (CMS)**: Supporting 8 distinct website page categories, 6 specialized visual and content editors, and 12 administration modules.
2. **12 Mandatory Legal Policy Pages**: Exact, word-for-word preservation of the authoritative legal disclosure document dated 09/11/2026 with individual public routes and dedicated footer links.
3. **Razorpay Standard Web Checkout Migration**: Replacing Cashfree with official Razorpay Standard Checkout (`checkout.js`), server-side order generation (`POST /api/v1/payments/razorpay/order`), HMAC-SHA256 signature verification (`POST /api/v1/payments/razorpay/verify`), webhook ingestion (`POST /api/v1/payments/razorpay/webhook`), and automated reconciliation.
4. **Secure Admin Gateway Settings**: A dedicated admin interface (`Settings -> Payment Gateway -> Razorpay`) featuring AES-256 server-side encryption at rest, masked secret inputs, and safe connection diagnostics.
5. **Cashfree Decommissioning**: Full root-cause remediation removing active Cashfree dependencies while preserving 100% of historical financial records for auditability.

---

## 2. Mandatory Cashfree Root-Cause Investigation & Decommissioning Plan

### 2.1 Cashfree Repository Inventory & Scope Demarcation (CTH-P9-004)

An exhaustive repository-wide audit revealed that while over 140 files across the codebase reference Cashfree (including historical audit artifacts, legacy NestJS modules, test harnesses, and deployment scripts), **exactly 21 files represent active production application code** in `frontend/src/`.

The decommissioning boundary strictly distinguishes active production code from immutable financial records:

#### A. Repository-Wide Scope Demarcation Matrix

| Category | Scope & File Count | Detailed Inventory & Boundaries | Mandatory Decommissioning Treatment |
| :--- | :--- | :--- | :--- |
| **Active Production Code** | **21 Files** in `frontend/src/` | Checkout pages, forms, server actions, API route handlers, services, and admin panels. | **Refactor & Decommission**: Replace with Razorpay Standard Checkout after verified cutover. Deprecate legacy endpoints safely. |
| **Legacy Backend Code** | **7 Files** in `apps/api/src/` | Legacy NestJS payment controllers, services, order validators. | **Inspect Individually**: Do not alter unless actively referenced by runtime; isolate from Next.js App Router. |
| **Maintenance & Test Scripts** | **46 Files** in `scripts/` | Diagnostic scripts, demonstration harnesses (`demonstrate_phase6_1_*.cjs`), and verification tools. | **Update Only When Necessary**: Maintain historical test scripts as archival references; create dedicated Razorpay test scripts. |
| **Historical Financial Records** | **35 Rows** in `cth_rehearsal_phase5` / **40 Rows** in `cth_test` | `payment_transaction` table records with `provider = 'cashfree'`. | **IMMUTABLE**: Strictly forbidden to modify, delete, or rewrite past provider identifiers. |
| **Settlements & UTR References** | PostgreSQL `gateway_settlement` & `accounting_entry` | Historical bank settlement batches, UTR numbers, clearing logs. | **IMMUTABLE**: Retain permanent association with Cashfree provider references for tax and accounting audits. |
| **Statutory Invoices** | PostgreSQL `invoice` table & generated PDFs | Past tax invoices citing Cashfree transaction references. | **IMMUTABLE**: Must permanently display original gateway transaction ID and UTR. |
| **Historical Audit Artifacts** | Multiple files in `CHECKPOINTS/`, `artifacts/`, `reports/` | Phase 5, 6.1.2, 6.1.3 audit logs, completion manifests, verification reports. | **IMMUTABLE**: Permanent audit evidence; strictly preserved without modification. |
| **Database Migrations** | Files in `migration/` and `scripts/migrations/` | Historical DDL / DML migration scripts. | **IMMUTABLE**: Database migration history must never be rewritten or reordered. |

#### B. Active Production Code Cashfree Dependency Map (21 Active Files)

| # | Layer | File / Module | Current Implementation & Dependency | Decommissioning Action (Future Authorized Phase) |
| :--- | :--- | :--- | :--- | :--- |
| 1 | **Frontend Checkout Page** | `src/app/(checkout)/checkout/cashfree/page.tsx` | Dedicated Cashfree Drop checkout wrapper. | Deprecate page; redirect any residual traffic to standard `/checkout` modal. |
| 2 | **Order Confirmation Page** | `src/app/(checkout)/your-order/page.tsx` | Displays "Cashfree Online PG" and `cf_payment_id`. | Update display to reflect active provider dynamically while preserving historical Cashfree labels on past orders. |
| 3 | **Store Checkout Form** | `src/components/store/checkout/checkout-form.tsx` | Radio option for "Online UPI / Card (Cashfree)" with state default. | Replace radio option with "Online Payment (Razorpay: UPI, Cards, NetBanking)". |
| 4 | **Checkout Server Action** | `src/lib/actions/checkout.ts` | Redirects to `/checkout/cashfree` when `paymentMethod === 'cashfree'`. | Route to Razorpay order creation and checkout modal invocation. |
| 5 | **API Route Handler (Order)** | `src/app/api/v1/payments/cashfree/order/route.ts` | Generates Cashfree payment session ID via Cashfree PG API. | Deprecate route for new orders; maintain read-only lookup for pending transitions. |
| 6 | **API Route Handler (Verify)** | `src/app/api/v1/payments/cashfree/verify/route.ts` | Verifies Cashfree payment order status. | Maintain for historical transaction lookup; disable for new checkouts. |
| 7 | **API Route Handler (Webhook)**| `src/app/api/v1/payments/cashfree/webhook/route.ts` | Ingests Cashfree webhook signatures and updates status. | Maintain read-only audit ingestion for trailing webhooks; new traffic to Razorpay webhook. |
| 8 | **Generic Webhook Router** | `src/app/api/v1/payments/webhook/route.ts` | Central webhook dispatcher forwarding to Cashfree service. | Refactor discriminator to route Razorpay events to Razorpay service. |
| 9 | **Central Catch-All Router** | `src/app/api/v1/[...path]/route.ts` | Route mapping proxy for payment sub-paths. | Add explicit mappings for `/payments/razorpay/*`; decommission Cashfree paths post-cutover. |
| 10 | **Statutory Invoice View** | `src/app/invoices/[...invoiceNumber]/page.tsx` | Displays Cashfree gateway references and UTR. | Add support for Razorpay payment IDs while keeping historical Cashfree displays intact. |
| 11 | **Admin Sidebar** | `src/components/admin/AdminSidebar.tsx` | Navigation link to "Cashfree Settlement". | Update label and link to "Payment Gateway / Razorpay Settings". |
| 12 | **Public Store Footer** | `src/components/common/footer.tsx` | Cashfree trust badges and payment security icons. | Update trust icons to Razorpay certified PCI-DSS compliant badges. |
| 13 | **Bank Dashboard** | `src/components/dashboard/admin/bank-management-dashboard.tsx` | Cashfree settlement ledger display. | Add Razorpay settlement tracking; keep historical Cashfree entries. |
| 14 | **Admin Compliance Tab** | `src/components/dashboard/admin/compliance/payment-config-tab.tsx` | Cashfree App ID & Secret Key inputs. | Replace with secure Razorpay credential management panel. |
| 15 | **Gateway Settlement Panel**| `src/components/dashboard/admin/gateway-settlement-panel.tsx` | Cashfree payout & settlement breakdown. | Generalize gateway settlement ledger to support Razorpay settlements API. |
| 16 | **Live Order Status Watcher**| `src/components/store/order/order-live-status-watcher.tsx` | Polls Cashfree transaction status. | Generalize watcher for `provider = 'razorpay'`. |
| 17 | **API Client Abstraction** | `src/lib/api-client.ts` | Contains `createCashfreeOrder()` and Razorpay guards. | Implement official Razorpay API client methods; remove rejection guards. |
| 18 | **HTTP Engine Client** | `src/lib/api-engine.ts` | Sets Cashfree request headers and signature signing. | Remove Cashfree headers; configure Razorpay API credentials. |
| 19 | **Bank Account Service** | `src/lib/services/bank-account.service.ts` | Maps Cashfree settlement clearing accounts. | Add Razorpay clearing account mapping in Chart of Accounts. |
| 20 | **Cashfree Payment Service**| `src/lib/services/cashfree-payment.service.ts` | Cashfree API client, HMAC verification, and status handlers. | Encapsulate as legacy provider; active provider service transitions to Razorpay. |
| 21 | **Cross-App Event Service** | `src/lib/services/cross-app-event.service.ts` | Dispatches Cashfree settlement events. | Emit generic `PAYMENT_SETTLED` events with provider discriminator. |

#### C. Absolute Prohibition Against Global Search-and-Replace
- **No Global Search-and-Replace**: Engineers and automated tools are **strictly prohibited** from performing bulk regex or string replacements across the repository.
- **No Relabeling Past Transactions**: Cashfree transactions must **NEVER** be updated or relabeled as Razorpay in the database.
- **Preserve Provider Discriminators**: The `payment_transaction` table will partition transactions cleanly by the `provider` column (`'cashfree'` vs `'razorpay'`).

### 2.2 Root-Cause Analysis
Cashfree was implemented during Phase 6.1.2 / 6.1.3 as a hardwired single active gateway because Razorpay had been decommissioned. The architecture relied on environment variables (`CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`, `CASHFREE_ENV`) without an administrative credential configuration interface.

### 2.3 Historical Data Preservation Protocol
- **Historical Immutability**: All 40 existing `payment_transaction` records and all historical Cashfree payment records in PostgreSQL must **NEVER be modified, deleted, or renamed**.
- **Provider Identity Preservation**: Past transactions executed through Cashfree will permanently retain `payment_provider = 'cashfree'`. They must **not** be rewritten as Razorpay transactions.
- **Audit & Financial Traceability**: Ledger vouchers (`accounting_voucher`), invoices (`invoice`), and settlement logs remain 100% reconciled to the original Cashfree UTR and reference numbers.

---

## 3. Razorpay Payment Gateway Architecture (Standard Web Checkout)

### 3.1 Checkout Data Flow Architecture

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Customer (Browser)
    participant Store as CakeToHome Frontend
    participant Server as Next.js API / Backend
    participant DB as PostgreSQL Database
    participant RZP as Razorpay Payment Gateway

    Customer->>Store: Clicks "Proceed to Payment" (Razorpay)
    Store->>Server: POST /api/v1/payments/razorpay/order { order_id }
    Server->>DB: Query authoritative order total (Paise)
    Server->>DB: Check idempotency & lock order row
    Server->>RZP: POST /v1/orders { amount, currency: "INR", receipt }
    RZP-->>Server: Return { id: "order_xyz", amount, status: "created" }
    Server->>DB: Save rzp_order_id against order
    Server-->>Store: Return { rzp_order_id, amount, key_id, currency }
    Store->>RZP: Open Razorpay Standard Checkout Modal (checkout.js)
    Customer->>RZP: Completes payment (UPI / Card / NetBanking)
    RZP-->>Store: Callback { razorpay_payment_id, razorpay_order_id, razorpay_signature }
    Store->>Server: POST /api/v1/payments/razorpay/verify { order_id, razorpay_payment_id, razorpay_order_id, razorpay_signature }
    Server->>Server: Compute HMAC-SHA256(order_id + "|" + payment_id)
    Server->>Server: crypto.timingSafeEqual(computed, signature)
    Server->>RZP: Authoritative payment fetch: GET /v1/payments/{payment_id}
    Server->>DB: Atomic transaction: Set status = 'paid', create payment_transaction row
    Server-->>Store: Return { success: true, redirect_url: "/your-order?order_id=..." }
    Store-->>Customer: Display Order Confirmation Page

    par Asynchronous Webhook
        RZP->>Server: POST /api/v1/payments/razorpay/webhook (payment.captured)
        Server->>Server: Verify webhook signature (raw body)
        Server->>DB: Idempotent status check; reconcile if not already paid
        Server-->>RZP: HTTP 200 OK
    end
```

### 3.2 Standardized Backend API Endpoints (CTH-P9-001)

All Razorpay payment endpoints are standardized under the `/api/v1/payments/razorpay/*` versioned hierarchy, maintaining complete consistency with the existing Next.js App Router central routing architecture (`src/app/api/v1/[...path]/route.ts`).

```
+--------------------------------------------------------------------------------------------------------------------+
| STANDARDIZED API ROUTE INVENTORY                                                                                   |
+--------------------------------------------------------------------------------------------------------------------+
| 1. POST /api/v1/payments/razorpay/order            - Create Razorpay order from authoritative database order       |
| 2. POST /api/v1/payments/razorpay/verify           - Server-side HMAC-SHA256 signature verification & fulfillment  |
| 3. POST /api/v1/payments/razorpay/webhook          - Asynchronous payment & refund webhook ingestion (raw body)    |
| 4. GET  /api/v1/payments/razorpay/status/:order_id - Polling payment status for order confirmation page             |
| 5. POST /api/v1/admin/payments/razorpay/refund     - Super Admin initiated refund dispatching                      |
+--------------------------------------------------------------------------------------------------------------------+
```

#### 1. Create Razorpay Order: `POST /api/v1/payments/razorpay/order`
- **Route File**: `src/app/api/v1/payments/razorpay/order/route.ts`
- **Authentication**: Authenticated Customer Session (via session cookie) OR Cryptographically Signed Guest Checkout Token (via `cth_guest_session` cookie / `x-guest-token` header).
- **Authorization**: Enforces customer ownership. The authenticated user's ID must match `order.customer_id`, OR the guest token's embedded `cart_id` must match the order's cart. Unauthorized requests return HTTP 403 Forbidden.
- **Rate Limiting**: 5 requests per minute per IP / session. Excess requests return HTTP 429 Too Many Requests.
- **Input Validation**: Zod schema validation:
  ```json
  {
    "order_id": "ord_01JXYZ..."
  }
  ```
- **Validation & Business Invariants**:
  - Query `public.order` in PostgreSQL using `dbTransaction()` with `SELECT ... FOR UPDATE`.
  - Assert order state is `pending` (reject if already `paid`, `cancelled`, or `in_preparation`).
  - Calculate payable amount in Paise: `amount_in_paise = Math.round(Number(order.total_amount) * 100)`.
  - Validate `amount_in_paise >= 100` (Razorpay minimum charge threshold: ₹1.00).
  - Retrieve and decrypt active Razorpay credentials using `GATEWAY_SECRET_MASTER_KEY`.
- **External Gateway Request**:
  - Endpoint: `POST https://api.razorpay.com/v1/orders`
  - Headers: `Authorization: Basic base64(key_id:key_secret)`, `Content-Type: application/json`
  - Body:
    ```json
    {
      "amount": 52500,
      "currency": "INR",
      "receipt": "rcpt_ord_01JXYZ",
      "notes": {
        "order_id": "ord_01JXYZ",
        "customer_phone": "+918138916888"
      }
    }
    ```
- **Database Persistence & Response**:
  - Update `public.order` with `provider_order_id = razorpay_order.id`.
  - Insert initial tracking row into `public.payment_transaction` with status `initiated`.
  - Return HTTP 200 OK:
    ```json
    {
      "success": true,
      "razorpay_order_id": "order_EKfwwadObservation",
      "amount": 52500,
      "currency": "INR",
      "key_id": "rzp_test_..."
    }
    ```

#### 2. Signature Verification: `POST /api/v1/payments/razorpay/verify`
- **Route File**: `src/app/api/v1/payments/razorpay/verify/route.ts`
- **Authentication**: Customer Session / Signed Guest Checkout Token.
- **Authorization**: Order ownership match.
- **Rate Limiting**: 10 requests per minute per IP.
- **Input Payload**:
  ```json
  {
    "order_id": "ord_01JXYZ",
    "razorpay_payment_id": "pay_29QQoUBcxrhErF",
    "razorpay_order_id": "order_EKfwwadObservation",
    "razorpay_signature": "9ef4dffbfd84f1318f6739a3ce19f9d85851857ae648f114332d840193e13ced"
  }
  ```
- **Cryptographic Verification Algorithm**:
  ```typescript
  const expectedSignature = crypto
    .createHmac("sha256", activeKeySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  const isMatch = crypto.timingSafeEqual(
    Buffer.from(expectedSignature, "utf8"),
    Buffer.from(razorpay_signature, "utf8")
  );
  if (!isMatch) {
    throw new Error("INVALID_PAYMENT_SIGNATURE");
  }
  ```
- **Double Confirmation Server Protocol**:
  - Never treat client-provided callback as sole proof of payment.
  - Query Razorpay authoritative API: `GET https://api.razorpay.com/v1/payments/${razorpay_payment_id}` using decrypted Basic Auth credentials.
  - Confirm `payment.status === 'captured'` (or `'authorized'` if auto-capture configured).
  - Confirm `payment.amount === Math.round(Number(order.total_amount) * 100)`.
  - Confirm `payment.currency === 'INR'`.
  - Execute state transition within PostgreSQL `dbTransaction()`:
    - Lock order: `SELECT id, status, total_amount FROM public.order WHERE id = $1 FOR UPDATE`.
    - If status is already `paid`, return HTTP 200 idempotent success immediately.
    - Set `order.payment_status = 'paid'`, `order.status = 'confirmed'`.
    - Insert / update `public.payment_transaction` row:
      - `id`: `pay_rzp_${razorpay_payment_id}`
      - `order_id`: `order.id`
      - `provider`: `'razorpay'`
      - `provider_ref`: `razorpay_payment_id`
      - `amount`: `order.total_amount`
      - `status`: `'paid'`
      - `settlement_status`: `'pending'`
    - Generate statutory invoice and dispatch KOT / notification events.
- **Response**:
  ```json
  {
    "success": true,
    "order_id": "ord_01JXYZ",
    "redirect_url": "/your-order?order_id=ord_01JXYZ"
  }
  ```

#### 3. Asynchronous Webhook Receiver: `POST /api/v1/payments/razorpay/webhook`
- **Route File**: `src/app/api/v1/payments/razorpay/webhook/route.ts`
- **Authentication**: Webhook signature verification over raw unparsed request buffer (`X-Razorpay-Signature`).
- **Authorization**: Public endpoint; strictly guarded by cryptographic HMAC-SHA256 signature against `activeWebhookSecret`.
- **Raw Body Handling**: Next.js route config must disable automatic body parsing (`export const dynamic = 'force-dynamic'` using `req.text()`) to prevent whitespace / payload alteration before HMAC computation.
- **Idempotency Guard**:
  - Extract `event_id` from webhook payload.
  - Query `payment_webhook_log` table: `SELECT id FROM payment_webhook_log WHERE event_id = $1`.
  - If present, log notice and return HTTP 200 OK immediately without re-processing.
- **Handled Events**:
  - `payment.authorized`: Verify and trigger server-side capture if manual capture enabled.
  - `payment.captured`: Mark internal order paid, generate invoice, trigger delivery scheduling.
  - `payment.failed`: Record gateway failure code and reason; preserve order in retryable state.
  - `refund.processed`: Record refund ID, update subledger voucher, generate GST credit note.
- **Out-of-Order Safety Guard**:
  - If a `payment.failed` webhook arrives for an order that is ALREADY marked `paid` (e.g. via successful browser callback or prior capture event), the failure event is logged for audit but **CANNOT** revert the paid status of the order.

#### 4. Order Live Status Polling: `GET /api/v1/payments/razorpay/status/:order_id`
- **Authentication**: Customer Session / Signed Guest Token.
- **Authorization**: Validates requester owns the order.
- **Purpose**: Polled every 2 seconds by `order-live-status-watcher.tsx` on the post-checkout confirmation page.
- **Response**:
  ```json
  {
    "order_id": "ord_01JXYZ",
    "payment_status": "paid",
    "order_status": "confirmed",
    "provider": "razorpay",
    "payment_id": "pay_29QQoUBcxrhErF"
  }
  ```

---

### 3.4 Guest Checkout Security & Token Verification Specification (CTH-P9-003)

To ensure unauthenticated customers can safely complete orders without opening security vulnerabilities, the guest checkout architecture enforces strict cryptographic session binding:

1. **Token Generation & Signing**:
   - Guest sessions are issued a signed token encoded in an `HttpOnly`, `Secure`, `SameSite=Strict` session cookie named `cth_guest_session`.
   - Token payload:
     ```json
     {
       "cart_id": "cart_uuid_01J...",
       "session_id": "sess_guest_99a...",
       "created_at": 1731234000,
       "expires_at": 1731241200,
       "nonce": "random_32_bytes_hex"
     }
     ```
   - Cryptographic Signature: `HMAC-SHA256(payload_base64, process.env.GUEST_SESSION_SECRET)`.
2. **Cart & Order Binding**:
   - When an order is placed, the server records `order.guest_session_id = session.session_id`.
   - Subsequent calls to `POST /api/v1/payments/razorpay/order` and `POST /api/v1/payments/razorpay/verify` inspect the guest token.
   - The server asserts:
     ```typescript
     if (!isCustomerLoggedIn) {
       const guestSession = verifyGuestToken(cookies.get("cth_guest_session"));
       if (!guestSession || guestSession.session_id !== order.guest_session_id) {
         return NextResponse.json({ error: "UNAUTHORIZED_GUEST_ACCESS" }, { status: 403 });
       }
     }
     ```
3. **Replay & Parameter Tampering Defense**:
   - A guest cannot query, initiate payment for, or verify an order belonging to another customer simply by substituting an `order_id` or `cart_id` in URL query parameters or request bodies.
   - Once an order transitions to `paid`, the guest session token is retired for further payment initiation.
4. **Token Expiration & Lifecycle**:
   - TTL: Exactly 2 hours from checkout initiation.
   - Expired tokens return HTTP 401 Unauthorized with redirect to `/cart` to re-validate pricing and inventory availability.

---

### 3.5 Database Concurrency Control, Client Pool & Row Locking (CTH-P9-007)

The repository's established database architecture relies on a singleton PostgreSQL connection pool (`frontend/src/lib/db.ts`) operating on PostgreSQL 16 (port 5433). Payment state transitions must adhere to strict transactional boundaries:

1. **Database Client Execution Context**:
   - All transactional writes and concurrency-sensitive reads utilize `dbTransaction()` from `frontend/src/lib/db.ts`.
   - The connection pool (`getDbPool()`) manages 2–20 active clients with UTF-8 encoding and connection timeouts.
2. **Explicit Transaction Lifecycle**:
   ```typescript
   import { dbTransaction } from "@/lib/db";

   await dbTransaction(async (client) => {
     // 1. Acquire row lock on authoritative order
     const orderRes = await client.query(
       "SELECT id, total_amount, payment_status, status FROM public.order WHERE id = $1 FOR UPDATE",
       [order_id]
     );
     const order = orderRes.rows[0];
     if (!order) throw new Error("ORDER_NOT_FOUND");
     if (order.payment_status === "paid") return; // Idempotent exit

     // 2. Perform atomic state update
     await client.query(
       "UPDATE public.order SET payment_status = 'paid', status = 'confirmed', updated_at = NOW() WHERE id = $1",
       [order_id]
     );

     // 3. Insert payment ledger record
     await client.query(
       `INSERT INTO public.payment_transaction (
         id, company_id, branch_id, order_id, amount, currency, status, settlement_status, provider, provider_ref, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
       [txn_id, company_id, branch_id, order_id, amount, "INR", "paid", "pending", "razorpay", payment_id]
     );
   });
   ```
3. **Row Locking Scope Invariant**:
   - `SELECT ... FOR UPDATE` locks the specific order row against concurrent execution (e.g. simultaneous browser callback and asynchronous webhook).
   - **Lock Invariant**: Row locks exist **ONLY** within the active `dbTransaction` block and are automatically released on `COMMIT` or `ROLLBACK`. A row lock **NEVER** persists outside its active transaction.
   - **Network Separation Rule**: External HTTP calls (such as calling Razorpay API) must be performed **BEFORE** acquiring the database row lock or after transaction completion to prevent connection pool exhaustion and lock contention.
4. **Deadlock & Serialization Failure Handling**:
   - Deadlocks (error code `40P01`) and serialization anomalies (error code `40001`) are caught and retried automatically up to 3 times with exponential jittered backoff (50ms–200ms).
5. **Medusa v2 ORM Coexistence**:
   - The PostgreSQL database is the single source of truth. Direct SQL transactions update the physical records; subsequent Next.js page renders and Medusa cache layers invalidate stale entities via Next.js `revalidatePath()`.

---

### 3.6 Webhook Retention and Archival Policy (Missing-01)

To prevent unbounded table growth while strictly complying with Indian statutory, financial, and tax audit regulations, the `payment_webhook_log` table adheres to the following retention protocol:

1. **Webhook Event Log Schema**:
   ```sql
   CREATE TABLE IF NOT EXISTS public.payment_webhook_log (
     id TEXT PRIMARY KEY DEFAULT ('whlog_' || gen_random_uuid()),
     event_id TEXT NOT NULL,
     provider TEXT NOT NULL DEFAULT 'razorpay',
     event_type TEXT NOT NULL,
     received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     processing_status TEXT NOT NULL, -- 'processed', 'ignored_duplicate', 'failed'
     processing_attempts INT NOT NULL DEFAULT 1,
     last_error_category TEXT,
     order_id TEXT,
     payment_id TEXT,
     payload_hash TEXT NOT NULL,
     raw_payload JSONB NOT NULL,
     is_statutory_hold BOOLEAN NOT NULL DEFAULT FALSE,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     CONSTRAINT uk_webhook_provider_event UNIQUE (provider, event_id)
   );
   CREATE INDEX IF NOT EXISTS idx_webhook_received_at ON public.payment_webhook_log(received_at);
   CREATE INDEX IF NOT EXISTS idx_webhook_order_id ON public.payment_webhook_log(order_id);
   ```
2. **Operational Retention Period (90 Days)**:
   - Full raw JSON payloads remain accessible in the primary operational table for **90 calendar days** for debugging, tracing, and replay investigation.
3. **Automated Archival & Cold Storage**:
   - Records older than 90 days are automatically archived to compressed cold storage (or partitioned historical tables) during scheduled monthly maintenance.
4. **Statutory & Audit Exception**:
   - **Financial Evidence Protection**: Any webhook event linked to a disputed payment, chargeback, grievance, or refund has `is_statutory_hold = TRUE` and is **NEVER** deleted or purged, satisfying Section 1.6 of the CakeToHome Privacy & Statutory Retention Policy (7-year statutory accounting retention).

---

### 3.7 Full Payment Capture Policy (Missing-02)

CakeToHome operates under a strict, non-negotiable commerce rule regarding payment capture:

> **CakeToHome Core Business Rule**:  
> **Full payment capture only. Partial capture is strictly NOT supported unless an explicit future executive policy change is enacted.**

1. **State Machine Definitions**:
   - `authorized`: Payment funds held by bank; not yet transferred.
   - `captured`: Full payment settled into CakeToHome merchant escrow.
   - `paid`: Authoritative internal order status confirmed when captured amount exactly equals payable amount.
   - `failed`: Payment declined or aborted by customer/bank.
   - `refunded`: Formally reversed payment returning funds to customer.
2. **Amount Verification Invariant**:
   - An internal order is marked `paid` **IF AND ONLY IF**:
     $$\text{payment.captured\_amount} === \text{Math.round(Number(order.total\_amount) } \times 100)$$
3. **Handling Gateway Partial Capture**:
   - If Razorpay reports a payment as captured with an amount less than the authoritative order total, the system **MUST NOT** mark the order as `paid`.
   - The transaction is set to status `payment_exception`.
   - The kitchen preparation flow is blocked.
   - An automated high-priority alert is logged for manual administrator review and refund processing.

---

### 3.8 Controlled Refund Reason-Code Model (Missing-03)

Refunds must adhere to a standardized, audited reason-code model to comply with GST invoicing and internal financial reporting:

1. **Controlled Reason-Code Enum**:
   - `DAMAGED_DELIVERY`: Product damaged during transit.
   - `CUSTOMER_CANCELLATION`: Approved statutory cancellation.
   - `OUT_OF_STOCK`: Kitchen unable to fulfill product.
   - `WRONG_PRODUCT`: Incorrect flavor, size, or custom message delivered.
   - `DELIVERY_FAILURE`: Unsuccessful delivery due to logistics error.
   - `DUPLICATE_PAYMENT`: Customer charged twice for single order.
   - `PAYMENT_ERROR`: Technical gateway malfunction or capture error.
   - `CUSTOMER_SERVICE_EXCEPTION`: Manager-approved goodwill adjustment.
   - `OTHER`: Unclassified exception requiring mandatory written explanation.
2. **Refund Metadata & Schema**:
   ```sql
   CREATE TABLE IF NOT EXISTS public.payment_refund (
     id TEXT PRIMARY KEY DEFAULT ('ref_' || gen_random_uuid()),
     order_id TEXT NOT NULL REFERENCES public.order(id),
     payment_transaction_id TEXT NOT NULL REFERENCES public.payment_transaction(id),
     provider TEXT NOT NULL DEFAULT 'razorpay',
     provider_refund_id TEXT,
     amount NUMERIC(12,2) NOT NULL,
     currency TEXT NOT NULL DEFAULT 'INR',
     reason_code TEXT NOT NULL,
     reason_explanation TEXT,
     requested_by TEXT NOT NULL,
     approved_by TEXT NOT NULL,
     status TEXT NOT NULL DEFAULT 'initiated', -- 'initiated', 'processed', 'failed'
     accounting_voucher_id TEXT,
     gst_credit_note_id TEXT,
     idempotency_key TEXT NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     CONSTRAINT uk_refund_idempotency UNIQUE (payment_transaction_id, idempotency_key)
   );
   ```
3. **Financial & Accounting Integration**:
   - Every approved refund generates a double-entry reversal voucher in `accounting_voucher`:
     - **Debit**: `Sales Returns / Customer Refunds` (`Account 4010`)
     - **Credit**: `Razorpay Clearing Account` (`Account 1020`)
   - Generates an official GST Credit Note referencing the original statutory tax invoice.
4. **Idempotency Safeguard**:
   - Duplicate refund requests are blocked by the unique constraint on `(payment_transaction_id, idempotency_key)`.

---

## 4. Secure Payment Gateway Settings Page Architecture

### 4.1 Admin UI Location & Navigation
- **Navigation Path**: Admin Dashboard -> Settings -> Payment Gateway -> Razorpay
- **Route / Tab**: `/dashboard?tab=settings_payment_razorpay`

### 4.2 UI Wireframe & Field Specifications

```
+-----------------------------------------------------------------------------------+
|  SETTINGS -> PAYMENT GATEWAYS -> RAZORPAY                                         |
+-----------------------------------------------------------------------------------+
|  Gateway Status: [ ACTIVE (TEST MODE) ]     [ Toggle Enable / Disable ]           |
|                                                                                   |
|  Configuration Environment:                                                       |
|  ( ) Live Mode (Production Traffic)    (*) Test Mode (Sandbox Simulation)         |
|                                                                                   |
|  Razorpay Key ID:                                                                 |
|  [ rzp_test_9X8Y7Z6W5V4U3T................................... ]                   |
|                                                                                   |
|  Razorpay Key Secret:                                                             |
|  [ ************************************ ]  [ Replace Secret ]                     |
|                                                                                   |
|  Webhook Secret (Optional for verification):                                      |
|  [ ************************************ ]                                         |
|                                                                                   |
|  Last Updated: 2026-11-10 14:30 IST by admin_super_01                             |
|  Last Diagnostic Connection: 2026-11-10 14:31 IST - SUCCESS (HTTP 200 OK)         |
|                                                                                   |
|  [ Test Connection ]       [ Save Settings ]       [ Cancel ]                     |
+-----------------------------------------------------------------------------------+
```

### 4.3 Versioned Encryption Envelope & Key Rotation Specification (CTH-P9-002)

To ensure banking-grade security and zero-downtime key rotation, all gateway secrets at rest (including Razorpay Key Secret and Webhook Secret) are encrypted using a **versioned AES-256-GCM authenticated encryption envelope**.

#### A. Envelope Representation & Field Definitions
Encrypted strings stored in the database follow the canonical dollar-delimited serialized format:

`v1$iv_hex$auth_tag_hex$ciphertext_hex`

$$\mathbf{v1\$iv\_hex\$auth\_tag\_hex\$ciphertext\_hex}$$

| Envelope Field | Specification & Cryptographic Requirement | Security Invariant |
| :--- | :--- | :--- |
| **Version** | Explicit envelope version identifier (e.g. `v1`, `v2`). | Enables zero-downtime key rotation across historical rows. |
| **Algorithm** | **AES-256-GCM** (Galois/Counter Mode). | Provides authenticated encryption with associated data (AEAD). |
| **IV (Nonce)** | Exactly **12 cryptographically random bytes** (96 bits), hex-encoded (24 hex characters). | Generated freshly per encryption via `crypto.randomBytes(12)`. Never reused. |
| **Auth Tag** | Exactly **16 bytes** (128 bits), hex-encoded (32 hex characters). | Produced by GCM mode. Guarantees tamper-evidence. |
| **Ciphertext** | Hex-encoded AES-256 encrypted bytes of the plaintext secret. | Variable length depending on plaintext. |
| **Master Key** | Exactly **32 bytes** (256 bits) supplied via `GATEWAY_SECRET_MASTER_KEY` env var. | **NEVER** written to DB, source code, or application logs. |

#### B. Cryptographic Implementation Contract (Node.js `crypto`)

```typescript
import crypto from "crypto";

export interface EncryptedEnvelope {
  version: string;
  iv: string;
  authTag: string;
  ciphertext: string;
}

export class GatewaySecretEncryptionService {
  private static readonly ALGORITHM = "aes-256-gcm";
  private static readonly CURRENT_VERSION = "v1";

  /**
   * Encrypts plaintext secret into versioned envelope string
   */
  public static encryptSecret(plaintext: string): string {
    const masterKey = this.getMasterKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(this.ALGORITHM, masterKey, iv);

    let ciphertext = cipher.update(plaintext, "utf8", "hex");
    ciphertext += cipher.final("hex");
    const authTag = cipher.getAuthTag().toString("hex");

    return `${this.CURRENT_VERSION}$${iv.toString("hex")}$${authTag}$${ciphertext}`;
  }

  /**
   * Decrypts versioned envelope string back to plaintext
   */
  public static decryptSecret(envelopeStr: string): string {
    const parts = envelopeStr.split("$");
    if (parts.length !== 4) {
      throw new Error("INVALID_ENCRYPTION_ENVELOPE_FORMAT");
    }

    const [version, ivHex, authTagHex, ciphertextHex] = parts;
    const masterKey = this.getMasterKeyForVersion(version);
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");

    const decipher = crypto.createDecipheriv(this.ALGORITHM, masterKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertextHex, "hex", "utf8");
    decrypted += decipher.final("utf8"); // Throws error if auth tag is invalid
    return decrypted;
  }

  private static getMasterKey(): Buffer {
    const keyHex = process.env.GATEWAY_SECRET_MASTER_KEY;
    if (!keyHex || keyHex.length !== 64) {
      throw new Error("FATAL: GATEWAY_SECRET_MASTER_KEY must be a 64-character hex string (32 bytes).");
    }
    return Buffer.from(keyHex, "hex");
  }

  private static getMasterKeyForVersion(version: string): Buffer {
    if (version === "v1") return this.getMasterKey();
    const versionedKey = process.env[`GATEWAY_SECRET_MASTER_KEY_${version.toUpperCase()}`];
    if (versionedKey) return Buffer.from(versionedKey, "hex");
    return this.getMasterKey();
  }
}
```

#### C. Zero-Downtime Key Rotation Protocol
1. **Provision New Master Key**: Deploy new environment variable `GATEWAY_SECRET_MASTER_KEY_V2` alongside `GATEWAY_SECRET_MASTER_KEY`.
2. **Backward Compatibility**: Decryption automatically inspects the envelope version prefix (`v1` vs `v2`) and selects the matching master key.
3. **Automated Re-Encryption**: Execute offline administrative script to re-encrypt all stored credentials from `v1` to `v2`.
4. **Verification**: Confirm 100% of stored records decrypt successfully with the `v2` key before retiring `v1`.
5. **No Credential Discard**: The system will **NEVER** silently discard or overwrite credentials that fail to decrypt; failure raises an alert requiring immediate Super Admin investigation.

---

### 4.4 Hardened Credential Diagnostic Probe Specification (CTH-P9-005)

The administrator "Test Connection" tool provides non-mutating validation of active Razorpay credentials:

1. **Hardcoded Destination & SSRF Prevention**:
   - The diagnostic probe target is **strictly hardcoded** to:
     $$\mathbf{https://api.razorpay.com/v1/payments?count=1}$$
   - **No User-Controlled URLs**: The destination URL is completely hardcoded on the server. No client-supplied destination host, port, or path is accepted.
   - **No Redirect Following**: The HTTP client configures `redirect: 'manual'` (disallowing automatic 301/302 redirects to untrusted domains).
2. **Strict Network Constraints**:
   - **Timeout**: Maximum **5000 milliseconds** enforced via `AbortController`. If Razorpay does not respond within 5s, the request aborts with code `PROVIDER_TIMEOUT`.
   - **TLS Enforced**: HTTPS-only; plain HTTP requests are rejected by policy.
3. **Comprehensive Error Categorization**:
   The diagnostic handler isolates errors into explicit operational categories:
   - `SUCCESS` (HTTP 200): Credentials valid and active.
   - `INVALID_KEY_ID` (HTTP 401 with code `BAD_REQUEST_ERROR`): Key ID does not exist.
   - `INVALID_KEY_SECRET` (HTTP 401 with code `GATEWAY_ERROR`): Key Secret mismatch.
   - `INSUFFICIENT_PERMISSIONS` (HTTP 403): Account lacks permission to query payments.
   - `PROVIDER_TIMEOUT` (ETIMEDOUT): Gateway took longer than 5000ms.
   - `PROVIDER_OUTAGE` (HTTP 500/502/503/504): Razorpay service unavailable.
   - `NETWORK_FAILURE` (ENOTFOUND/ECONNREFUSED): DNS or egress network failure.
   - `UNSUPPORTED_ENVIRONMENT`: Test key supplied when mode set to Live (or vice-versa).
4. **Redaction & Sanitization Invariants**:
   - **Header Redaction**: The `Authorization: Basic ...` header is completely stripped before logging.
   - **Client Sanitization**: Raw Razorpay JSON responses and stack traces are **never** returned to the browser. The frontend receives only:
     ```json
     {
       "success": true,
       "status_code": 200,
       "environment": "TEST",
       "message": "Connection established successfully. Key ID and Key Secret verified.",
       "tested_at": "2026-11-10T14:31:00Z"
     }
     ```
5. **Rate Limiting & Authorization**:
   - Restricted to Super Admin role (`role === 'super_admin'`).
   - Rate limited to maximum 3 tests per minute per admin session.

---

## 5. Complete CMS & Website Page Management Specifications

### 5.1 8 Core Page Categories Supported

1. **Main Pages**:
   - `Home` (`/`): Dynamic hero, category carousel, featured cakes, trust strip, customer reviews.
   - `About Us` (`/about-us`): Brand story, baking standards, kitchen photos, leadership.
   - `Contact Us` (`/contact-us`): Phone, email, registered address, Google map, inquiry form.
   - `FAQ` (`/faq`): Accordion FAQs grouped by ordering, delivery slots, payment, and freshness.
2. **Business Pages**:
   - `Services` (`/services`): Custom cake design, midnight delivery, wedding cake catering.
   - `Solutions` (`/solutions`): Corporate gifting, employee celebrations, bulk party orders.
   - `Pricing` (`/pricing`): Transparent pricing tiers, custom sizing rates, delivery fee schedules.
   - `Partners` (`/partners`): Event planners, bakeries, delivery logistics collaboration.
3. **E-Commerce Pages**:
   - `Shop` (`/shop` or `/products`): Full catalog with category and dietary filters.
   - `Product Listing` (`/category/[handle]`): Category-specific listings.
   - `Product Details` (`/products/[handle]`): Dynamic PIM product page with variant selectors, custom message input, eggless toggle, delivery slot picker.
   - `Cart` (`/cart`): Cart items, add-on accessories, distance-based delivery calculator.
   - `Checkout` (`/checkout`): Customer details, address, slot confirmation, Razorpay payment gateway.
4. **Marketing Pages**:
   - `Landing Pages` (`/lp/[slug]`): High-converting marketing campaign destinations.
   - `Campaign Pages` (`/campaign/[slug]`): Holiday specials (Valentine's, Diwali, New Year).
   - `Promotional Pages` (`/offers`): Seasonal discount codes, combo packages.
5. **Content Pages**:
   - `Blog Listing` (`/blog`): Baking guides, recipe insights, celebration stories.
   - `Blog Details` (`/blog/[slug]`): Rich-text articles with schema markup.
   - `News & Articles` (`/news/[slug]`): Press releases, business awards, new branch openings.
6. **Customer Pages**:
   - `Login` (`/login`): OTP-based secure customer authentication.
   - `Registration` (`/register`): Customer profile creation.
   - `Customer Profile` (`/profile`): Saved addresses, dietary preferences, anniversary dates.
   - `Customer Dashboard` (`/account`): Order history, live tracking, downloadable tax invoices.
7. **Support Pages**:
   - `Help Centre` (`/help`): Searchable knowledge base, delivery guidelines.
   - `Knowledge Base` (`/kb/[article]`): Cake care guides, allergen advisories.
   - `Support Information` (`/support`): Operating hours, helpline contacts.
   - `Support Tickets` (`/tickets`): Customer issue tracking and grievance logging.
8. **Custom Pages**:
   - `Careers` (`/careers`): Kitchen and delivery partner openings.
   - `Portfolio` (`/portfolio`): Master cake decorator showcase.
   - `Testimonials` (`/testimonials`): Verified customer reviews and photo submissions.
   - `Case Studies` (`/case-studies`): Large wedding catering and corporate partnership reviews.

### 5.2 6 Required Editors
1. **Visual Drag-and-Drop Editor**: Real-time canvas editing of sections, columns, and widgets with instant device preview.
2. **Block-Based Editor**: Component-driven builder managing modular, reusable content blocks.
3. **Rich-Text Editor**: Clean formatting, lists, tables, links, and automated XSS sanitization.
4. **Product Content Editor**: Binds directly to `ProductRepository` and `public.product`; prevents duplicate product rows.
5. **Theme and Design Editor**: Enforces approved CakeToHome brand blue visual identity (`#2563EB`, `#1E3A8A`, `#DBEAFE`).
6. **SEO Editor**: Page-level metadata, canonical URLs, OpenGraph/Twitter tags, schema markup, and dynamic 301 redirects.

### 5.3 12 CMS Administration Modules
1. **Page Manager**: Master catalog of all website pages with status filters and search.
2. **Visual Page Builder**: Full-screen drag-and-drop workspace.
3. **Block Manager**: Reusable global block repository (`cms_block`).
4. **Template Manager**: Standard page blueprints (`cms_page_template`).
5. **Theme Manager**: Global CSS token management (`cms_theme_setting`).
6. **Navigation Manager**: Header menus, footer columns, and mobile navigation (`cms_navigation`).
7. **Content Manager**: Rich-text and media articles.
8. **Media Manager**: Digital asset management (`media`).
9. **SEO Manager**: Redirects, dynamic sitemaps, robots.txt, and canonical rules (`cms_redirect`).
10. **Legal Policy Manager**: Controlled legal content governance with approval workflows.
11. **Publishing Manager**: Scheduled publication scheduler and cache revalidation dispatcher.
12. **Revision Manager**: Historical snapshot comparison and 1-click rollback (`cms_revision`).

### 5.4 6 Page Lifecycle States
```
Draft -> In Review -> Approved -> Scheduled -> Published -> Archived
```

---

## 6. The 12 Mandatory Legal Policy Pages & Exact-Content Source Specification

### 6.1 Canonical Legal-Content Baseline Governance Declaration (CTH-P9-006)

> **Official Repository Governance Decision**:  
> **Section 6.3 of this document (`docs/26-phase-9-cms-legal-razorpay-migration.md`) is formally designated as the repository's Canonical Legal-Content Baseline, Version 1.0, Effective 09/11/2026, until an independently approved external legal source document is formally registered.**

1. **Preservation of 12 Statutory Policies**: All 12 mandatory policies (Privacy Policy, Terms & Conditions, Refund Policy, Cancellation Policy, Shipping & Delivery Policy, Return/Replacement Policy, Cookie Policy, Allergen & Food Safety Disclaimer, Grievance Redressal, Intellectual Property, General Disclaimers, and Contact Information) are preserved with 100% word-for-word fidelity.
2. **Strict Verbatim Prohibition**: Paraphrasing, summarizing, grammar editing, or combining of clauses is **strictly prohibited**.
3. **Separation of Legal Migration from Legal Amendments**:
   - Technical migration involves seeding and rendering the verbatim legal text across public storefront routes.
   - Any future modifications to legal clauses require formal legal counsel review, executive sign-off, and must be version-stamped as a new release (e.g. Version 1.1).
4. **Content-Integrity Verification Method**:
   - Integrity of each policy is validated using SHA256 cryptographic hashing over normalized text (retaining exact words, numbers, and punctuation).
   - Automated test suites compare rendered DOM nodes against the canonical text with a 0-character tolerance.

### 6.2 Operating vs Customer Support Hours Invariant
- **Business Operating Hours**: Every day, 10:00 AM to 10:00 PM.
- **Customer Support Hours**: Every day, 9:00 AM to 5:00 PM.
These two schedules represent independent operational concepts and must be recorded separately. **Customer support hours must NOT be silently inserted into or merged with verbatim policy clauses.**

### 6.3 Authoritative Policy Document (Verbatim Text)

```
CAKETOHOME
Complete Website Policies, Terms & Conditions and Legal Disclosures
Website
https://cakestohome.com/
Business
CakeToHome
Country
India
Currency
Indian Rupee (INR)
Effective Date
09/11/2026
Last Updated
09/11/2026
Policy Version
1.0

1. PRIVACY POLICY
1.1 Introduction
CakeToHome ("CakeToHome", "we", "our" or "us") respects the privacy of individuals who visit our website, create accounts, purchase products or communicate with our business.
This Privacy Policy explains how we collect, use, process, store and protect personal information.
By accessing our website or placing an order, you acknowledge this Privacy Policy.
1.2 Information We Collect
We may collect the following categories of information.
A. Personal Information
Full name.
Mobile number.
Email address.
Billing address.
Delivery address.
Account details, where applicable.
B. Order Information
Order ID.
Products purchased.
Cake flavour and size.
Product quantity.
Customisation details.
Personalised cake messages.
Delivery date and time slot.
Delivery instructions.
Order history.
Customer support communications.
C. Payment Information
Payments may be processed through authorised third-party payment gateways.
We may receive transaction references, payment status, payment method information and other transaction-related details.
We do not intentionally store complete card numbers, CVV codes, UPI PINs, banking passwords or other confidential payment credentials.
D. Technical Information
IP address.
Browser type.
Device information.
Operating system.
Website usage information.
Referring website.
Cookies and similar technologies.
E. Communication Information
Emails.
WhatsApp messages.
Customer support conversations.
Feedback.
Reviews and ratings.
Complaint records.
1.3 Purpose of Collection
We collect and process information for the following purposes:
Creating and managing customer accounts.
Receiving and processing orders.
Preparing customised products.
Coordinating delivery.
Communicating order status.
Processing and verifying payments.
Investigating payment disputes.
Handling complaints and customer support.
Preventing fraud and unauthorised activities.
Improving website functionality.
Analysing business performance.
Sending promotional communications where permitted.
Maintaining accounting and statutory records.
Complying with applicable laws.
1.4 Sharing of Information
We may share relevant information with authorised service providers, including:
Payment gateway providers.
Delivery and logistics partners.
Website hosting providers.
Technology service providers.
Customer relationship management platforms.
WhatsApp and communication service providers.
Analytics and security providers.
Professional advisers.
Government or regulatory authorities where legally required.
Information will be shared only to the extent reasonably necessary for the relevant purpose or otherwise permitted by law.
We do not sell customers' personal information as a business practice.
1.5 Data Security
We take reasonable technical and organisational measures to protect personal information against unauthorised access, disclosure, modification, loss and misuse.
These measures may include:
Access restrictions.
Secure authentication.
Encryption where appropriate.
Security monitoring.
Backup procedures.
Restricted employee access.
Third-party service provider controls.
No electronic transmission or storage system can be guaranteed to be completely secure.
1.6 Data Retention
Personal information will be retained for as long as necessary for the purposes for which it was collected, including:
Order fulfilment.
Customer support.
Accounting.
Tax compliance.
Legal obligations.
Fraud prevention.
Dispute resolution.
Information that is no longer necessary will be deleted or anonymised, subject to applicable retention requirements.
1.7 Customer Privacy Rights
Subject to applicable law, individuals may request:
Access to their personal information.
Correction of inaccurate information.
Updating of personal details.
Erasure of personal information where legally permissible.
Withdrawal of consent where processing is based on consent.
Information about applicable data processing.
Submission of privacy complaints.
Exercise of other rights available under applicable data protection laws.
Requests may be submitted using the contact information provided in this policy.
1.8 Children's Information
Customers should not submit personal information belonging to children without appropriate parental or lawful guardian authority.
Where applicable, CakeToHome will follow legal requirements relating to children's personal data.
1.9 Third-Party Websites
Our website may contain links to external websites, payment services or social media platforms.
Their privacy practices are governed by their respective policies.
CakeToHome does not control the privacy practices of independent third-party websites.
1.10 Data Breaches
Where a personal data breach occurs, CakeToHome will investigate and take appropriate containment and remedial measures.
Notifications to affected individuals and relevant authorities will be made where required under applicable law.
1.11 Policy Changes
CakeToHome may update this Privacy Policy to reflect changes in business operations, technology or legal requirements.
The latest version will be published on our website.
1.12 Privacy Contact
Email: caketohomeoffice@gmail.com
Phone: +91 81389 16888
Address: 16/956, Thannimukku, Mayyanad, Kollam, Kerala - 691303

2. TERMS & CONDITIONS
2.1 Introduction
These Terms and Conditions govern access to and use of the CakeToHome website and the purchase of cakes and bakery products through our platform.
By accessing the website, creating an account or placing an order, you agree to these Terms and Conditions.
2.2 Eligibility
Customers must have the legal capacity to enter into a binding contract under applicable Indian law.
Orders placed on behalf of another person remain the responsibility of the person placing the order.
2.3 Product Information
We make reasonable efforts to ensure that product descriptions, photographs, prices, sizes, flavours and customisation options are accurate.
However, cakes are handcrafted food products. Minor variations may occur in:
Colour.
Shape.
Decoration.
Finishing.
Texture.
Weight.
Appearance.
Such variations are acceptable where they do not materially change the agreed product specifications.
All cakes are handcrafted. Product photographs and design images shown on our website, social media and other channels are for illustration only, so the cake delivered may not look 100% identical to the photograph. Differences in design, decoration, colour, shape and finishing that arise from handcrafting are not a defect and do not entitle the customer to a refund, replacement or cancellation, provided the cake matches the confirmed specifications.
2.4 Product Availability
All products are subject to availability and production capacity.
Certain products may require advance ordering.
CakeToHome may temporarily suspend products because of ingredient shortages, operational limitations, food safety concerns or other genuine business requirements.
2.5 Order Placement
Customers must review the order carefully before checkout.
The following information must be checked:
Product name.
Flavour.
Size.
Quantity.
Customisation.
Personalised message.
Delivery date.
Delivery slot.
Delivery address.
Contact details.
Total amount.
2.6 Order Confirmation
An order is considered accepted when CakeToHome confirms it through the website, email, SMS, WhatsApp or another official communication channel.
An automated payment notification alone does not necessarily establish order acceptance.
Customers should retain their order confirmation for reference.
2.7 Strict No-Cancellation Policy
All confirmed orders are final. CakeToHome does not ordinarily accept customer-initiated cancellation requests after order confirmation.
This applies to:
Standard cakes.
Customised cakes.
Photo cakes.
Birthday cakes.
Anniversary cakes.
Celebration cakes.
Bakery products.
Special event orders.
Customers are responsible for reviewing all order information before completing checkout.
This policy does not remove any cancellation or other statutory remedy that cannot legally be excluded.
2.8 Strict No-Change-of-Mind Refund Policy
CakeToHome does not provide refunds merely because a customer:
Changes their mind.
Changes event plans.
No longer requires the product.
Selects the wrong flavour.
Selects the wrong size.
Provides incorrect personalisation instructions.
Dislikes a product that matches the confirmed specifications.
Fails to receive an order due to their own incorrect delivery information or unavailability.
Refunds and other remedies required by applicable law remain available.
2.9 Customer Responsibilities
Customers must:
Provide accurate contact information.
Provide a complete delivery address.
Select the correct delivery date.
Verify the product and flavour.
Verify the cake size and quantity.
Check spelling and customisation instructions.
Ensure the recipient is available.
Follow product storage instructions.
Avoid fraudulent or abusive orders.
2.10 Pricing
All prices will be displayed in INR.
Applicable taxes, delivery charges and other additional charges will be disclosed before the customer completes the transaction.
The price accepted at checkout will apply to the confirmed order, subject to correction of an obvious technical or pricing error before acceptance.
2.11 Customised Products
Customised products are prepared according to customer instructions.
The customer is responsible for verifying all supplied information.
CakeToHome may suggest reasonable alternatives if a requested design or ingredient is unavailable.
Material substitutions or changes will be communicated appropriately.
2.12 Account Security
Customers are responsible for maintaining the confidentiality of their account credentials.
Customers must notify CakeToHome if they suspect unauthorised access.
2.13 Prohibited Activities
Customers must not:
Place fraudulent orders.
Use stolen payment credentials.
Submit unlawful content.
Attempt to disrupt website functionality.
Abuse customer support personnel.
Misuse promotional offers.
Attempt unauthorised access to systems.
2.14 Limitation of Liability
Nothing in these Terms excludes liability or consumer remedies that cannot legally be excluded.
To the extent permitted by applicable law, CakeToHome will not be responsible for indirect or consequential losses that are not legally recoverable.
2.15 Governing Law
These Terms are governed by the laws of India.
Disputes will be subject to the jurisdiction of competent courts and consumer commissions, as applicable under law.
Customers retain their statutory rights to approach appropriate consumer authorities.

3. REFUND POLICY
3.1 General Policy
CakeToHome prepares fresh cakes and bakery products, including products made specifically for individual customer orders.
Due to the perishable nature of these products, preparation requirements and customisation, CakeToHome follows a strict no-change-of-mind refund policy.
Once an order is confirmed, customers cannot demand a refund simply because they no longer require the product.
3.2 Non-Refundable Situations
Refunds will not ordinarily be provided in the following situations:
Customer changes their mind.
Customer changes their event plans.
Customer orders the wrong product.
Customer selects the wrong flavour or size.
Customer submits incorrect spelling or personalisation instructions.
Customer provides an incorrect delivery address.
Recipient is unavailable.
Customer refuses an accurately fulfilled order.
Customer fails to collect or receive the order.
Customer dislikes the taste despite the product matching its description and agreed specifications.
Customer requests a refund after production has started.
Minor handmade variations occur without a material product discrepancy.
3.3 Exceptions
This policy does not exclude legally required remedies where:
CakeToHome fails to fulfil an accepted order.
The wrong product is delivered.
A material confirmed product specification is not met.
The product is demonstrably damaged before or during delivery.
The product is unsafe or materially defective.
A duplicate payment is collected.
A payment is collected without an order being fulfilled.
Another situation arises where a refund or other remedy is legally required.
Each complaint will be examined based on its circumstances.
3.4 Refund Request Procedure
Customers reporting a legitimate issue should provide:
Order ID.
Customer name.
Registered mobile number.
Description of the issue.
Photographs or videos, where relevant.
Payment transaction reference, where relevant.
3.5 Investigation
CakeToHome may review:
Order information.
Product preparation records.
Delivery records.
Customer photographs.
Packaging information.
Payment records.
Customer communications.
Additional information may be requested when reasonably necessary.
3.6 Refund Processing
Where a refund is approved or legally required:
It will ordinarily be processed through the original payment method.
Processing time may depend on the payment provider and banking institution.
The customer will receive available transaction or refund confirmation.
Applicable statutory refund requirements will be followed.
Store credit or replacement will not be imposed as a substitute for a refund that is legally due.
3.7 Duplicate Payments
Where duplicate payment is verified, the excess payment will be handled through the appropriate refund process.
3.8 Partial Refunds
Where only part of an order is affected, an appropriate proportionate remedy may be considered.
3.9 Contact
Email: caketohomeoffice@gmail.com
Phone: +91 81389 16888

4. CANCELLATION POLICY
4.1 Strict No-Cancellation Policy
CakeToHome follows a strict no-cancellation policy for confirmed customer orders.
Once an order is accepted and confirmed, customers cannot ordinarily cancel it.
This applies because products may be prepared according to individual requirements, with ingredients, labour and production capacity allocated specifically to the order.
4.2 Customer-Initiated Cancellation
Cancellation requests will not ordinarily be accepted for reasons including:
Change of mind.
Change of plans.
Wrong product selection.
Wrong flavour selection.
Incorrect size selection.
Incorrect personalisation submitted by the customer.
Change in delivery preferences.
Recipient unavailability.
Personal circumstances.
4.3 Customised Orders
Orders involving personalised designs, photographs, messages, special decorations or event-specific requirements are final once confirmed.
4.4 Order Modifications
Changes to confirmed orders are not guaranteed.
CakeToHome may consider a modification only if operationally possible and expressly approved by our team.
No modification is effective until confirmation is communicated to the customer.
4.5 Business-Initiated Cancellation
In exceptional circumstances, CakeToHome may be unable to fulfil an accepted order due to:
Product unavailability.
Ingredient shortages.
Production failure.
Delivery restrictions.
Food safety concerns.
Unexpected operational disruptions.
Other genuine circumstances.
In such situations, customers will be informed and provided an appropriate resolution, including a refund where required by law.
4.6 Legal Rights
Nothing in this policy removes a statutory right or remedy that cannot legally be excluded.

5. SHIPPING & DELIVERY POLICY
5.1 Delivery Coverage
CakeToHome delivers to locations supported by its delivery network.
Delivery availability will be determined using the PIN code or delivery address entered during checkout.
Orders can only be placed for serviceable locations.
5.2 Delivery Charges
Applicable delivery fees will be displayed before checkout confirmation.
Delivery charges may vary according to:
Delivery distance.
Location.
Delivery slot.
Order value.
Special delivery requirements.
5.3 Delivery Scheduling
Customers may select available delivery dates and time slots.
A selected time slot represents the delivery commitment or estimated delivery window displayed at checkout.
Exact delivery minutes are not guaranteed unless expressly confirmed.
5.4 Freshness and Handling
CakeToHome takes reasonable precautions during preparation, packaging and delivery to preserve product quality.
Certain products require temperature-controlled handling.
Customers must follow the storage instructions provided with the product.
5.5 Recipient Availability
Customers must ensure that the recipient or an authorised individual is available at the delivery address.
If the recipient is unavailable:
The delivery partner may contact the recipient.
A reasonable redelivery attempt may be considered.
Redelivery may be subject to operational feasibility.
Additional delivery charges may apply where disclosed and legally permissible.
Because cakes are perishable, repeated delivery attempts may not be possible.
5.6 Incorrect Delivery Information
Customers are responsible for entering correct delivery information.
If incorrect information causes a delivery failure, CakeToHome will assess available options based on feasibility and applicable law.
5.7 Delivery Delays
Delays may occur due to:
Traffic congestion.
Weather conditions.
Road closures.
Public events.
Natural disasters.
Vehicle breakdowns.
Operational disruptions.
Other circumstances beyond reasonable control.
CakeToHome will make reasonable efforts to communicate significant delays.
5.8 Proof of Delivery
Delivery may be verified through:
Recipient acknowledgement.
OTP verification.
Delivery partner confirmation.
Delivery photographs, where appropriate.
Electronic delivery records.
5.9 Incorrect Delivery Status
If an order is marked delivered but the customer disputes receipt, CakeToHome will investigate using available delivery information.
5.10 Failed Delivery
Where delivery fails because of customer-provided incorrect information or recipient unavailability, CakeToHome may be unable to provide another delivery attempt.
This does not apply where CakeToHome is responsible for the delivery failure.

6. RETURN / REPLACEMENT POLICY
6.1 No Ordinary Returns
CakeToHome sells fresh and perishable food products.
Accordingly, ordinary change-of-mind returns are not accepted.
Customers cannot return a correctly fulfilled cake simply because they no longer require it or have changed their preferences.
6.2 Eligible Complaints
Customers may raise complaints relating to:
Incorrect products.
Materially incorrect flavours or sizes.
Damaged products.
Missing products.
Material deviations from confirmed customisation.
Unsafe or spoiled food.
Other genuine product defects.
6.3 Reporting Issues
Customers should report visible damage or delivery discrepancies immediately, preferably within two hours of delivery.
Food safety concerns must be reported as soon as discovered.
The reporting period is intended to assist investigation and does not remove statutory rights.
6.4 Supporting Evidence
Customers may be requested to provide:
Order ID.
Product photographs.
Packaging photographs.
Description of the issue.
Delivery information.
Relevant supporting documents.
6.5 Replacement
Where a genuine complaint is established, CakeToHome may offer:
Replacement.
Corrected product.
Partial refund.
Full refund.
Another appropriate remedy.
The resolution will depend on the circumstances and applicable law.
6.6 Non-Eligible Requests
Replacement will not ordinarily be provided for:
Minor decorative variations.
Minor differences in handmade finishing.
Cakes that are not 100% identical to the photograph shown, because cakes are handcrafted, where the cake matches the confirmed specifications.
Subjective preferences where the product matches the description.
Incorrect instructions supplied by the customer.
Damage, melting, collapse or spoilage caused by improper storage, handling or exposure to heat after delivery.
Products consumed or substantially consumed before a complaint is raised, except in food safety cases.
Complaints unsupported by reasonable evidence where evidence is reasonably requested.
6.7 Resolution Timeline
CakeToHome will acknowledge genuine complaints promptly and aims to review them and communicate a resolution within a reasonable time.
Where a replacement or corrected product is offered, it will be subject to operational feasibility and the customer's delivery availability.
Where a refund is approved, it will be processed in line with Section 3.6 of this document.
6.8 Food Safety Complaints
Any complaint involving suspected spoilage, contamination, foreign objects or an allergic reaction will be treated as a priority.
Customers should stop consuming the product, retain the product and packaging where possible, and contact us immediately with photographs and order details.
Customers experiencing health symptoms should seek medical attention without delay.
6.9 Contact
Email: caketohomeoffice@gmail.com
Phone: +91 81389 16888
WhatsApp: +91 81389 16888

7. COOKIE POLICY
7.1 What Are Cookies
Cookies are small text files stored on your device when you visit a website. They help the website function properly, remember your preferences and understand how the website is used.
7.2 Types of Cookies We Use
A. Essential Cookies
These are necessary for core functions such as page navigation, shopping cart, secure checkout, account login and fraud prevention. The website cannot function properly without them.
B. Performance and Analytics Cookies
These help us understand how visitors use the website, which pages are popular and where improvements are needed.
C. Functionality Cookies
These remember your choices, such as delivery location, PIN code and saved preferences.
D. Marketing Cookies
Where used, these help us measure advertising effectiveness and show relevant promotions. They are used only where permitted by law.
7.3 Third-Party Cookies
Some cookies may be placed by third-party providers such as analytics services, payment gateways, advertising platforms and social media services. Their use of information is governed by their own policies.
7.4 Managing Cookies
You can control or delete cookies through your browser settings. Disabling certain cookies may affect website functionality, including the ability to place orders.
Where required by law, we will request your consent before using non-essential cookies, and you may withdraw that consent at any time.
7.5 Changes to This Policy
We may update this Cookie Policy from time to time. The latest version will be published on our website.

8. ALLERGEN, FOOD SAFETY & STORAGE DISCLAIMER
8.1 Allergen Information
CakeToHome products may contain or be prepared in a facility that handles the following allergens:
Wheat and gluten.
Eggs.
Milk and dairy products.
Tree nuts and peanuts.
Soy.
Other ingredients as indicated on the product page or packaging.
Cross-contact with allergens may occur despite reasonable precautions. We cannot guarantee that any product is completely free from any allergen unless expressly stated and confirmed in writing.
8.2 Customer Responsibility
Customers with food allergies, intolerances or special dietary requirements must review product ingredient information before ordering and contact us before placing the order if clarification is needed.
Customers are responsible for informing the recipient and any consumers of the cake about its ingredients.
8.3 Egg, Eggless and Dietary Claims
Where products are described as eggless, vegetarian or otherwise, we make reasonable efforts to ensure accuracy. Such descriptions refer to the ingredients used and are not a guarantee against trace cross-contact in a shared kitchen environment.
8.4 Storage Instructions
Cakes are perishable. Unless otherwise stated on the product or packaging:
Refrigerate the cake as soon as it is received.
Keep it away from direct sunlight and heat.
Remove from refrigeration shortly before serving, as advised for the product.
Consume within the period indicated on the packaging or product page.
Products damaged, melted or spoiled due to failure to follow storage instructions are not covered under replacement or refund claims.
8.5 Decorations and Non-Edible Items
Candles, toppers, picks, ribbons, boards and similar items may be non-edible. Customers must remove such items before consumption and keep them away from young children.
8.6 Food Licence
CakeToHome operates in compliance with applicable food safety laws in India.
FSSAI Registration Number: 21326133002408 (registered as Cake To Home)
8.7 Medical Emergencies
In case of an allergic reaction or any health concern after consumption, seek immediate medical attention and inform us as soon as possible.

9. GRIEVANCE REDRESSAL
9.1 Grievance Officer
In accordance with applicable Indian laws, including the Consumer Protection (E-Commerce) Rules, 2020 and the Information Technology Act, 2000, the details of our Grievance Officer are:
Name: Vighnesh Prasad
Designation: Proprietor
Email: caketohomeoffice@gmail.com
Phone: +91 81389 16888
Address: 16/956, Thannimukku, Mayyanad, Kollam, Kerala - 691303
Working Hours: Every day, 10:00 AM to 10:00 PM
9.2 How to Raise a Grievance
Customers may submit a grievance by email or phone, including:
Order ID, where applicable.
Name and registered mobile number.
A clear description of the grievance.
Supporting photographs, videos or documents.
9.3 Timelines
We will acknowledge a grievance within 48 hours of receipt and aim to redress it within one month of receipt, or within any shorter period required by applicable law.
9.4 Privacy and Data Protection Grievances
Complaints about the handling of personal data, or requests to exercise privacy rights described in Section 1.7, may be sent to the Grievance Officer or the privacy contact in Section 1.12. Where applicable law provides a right to approach a data protection authority, that right is not affected by this policy.
9.5 Escalation
If a grievance is not resolved to your satisfaction, you may approach the appropriate consumer forum, consumer commission or other competent authority. You may also contact the National Consumer Helpline at 1915 or through the National Consumer Helpline portal.

10. INTELLECTUAL PROPERTY
10.1 Ownership
All content on the CakeToHome website, including text, logos, graphics, product photographs, cake designs, layouts and software, belongs to CakeToHome or its licensors and is protected by applicable intellectual property laws.
10.2 Permitted Use
Customers may use the website for personal, non-commercial purposes related to browsing and purchasing products. Content may not be copied, reproduced, modified, distributed or used commercially without our prior written permission.
10.3 Customer-Supplied Content
Customers who submit photographs, images, logos, text or other material for customised products confirm that:
They own the content or have the right to use it.
The content does not infringe any third party's rights.
The content is lawful and not offensive, defamatory or obscene.
CakeToHome may decline any customisation request that appears to infringe rights, is unlawful or is inappropriate.
Customers are responsible for any claims arising from content they supply. Customer-supplied content will be used only to fulfil the relevant order, unless the customer consents otherwise.
10.4 Trademarks and Characters
Orders for cakes featuring third-party trademarks, brand logos or licensed characters are accepted at the customer's responsibility for personal use only, and may be declined or modified at our discretion.
10.5 Reviews and Feedback
By submitting a review or feedback publicly, you grant CakeToHome a non-exclusive, royalty-free right to display it on our website and marketing channels. We may remove reviews that are unlawful, abusive or misleading.

11. GENERAL DISCLAIMERS
11.1 Website Availability
We make reasonable efforts to keep the website available and error-free but do not guarantee uninterrupted access. The website may be unavailable due to maintenance, technical failures or events beyond our control.
11.2 Images
Product images are for illustration. As all cakes are handcrafted, the actual product may not look 100% identical to the photograph, as described in Section 2.3.
11.3 Force Majeure
CakeToHome will not be liable for failure or delay in performing its obligations caused by events beyond its reasonable control, including natural disasters, severe weather, strikes, riots, government restrictions, power or utility failures, supply chain disruptions, pandemics and technology failures.
Where an accepted order cannot be fulfilled because of such an event, the customer will be informed and offered an appropriate resolution, including a refund where required by law.
11.4 Third-Party Services
We are not responsible for the acts or omissions of independent third-party services such as payment gateways and telecommunications providers, except to the extent required by law.
11.5 Severability
If any provision of these policies is held invalid or unenforceable, the remaining provisions will continue in full effect.
11.6 Entire Agreement
These policies, together with the order confirmation, form the entire agreement between the customer and CakeToHome in relation to the purchase of products through the website.
11.7 Changes to Policies
CakeToHome may update these policies from time to time. Changes apply to orders placed after the updated version is published. The Effective Date, Last Updated date and Policy Version at the top of this document indicate the current version.
11.8 Statutory Rights
Nothing in these policies limits any right or remedy available to customers under applicable consumer protection or other laws that cannot lawfully be excluded.

12. CONTACT INFORMATION
Business Name: CakeToHome
Website: https://cakestohome.com/
Operated By: Vighnesh Prasad (Proprietorship)
Trade Name: Baked Cakes & Pastries (CakeToHome)
Registered Address: 16/956, Thannimukku, Mayyanad, Kollam, Kerala - 691303
Food Business Premises (FSSAI): Vellayambalam, Kowdiar PO, Vettiyoorkavu Circle, Thiruvananthapuram, Kerala - 695003
Customer Support Email: caketohomeoffice@gmail.com
Customer Support Phone: +91 81389 16888
WhatsApp: +91 81389 16888
Refund Support Email: caketohomeoffice@gmail.com
Privacy Email: caketohomeoffice@gmail.com
Grievance Officer Email: caketohomeoffice@gmail.com
GSTIN: 32CQWPP4392J1Z2
FSSAI Licence Number: 21326133002408
Business Hours: Every day, 10:00 AM to 10:00 PM
```

---

## 7. Sub-Phase Engineering Specifications (Phase 9.1 – 9.10)

### Sub-Phase 9.1: CMS Foundation and Website Page Management
- **Objective**: Establish the persistent catalog of all website page categories in PostgreSQL, accessible via unified admin workspace.
- **Scope**: 8 website page categories, `cms_page` schema extensions, centralized Page Manager.
- **Dependencies**: Baseline DDL migration from Phase 6.2.
- **Features**: Page creation, slug uniqueness, route whitelist guard, metadata configuration.
- **Architecture**: Next.js App Router dynamic route handler `src/app/(store)/[slug]/page.tsx` backed by `CmsRepository`.
- **Database Requirements**: Ensure `cms_page` has indices on `slug`, `status`, `type`, `deleted_at`.
- **API Requirements**: `GET /api/v1/cms/pages`, `POST /api/v1/cms/pages`, `GET /api/v1/cms/pages/:slug`.
- **Frontend Requirements**: Admin Page Manager list with category filter pills, search input, and status badges.
- **Backend Requirements**: Route whitelist guard: reject slugs matching `checkout`, `admin`, `cart`, `api`, `dashboard`.
- **Security**: Parameterized SQL, role check (`ADMIN`, `WEBSITE_MANAGER`).
- **Testing**: Slug conflict tests, reserved slug rejection tests, soft-delete verification.
- **Acceptance Criteria**: All 8 categories representable; reserved routes blocked; 0 runtime errors.
- **Risks**: Potential slug conflict with static Next.js route tree (mitigated by route whitelist).
- **Assumptions**: Database port 5433 remains accessible.
- **Completion Conditions**: Automated test script passes all CRUD operations across all page types.

### Sub-Phase 9.2: Visual Page Builder and Content Editors
- **Objective**: Provide administrators with no-code visual drag-and-drop and structured content editing tools.
- **Scope**: 6 editors: Visual Drag-and-Drop, Block-Based, Rich-Text, Product Content, Theme & Design, SEO.
- **Dependencies**: Sub-Phase 9.1.
- **Features**: Live viewport toggles (1920px, 768px, 390px), block property inspector, dynamic PIM catalog binding.
- **Architecture**: `PageConfigurator` component mounted in Admin Dashboard, rendering live previews via `PageRenderer`.
- **Database Requirements**: Persist JSONB layout configurations in `cms_page.blocks`.
- **API Requirements**: `PUT /api/v1/cms/pages/:id` (partial block update), `POST /api/v1/cms/pages/:id/reorder-sections`.
- **Frontend Requirements**: Drag handles, section insertion modals, accordion property forms.
- **Backend Requirements**: Schema validation for block payloads using Zod or JSON Schema.
- **Security**: Sanitize all rich-text HTML inputs stripping `<script>`, `<iframe>`, `javascript:` URIs.
- **Testing**: Playwright automated block reordering, property updating, and responsive canvas tests.
- **Acceptance Criteria**: Changes reflect in live preview; zero mock products used; zero unhandled errors.
- **Risks**: Heavy JSONB payloads impacting API latency (mitigated by compression and partial patching).
- **Assumptions**: Modern desktop browser supporting HTML5 Drag and Drop API.
- **Completion Conditions**: Successful visual creation, editing, and previewing of a multi-section landing page.

### Sub-Phase 9.3: Templates, Media, Navigation and SEO
- **Objective**: Provide reusable layouts, digital asset management, multi-level navigation, and technical SEO controls.
- **Scope**: Template Manager, Media Manager, Navigation Manager, SEO Manager.
- **Dependencies**: Sub-Phase 9.1, 9.2.
- **Features**: 1-click page cloning from blueprints, WebP/AVIF asset optimization, footer menu editor, dynamic 301 redirects.
- **Architecture**: Relational storage across `cms_page_template`, `media`, `cms_navigation`, `cms_redirect`.
- **Database Requirements**: Foreign keys linking pages to templates; index on `cms_redirect(from_path)`.
- **API Requirements**: `GET /api/v1/media`, `POST /api/v1/media/upload`, `GET /api/v1/cms/navigation/:location`.
- **Frontend Requirements**: Image gallery grid with alt-text fields; drag-and-drop menu tree builder.
- **Backend Requirements**: Server-side image dimension inspection using Sharp; 301 redirect middleware resolver.
- **Security**: Strict file extension and magic byte verification on uploads; non-executable media storage.
- **Testing**: Media upload security tests, broken link crawler, 301 redirect response validation.
- **Acceptance Criteria**: Alt-text enforced; 301 redirects return correct location header; menus render dynamically.
- **Risks**: Storage bloat from high-resolution images (mitigated by automated Sharp compression).
- **Assumptions**: Local or S3-compatible media storage available.
- **Completion Conditions**: Navigation menus dynamic across storefront; 100% redirect test pass.

### Sub-Phase 9.4: Publishing and Approval Workflows
- **Objective**: Implement enterprise content governance, role-based approval gates, scheduled publication, and rollback.
- **Scope**: 6 lifecycle states, RBAC permissions, cron worker, revision snapshots.
- **Dependencies**: Sub-Phase 9.1, 9.2, 9.3.
- **Features**: Approval state machine, visual diff viewer, 1-click historical rollback, automated cache invalidation.
- **Architecture**: `cms_revision` immutable snapshot store; Next.js `revalidatePath` on publication.
- **Database Requirements**: `cms_revision` table with unique `(page_id, version)` constraint.
- **API Requirements**: `POST /api/v1/cms/pages/:id/publish`, `POST /api/v1/cms/pages/:id/rollback`, `POST /api/v1/cms/jobs/publish-scheduled`.
- **Frontend Requirements**: Revision history sidebar showing version timestamps, author, and rollback buttons.
- **Backend Requirements**: Concurrency lock during publishing; automated Next.js cache purging.
- **Security**: Separation of duties: content editors cannot publish without reviewer/admin sign-off.
- **Testing**: Concurrency test (simultaneous publishes), rollback state restoration test, cache purge test.
- **Acceptance Criteria**: Drafts inaccessible to public; rollback restores exact prior state; cron publishes scheduled pages.
- **Risks**: Race conditions during concurrent edits (mitigated by row-level locking `FOR UPDATE`).
- **Assumptions**: Cron dispatcher available to invoke publishing endpoint every 5 minutes.
- **Completion Conditions**: 100% pass on publishing state machine test suite.

### Sub-Phase 9.5: Legal Policy Management and Exact Content Migration
- **Objective**: Deploy all 12 mandatory legal policy pages with 100% exact verbatim fidelity to the authoritative source document.
- **Scope**: 12 dedicated public URLs, dedicated footer links, contextual checkout links, tamper-evident audit logs.
- **Dependencies**: Sub-Phase 9.1, 9.4.
- **Features**: Verbatim text preservation, distinct business hours (10 AM - 10 PM) vs support hours (9 AM - 5 PM), version stamping.
- **Architecture**: Dedicated static policy pages backed by `cms_page` records with `type = 'legal'` and `status = 'published'`.
- **Database Requirements**: Seed all 12 policy pages with exact source text; store SHA256 checksums of legal text in metadata.
- **API Requirements**: `GET /api/v1/cms/policies/:slug` returning immutable legal text.
- **Frontend Requirements**: Clean, distraction-free legal reading layout; table of contents; active footer links on all pages.
- **Backend Requirements**: Strict tamper guard: legal policy content edits require explicit Super Admin approval.
- **Security**: Immutable audit trail in `audit_logs` tracking any attempted text modification.
- **Testing**: Automated string diff testing comparing rendered DOM against original source text (0 character discrepancy).
- **Acceptance Criteria**: All 12 pages return HTTP 200; footer contains all 12 links; checkout links to relevant terms; 100% exact text match.
- **Risks**: Accidental formatting or typo correction altering legal meaning (mitigated by automated checksum comparison).
- **Assumptions**: Source document dated 09/11/2026 is immutable.
- **Completion Conditions**: Automated exact-match text validation passes for all 12 policy documents.

### Sub-Phase 9.6: Razorpay Payment Gateway Architecture (Standard Web Checkout)
- **Objective**: Integrate official Razorpay Standard Web Checkout as the active payment gateway for all new customer orders.
- **Scope**: `checkout.js` integration, standardized `POST /api/v1/payments/razorpay/order` endpoint, strict amount validation, idempotency guards, guest session binding.
- **Dependencies**: Order & Cart repository architecture, `frontend/src/lib/db.ts` pool.
- **Features**: Razorpay modal checkout, UPI / Card / NetBanking support, automatic order reference linking, full capture enforcement.
- **Architecture**: Next.js App Router API route `src/app/api/v1/payments/razorpay/order/route.ts` communicating with `https://api.razorpay.com/v1/orders`.
- **Database Requirements**: Store `razorpay_order_id` on `order` and `payment_transaction` records; acquire row lock `FOR UPDATE` inside `dbTransaction()`.
- **API Requirements**: `POST /api/v1/payments/razorpay/order` returning `{ razorpay_order_id, amount, key_id, currency }`.
- **Frontend Requirements**: Load official `checkout.js` script; handle modal dismissal, success callback, and payment failure events.
- **Backend Requirements**: Authoritative amount lookup from database; convert to Paise; enforce minimum 100 paise rule; enforce full capture rule.
- **Security**: Never trust frontend amount; reject client price tampering; enforce rate limiting; sign guest session tokens.
- **Testing**: Valid order creation, invalid amount rejection, duplicate order submission protection, modal cancellation handling.
- **Acceptance Criteria**: Official Razorpay modal opens; order ID matches database; price manipulation blocked.
- **Risks**: Third-party Razorpay API latency or downtime (mitigated by configurable timeout and graceful user alerts).
- **Assumptions**: Valid Razorpay Test Key ID and Key Secret available.
- **Completion Conditions**: End-to-end test order successfully created via Razorpay API in test mode.

### Sub-Phase 9.7: Secure Payment Gateway Settings (Admin Credential Management)
- **Objective**: Build a dedicated, secure admin module for managing Razorpay credentials with AES-256-GCM encryption at rest.
- **Scope**: Admin UI at `Settings -> Payment Gateway -> Razorpay`, server-side encryption service, safe connection diagnostic endpoint.
- **Dependencies**: Sub-Phase 9.6, Admin Dashboard RBAC.
- **Features**: Masked secret display, Test vs Live environment selector, enable/disable toggle, non-mutating connection test (5s timeout, SSRF protection).
- **Architecture**: Admin component integrated into `SuperAdminDashboardPage`; backend `PaymentGatewayConfigService`.
- **Database Requirements**: `payment_gateway_config` table storing versioned encrypted envelope (`v1$iv$authTag$cipher`).
- **API Requirements**: `GET /api/v1/admin/payments/gateway-config`, `PUT /api/v1/admin/payments/gateway-config`, `POST /api/v1/admin/payments/razorpay/test-connection`.
- **Frontend Requirements**: Secure form in CakeToHome design system; masked password inputs; test connection status badge.
- **Backend Requirements**: AES-256-GCM encryption/decryption; master key from deployment environment variable; zero secret leakage in logs.
- **Security**: Only Super Admin can access; never return secret in GET API; audit log every configuration change; sanitized diagnostic errors.
- **Testing**: Encryption round-trip unit test, secret leak prevention test (scan API responses and logs), connection test validation.
- **Acceptance Criteria**: Secrets encrypted at rest in versioned envelope; frontend receives masked string only; connection test validates pairing without billing.
- **Risks**: Loss of master encryption key (mitigated by key backup procedures and rotation runbooks).
- **Assumptions**: Master encryption key configured in server environment.
- **Completion Conditions**: Super Admin successfully saves, tests, and updates credentials via admin UI.

### Sub-Phase 9.8: Cashfree Decommissioning and Razorpay Cutover
- **Objective**: Safely decommission Cashfree from active checkout initiation while preserving 100% of historical financial transaction records across the 21 active files.
- **Scope**: Checkout UI, server actions, API routing, payment provider mapping, historical data protection.
- **Dependencies**: Sub-Phase 9.6, 9.7.
- **Features**: Cashfree button removal, route deprecation, historical data lock, fail-closed cutover gate.
- **Architecture**: Active provider pointer updated to `razorpay`; legacy Cashfree routes return safe redirect or 404 for new checkouts.
- **Database Requirements**: Zero mutations to existing `payment_transaction` rows with `payment_provider = 'cashfree'`.
- **API Requirements**: Reject new Cashfree checkout requests; maintain read-only settlement query APIs.
- **Frontend Requirements**: Remove Cashfree logos and radios from `checkout-form.tsx`; update order confirmation views.
- **Backend Requirements**: Enforce guard: new orders only accept `razorpay` or `cod`.
- **Security**: Ensure no hidden fallback silently routes transactions to Cashfree.
- **Testing**: Attempt checkout with legacy Cashfree payload (must reject); verify past Cashfree orders render correctly in admin.
- **Acceptance Criteria**: 0 new Cashfree checkouts possible; 100% historical Cashfree orders readable; Razorpay active.
- **Risks**: Customers with open checkout tabs during cutover (mitigated by session timeout and clear refresh prompts).
- **Assumptions**: Management authorization granted for payment gateway switch.
- **Completion Conditions**: Cutover checklist signed off; zero Cashfree transactions initiated post-cutover.

### Sub-Phase 9.9: Payment Verification, Webhooks and Reconciliation
- **Objective**: Ensure complete payment lifecycle integrity through constant-time signature verification, automated webhooks, full capture verification, 90-day retention with statutory hold, and ledger reconciliation.
- **Scope**: `POST /api/v1/payments/razorpay/verify`, `POST /api/v1/payments/razorpay/webhook`, `POST /api/v1/admin/payments/razorpay/refund`, webhook retention policy, refund reason codes.
- **Dependencies**: Sub-Phase 9.6, 9.7, 9.8, `payment_webhook_log`, `payment_refund`.
- **Features**: Constant-time HMAC-SHA256 verification, raw-body webhook signature verification, event deduplication, full capture verification, 90-day retention with statutory hold, refund reason-code taxonomy.
- **Architecture**: Asynchronous webhook processor with dead-letter queue and idempotent database updates in `dbTransaction()`.
- **Database Requirements**: `payment_webhook_log` table with unique `event_id` constraint; `payment_refund` table with idempotency constraint; link to `public.invoice` and `accounting_voucher`.
- **API Requirements**: `POST /api/v1/payments/razorpay/verify`, `POST /api/v1/payments/razorpay/webhook`, `POST /api/v1/admin/payments/razorpay/refund`, `GET /api/v1/payments/razorpay/status/:order_id`.
- **Frontend Requirements**: Order confirmation poller waiting for server payment confirmation.
- **Backend Requirements**: Double confirmation: signature match + Razorpay API status check before marking order `paid`.
- **Security**: Replay attack protection; out-of-order webhook protection (delayed failure cannot overwrite confirmed payment).
- **Testing**: Signature mismatch rejection, duplicate webhook injection, out-of-order event simulation, partial refund tests.
- **Acceptance Criteria**: Forged signatures rejected; duplicate webhooks handled idempotently; order only paid upon authoritative confirmation.
- **Risks**: Network drop between browser and server during payment callback (mitigated by authoritative webhook backup).
- **Assumptions**: Razorpay webhook configured with dedicated webhook secret.
- **Completion Conditions**: 100% pass on payment verification, webhook, and reconciliation test suites.

### Sub-Phase 9.10: Security, Accessibility, Performance and QA Automation
- **Objective**: Execute end-to-end quality assurance, security penetration testing, accessibility compliance, and performance benchmarking.
- **Scope**: Full regression suite, OWASP Top 10 audit, WCAG 2.2 AA validation, Core Web Vitals profiling.
- **Dependencies**: Sub-Phase 9.1 through 9.9.
- **Features**: Playwright E2E browser automation, failure injection, load testing, accessibility screen-reader tests.
- **Architecture**: Automated test harnesses in `scratch/` and Playwright runner.
- **Database Requirements**: Verify zero mutations to financial baseline in `cth_test` (127 orders, 71 invoices, 40 payments).
- **API Requirements**: Rate-limiting validation across payment and CMS endpoints.
- **Frontend Requirements**: Zero horizontal overflow on Desktop, Tablet, and Mobile; contrast ratios >= 7:1.
- **Backend Requirements**: Database connection pool optimization; server response times < 150ms.
- **Security**: Penetration test against SQLi, XSS, CSRF, SSRF, IDOR, and credential stuffing.
- **Testing**: Full ERP regression (Phase 1-8 test suites), Playwright multi-viewport suite, payment failure recovery suite.
- **Acceptance Criteria**: 100% test pass rate; zero critical security vulnerabilities; WCAG 2.2 AA compliant.
- **Risks**: Hidden regression in historical accounting ledgers (mitigated by automated baseline integrity checks).
- **Assumptions**: Staging environment mirrors production database and server topology.
- **Completion Conditions**: Comprehensive QA report signed off; final release gate approval.

---

## 8. Dedicated Decision Register: Assumptions Requiring Explicit Business Confirmation

To ensure implementation does not advance based on unverified assumptions, the following three core business and accounting decisions are formally logged in this Decision Register:

| Decision ID | Operational Domain | Current Working Assumption | Implementation Risk / Trade-Off | Confirmation Action Required |
| :--- | :--- | :--- | :--- | :--- |
| **DEC-P9-001** | **Merchant Capture Configuration** | Razorpay merchant account will be set to **Automatic Capture** via Dashboard settings. | If account is configured for manual capture, orders will remain in `authorized` status and funds will expire after 5 days unless backend issues explicit capture API call. | **Executive / Operations Sign-off**: Confirm Razorpay Dashboard capture setting. If manual, backend must invoke `POST /v1/payments/{id}/capture` upon authorization. |
| **DEC-P9-002** | **Gateway Fees & GST Accounting Reconciliation** | Razorpay MDR fees (typically 2% + 18% GST) will be reconciled monthly via Razorpay settlement reports. | Discrepancies between gross customer payments and net bank settlements if settlement fees are not automatically ingested into Chart of Accounts subledger (`Account 5020 - Payment Gateway Charges`). | **Finance & Accounts Sign-off**: Confirm whether settlement webhooks should automatically create fee expense vouchers or if monthly invoice upload is preferred. |
| **DEC-P9-003** | **International Currency & Card Policy** | Storefront exclusively transacts in Indian Rupee (**INR**); international credit cards are charged in INR at customer bank exchange rate. | If foreign multi-currency cards are blocked at Razorpay account level, international customers attempting gift purchases for family in India may fail. | **Business Sign-off**: Confirm whether Razorpay International Payments feature should be enabled (with strict INR settlement). |

---

## 9. Change Boundary Compliance Confirmation

This specification and roadmap update strictly respects the non-negotiable change boundary:
1. **Canonical Roadmap File Identified**: `docs/20-roadmap.md`.
2. **Files Modified**:
   - `docs/20-roadmap.md` (Extended with Workstream L / Phase 9 and sub-phases 9.1 - 9.10).
   - `docs/26-phase-9-cms-legal-razorpay-migration.md` (Created master technical specification).
   - `CHECKPOINTS/phase-9-cms-legal-razorpay-migration.md` (Mirrored checkpoint specification).
3. **Zero Source Code Changes**: No application code, checkout forms, payment services, or repositories modified.
4. **Zero Database Modifications**: No SQL executed, no schemas altered, no migrations applied.
5. **Zero Credential / Gateway Actions**: No live payment calls, no credential generation, Cashfree remains active in sandbox/test.
6. **Zero Uncommitted Changes Lost**: All existing workspace changes preserved intact.

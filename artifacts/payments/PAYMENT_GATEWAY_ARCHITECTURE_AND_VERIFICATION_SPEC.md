# CakeToHome — Payment Gateway Architecture & Verification Specification

**Project:** CakeToHome  
**Entity:** CakeToHome India Private Limited  
**CIN:** `U15400KA2026PTC189211` | **GSTIN:** `29AABCC1234F1Z5`  
**Milestone:** Automatic Payment Verification, Synchronization & Order Confirmation  
**Status:** IMPLEMENTED & AUDITED (55/55 Verification Tests Passing)  

---

## 1. Executive Summary

This document specifies the technical architecture, cryptographic verification mechanics, state synchronization models, and automatic order confirmation pipelines for CakeToHome's payment gateway integration. 

In e-commerce operations, relying on client-side browser callbacks or user manual refreshes to confirm orders introduces severe vulnerabilities, including fake confirmations via tampered client responses, duplicate order processing, and stranded paid orders. 

The CakeToHome Payment Verification Engine operates on a strict **Fail-Closed, Backend-Authoritative, Asynchronous Synchronization** architecture:
1. **Server-to-Server Ingestion**: Webhooks from Razorpay serve as the primary source of truth for payment status.
2. **Cryptographic Integrity**: Every webhook payload is signed with HMAC-SHA256 and verified using constant-time comparison.
3. **Idempotent Deduplication**: A dedicated webhook ledger (`payment_webhook_event`) ensures that replayed or out-of-order webhook events cannot cause double stock deductions or duplicate notifications.
4. **Atomic Multi-Table Updates**: Order confirmation, payment transaction recording, inventory movements, and customer notifications execute within an atomic PostgreSQL transaction under row-level locks (`SELECT ... FOR UPDATE`).
5. **Zero-Refresh Customer Storefront**: The customer order confirmation UI features an active polling component (`OrderLiveStatusWatcher`) that listens for server confirmation and dynamically transitions the user to the confirmed state without manual intervention.

---

## 2. Integrated Payment Gateway: Razorpay

CakeToHome integrates with **Razorpay** as the primary payment gateway for Indian domestic transactions (Cards, UPI, NetBanking, Wallets).

### Dual-Channel Confirmation Architecture

```mermaid
flowchart TD
    Customer([Customer Storefront]) -->|1. Selects Online UPI/Card| Checkout[Checkout Page]
    Checkout -->|2. Create Gateway Order| API_Order[POST /api/v1/payments/razorpay/create-order]
    API_Order -->|3. rzp_order_id & amount| Checkout
    Checkout -->|4. Opens Razorpay Standard Checkout Popup| RazorpayGateway((Razorpay Gateway))
    RazorpayGateway -->|5a. Webhook: payment.captured| WebhookEndpoint[POST /api/v1/payments/webhook]
    RazorpayGateway -->|5b. Client Callback: order_id, pay_id, sig| ClientVerify[POST /api/v1/payments/razorpay/verify-signature]
    
    subgraph Backend_Authoritative_Processing [Backend Authoritative Processing]
        WebhookEndpoint -->|Validate HMAC-SHA256| WebhookEngine[PaymentVerificationService]
        ClientVerify -->|Validate HMAC-SHA256| WebhookEngine
        WebhookEngine -->|Check Replay / Idempotency| Deduplication[payment_webhook_event]
        Deduplication -->|Atomic Transaction FOR UPDATE| StateEngine[Order Confirmation & Ledger Engine]
        StateEngine -->|Status Transition| DB_Order[public.order: payment_status='paid', status='confirmed']
        StateEngine -->|Ledger Record| DB_Txn[public.payment_transaction: status='captured']
        StateEngine -->|Audit Trail| DB_History[public.order_status_history]
        StateEngine -->|Stock Deduction| DB_Inventory[public.inventory_movement & branch_inventory]
        StateEngine -->|Queue SMS/WA/Email| DB_Notify[public.customer_notification_queue]
    end

    Customer -->|6. Real-time Status Polling| StatusPoll[GET /api/v1/orders/:id/status]
    StatusPoll -->|Read Confirmed State| Customer
    Customer -->|7. Auto-refresh Badge| UI_Update[✓ Order Confirmed & In Kitchen]
```

---

## 3. Cryptographic Verification Mechanics

### 3.1 Webhook Signature Verification
- **Mechanism**: HMAC-SHA256 computed on the exact raw body string/buffer received in the HTTP request.
- **Header**: `x-razorpay-signature`
- **Secret**: `RAZORPAY_WEBHOOK_SECRET` (falling back to `WEBHOOK_SIGNING_SECRET`).
- **Timing Protection**: Uses `crypto.timingSafeEqual` between the derived digest buffer and the incoming signature buffer.
- **Fail-Closed Rule**: If the signature header is missing, malformed, or invalid, the request is rejected immediately with HTTP 400 and logged to `payment_webhook_event` with `status = 'rejected_signature'`.

### 3.2 Client Callback Signature Verification
When the customer completes the Razorpay modal, the Razorpay SDK returns:
- `razorpay_order_id`
- `razorpay_payment_id`
- `razorpay_signature`

The backend verifies:
$$\text{Signature} = \text{HMAC-SHA256}(\text{razorpay\_order\_id} \parallel \text{"|"} \parallel \text{razorpay\_payment\_id}, \text{RAZORPAY\_KEY\_SECRET})$$

Both digests are compared using `crypto.timingSafeEqual`.

---

## 4. End-to-End Business Rules for Order Confirmation

An order transitions to `confirmed` **only** when all five prerequisite checks pass:

| Rule | Description | Handling on Failure |
| :--- | :--- | :--- |
| **1. Cryptographic Authenticity** | Signature validates against webhook/key secret. | Request rejected with HTTP 400. Logged as security alert. |
| **2. Order Existence** | Order ID matches existing row in `public."order"`. | Logged as `rejected_missing_order`, HTTP 404. |
| **3. Non-Cancelled Status** | Order status must NOT be `cancelled`. | Diverts to **Payment Exception Workflow**: order marked `payment_exception`, transaction flagged `flagged_refund`, audit alert raised. |
| **4. Currency Match** | Currency must match order currency (`INR`). | Diverts to **Payment Exception Workflow**: order marked `payment_exception`. |
| **5. Amount Match** | Payment amount matches `order.grand_total` (within ₹0.05 tolerance, accounting for paise normalization). | Diverts to **Payment Exception Workflow**: order marked `payment_exception`, audit log notes expected vs received. |
| **6. Idempotent Deduplication** | Event not previously confirmed. | Returns HTTP 200 with `idempotent: true`, skips downstream duplicate work. |

---

## 5. Downstream Execution Workflow

Upon successful confirmation, the transaction executes:
1. **Order Record**:
   - `payment_status = 'paid'`
   - `status = 'confirmed'`
   - `payment_method = 'razorpay'`
   - `metadata.payment_verified = true`
   - `metadata.payment_captured_at = NOW()`
2. **Transaction Ledger**:
   - Inserts or updates `public.payment_transaction`:
     - `status = 'captured'`
     - `settlement_status = 'settled'`
     - `provider = 'razorpay'`
     - `gateway_payment_id = paymentId`
     - `gateway_order_id = gatewayOrderId`
3. **Audit History**:
   - Inserts into `public.order_status_history` documenting transition reason and gateway reference.
4. **Inventory Movement (Stock Deduction)**:
   - For all order items with catalog products, inserts `inventory_movement` records with `movement_type = 'SALE'`, `direction = 'OUT'`, and deducts from `branch_inventory.quantity`.
5. **Kitchen Order Ticket (KOT)**:
   - Generates and records KOT sequence (`KOT-YYYYMMDD-XXXX`).
6. **Customer Notifications Queue**:
   - Queues multi-channel messages:
     - **SMS**: Order number, customer name, delivery date, live tracking URL.
     - **WhatsApp**: Rich notification with KOT and direct delivery status link.
     - **Email**: Detailed GST tax invoice receipt.

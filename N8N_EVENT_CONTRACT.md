# CakeToHome — Enterprise Event Gateway & n8n Payload Contract

## 1. Gateway Overview
CakeToHome uses a **Single Primary Event Gateway** architecture. All business events occurring within the CakeToHome commerce engine (orders, payments, abandoned carts, customer registrations, reorder opportunities) are dispatched to **ONE primary webhook URL** per environment.

Downstream in **n8n**, a master **Router / Switch Node** examines `event_type` and dispatches the payload to the appropriate automation workflow.

---

## 2. Request Headers

Every webhook POST dispatched from CakeToHome includes the following HTTP headers:

| Header | Description | Example |
| :--- | :--- | :--- |
| `Content-Type` | MIME payload type | `application/json` |
| `User-Agent` | Platform engine identifier | `CakeToHome-Event-Gateway/3.0` |
| `X-CakeToHome-Event-ID` | Unique canonical event identifier | `evt_1787130000000_a1b2c3d` |
| `X-CakeToHome-Event-Type` | Dot-notated event type | `order.created` |
| `X-CakeToHome-Event-Version` | Payload schema version | `1` |
| `X-CakeToHome-Timestamp` | Unix timestamp of signature generation (seconds) | `1787130000` |
| `X-CakeToHome-Signature` | HMAC-SHA256 signature string | `t=1787130000,v1=9f83...` |
| `X-CakeToHome-Request-ID` | Tracing identifier | `req_1787130000_f9a8` |
| `X-CakeToHome-Correlation-ID` | Distributed business process correlation ID | `corr_evt_1787130000000_a1b2c3d` |
| `X-CakeToHome-Delivery-Attempt` | Attempt count (1 to 5) | `1` |

---

## 3. Cryptographic Signature Verification (HMAC-SHA256)

### Signature Generation Algorithm
1. Extract timestamp $t$ (seconds) and raw body string $B$.
2. Compute HMAC-SHA256: $\text{HMAC}_{\text{SHA256}}(K, t + "." + B)$ where $K$ is the endpoint's configured signing secret.
3. Construct header: `t=<timestamp>,v1=<hexDigest>`.

### Node.js / n8n Verification Code
```javascript
const crypto = require('crypto');

function verifyCakeToHomeSignature(secret, headerSignature, rawBodyString, maxAgeSec = 300) {
  if (!headerSignature) return false;
  const parts = headerSignature.split(',');
  const t = parts.find(p => p.startsWith('t='))?.replace('t=', '');
  const v1 = parts.find(p => p.startsWith('v1='))?.replace('v1=', '');
  if (!t || !v1) return false;

  const timestamp = parseInt(t, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > maxAgeSec) return false; // Clock skew / replay check

  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBodyString}`).digest('hex');
  const bufActual = Buffer.from(v1, 'hex');
  const bufExpected = Buffer.from(expected, 'hex');
  if (bufActual.length !== bufExpected.length) return false;

  return crypto.timingSafeEqual(bufActual, bufExpected);
}
```

---

## 4. Standard Event Envelope

```json
{
  "event_id": "evt_1787130000000_a1b2c3d",
  "event_type": "order.created",
  "event_version": 1,
  "occurred_at": "2026-08-19T14:30:00.000Z",
  "environment": "production",
  "producer": "caketohome",
  "source": "caketohome",
  "request_id": "req_1787130000_f9a8",
  "correlation_id": "corr_evt_1787130000000_a1b2c3d",
  "idempotency_key": "idem_evt_1787130000000_a1b2c3d",
  "customer_uid": "cth_cus_9876543210",
  "order_id": "ord_10029",
  "store_id": "HUB-BLR-01",
  "branch_id": "HUB-BLR-01",
  "city_id": "BLR",
  "actor_type": "customer",
  "actor_id": "cth_cus_9876543210",
  "customer": {
    "id": "cth_cus_9876543210",
    "customer_uid": "cth_cus_9876543210",
    "name": "Priya Sharma",
    "phone": "+91 98765 43210",
    "email": "priya.sharma@example.com",
    "city": "Bangalore",
    "role": "CUSTOMER"
  },
  "data": {
    "order_id": "ord_10029",
    "order_number": "CTH-ORD-20260819-1001",
    "grand_total": 1499,
    "item_count": 2,
    "items": [
      {
        "product_id": "prod_1",
        "title": "Belgian Chocolate Truffle Cake",
        "quantity": 1,
        "price": 1299
      }
    ],
    "delivery_slot": "18:00 - 20:00",
    "delivery_date": "2026-08-19"
  },
  "payload": {
    "order_id": "ord_10029",
    "order_number": "CTH-ORD-20260819-1001",
    "grand_total": 1499,
    "item_count": 2
  },
  "metadata": {
    "client": "web",
    "channel": "storefront"
  }
}
```

---

## 5. Event Catalogue & Routing Matrix

| Category | Event Type (`event_type`) | Target n8n Automation Workflow | Trigger Condition |
| :--- | :--- | :--- | :--- |
| **AUTH** | `customer.registered` | **Customer Welcome & Onboarding** | First-time registration |
| **AUTH** | `customer.login.success` | **Login Telemetry & Risk Scoring** | Customer session started |
| **CART** | `cart.abandoned` | **Cart Recovery & WhatsApp Discount** | Cart idle for >15 mins |
| **CART** | `cart.recovered` | **Recovery Attribution & Ledger** | Order placed via recovery token |
| **CHECKOUT** | `checkout.completed` | **Checkout Conversion Metrics** | Payment gate cleared |
| **ORDER** | `order.created` | **Bakery Production Dispatch (KOT)** | New order authorized |
| **ORDER** | `order.paid` | **Invoice & Payment Notification** | Payment capture 200 |
| **ORDER** | `order.confirmed` | **Kitchen Acceptance SMS** | Store manager accepts order |
| **ORDER** | `order.ready` | **Rider Dispatch & Pickup OTP** | Cake decorated & boxed |
| **ORDER** | `order.out_for_delivery` | **Live Map Link & Customer OTP** | Driver claims pickup |
| **ORDER** | `order.delivered` | **Review Request & Sweet Rewards** | Doorstep OTP verified |
| **ORDER** | `order.cancelled` | **Automated Refund & Notification** | Cancel requested |
| **RECOVERY** | `recovery.link.created` | **WhatsApp Recovery Template Dispatch** | Cart recovery URL generated |
| **REORDER** | `customer.reorder_candidate.created` | **Telecaller Task & CRM Escalation** | 30-day / annual recurrence |
| **REORDER** | `customer.reorder_converted` | **Outreach Attribution & Commission** | Reorder call converted |
| **SYSTEM** | `test.webhook.ping` | **Gateway Connectivity Diagnostic** | Admin test center ping |

---

## 6. Two-Stage Execution Lifecycle & Callback API

n8n can optionally notify CakeToHome when long-running workflows complete via the callback endpoint:
`POST /api/v1/admin/webhooks/callback`

### Request Payload
```json
{
  "event_id": "evt_1787130000000_a1b2c3d",
  "execution_id": "exec_n8n_982710385",
  "status": "PROCESSED",
  "result_summary": "WhatsApp recovery template dispatched to +91 98765 43210. Message ID: wamid_12345.",
  "error_message": null
}
```

---

## 7. Delivery Guarantees & Idempotency
- **At-Least-Once Delivery**: Guaranteed via Transactional Outbox with exponential backoff retries.
- **Deduplication**: Every event contains an immutable `idempotency_key` (`idem_evt_*`) and `event_id`. Downstream workflows must use `event_id` or `idempotency_key` as deduplication keys in Redis or PostgreSQL before performing side effects.

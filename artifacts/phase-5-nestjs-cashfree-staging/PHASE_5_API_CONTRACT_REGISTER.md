# CAKETOHOME — API CONTRACT REGISTER
## Version 1 REST API Specifications under `/api/v1/*`

### 1. Standard Response Envelope

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2026-11-04T12:00:00.000Z",
    "correlationId": "cId_1793783700000_abcd",
    "version": "1.0.0"
  }
}
```

### 2. Error Response Envelope

```json
{
  "success": false,
  "error": {
    "code": "INVALID_SIGNATURE",
    "message": "HMAC-SHA256 Base64 signature verification failed",
    "details": null
  },
  "meta": {
    "timestamp": "2026-11-04T12:00:00.000Z",
    "correlationId": "cId_1793783700000_abcd",
    "version": "1.0.0"
  }
}
```

### 3. Key Endpoint Catalog

| Method | Path | Auth / Role | Description |
|---|---|---|---|
| `GET` | `/health` | Public | System diagnostic check and uptime |
| `POST` | `/api/v1/auth/otp/send` | Public | Send mobile OTP for authentication |
| `POST` | `/api/v1/auth/otp/verify` | Public | Verify mobile OTP and issue JWT |
| `GET` | `/api/v1/roles` | Authenticated | List 8 canonical RBAC roles |
| `POST` | `/api/v1/orders` | Authenticated | Create atomic order (Order ≠ Bill) |
| `POST` | `/api/v1/payments/cashfree/order` | Authenticated | Initiate Cashfree Drop checkout session |
| `POST` | `/api/v1/webhooks/cashfree` | Public (HMAC) | Ingest authoritative Cashfree webhook |
| `POST` | `/api/v1/webhooks/razorpay` | Public | Decommissioned endpoint (Returns 410 Gone) |
| `POST` | `/api/v1/delivery/verify-otp` | Authenticated | Verify customer delivery handover OTP |

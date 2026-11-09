# CAKETOHOME — API CONTRACT REGISTER
## Public and Private Endpoint Specification

| Endpoint | Method | Auth | Request Schema | Response Schema |
|---|---|---|---|---|
| `/api/v1/payments/webhook` | POST | Webhook HMAC | Razorpay Event Payload | `{ received: true, status: string }` |
| `/api/v1/orders` | POST | Customer JWT | `CreateOrderParams` | `{ success: boolean, order: OrderDomain }` |
| `/api/v1/orders/:id/status` | GET | Customer/Admin JWT | None | `{ success: boolean, order: { status, payment_status } }` |
| `/api/v1/auth/otp/send` | POST | Public | `{ phone: string }` | `{ success: boolean, challenge_id: string }` |
| `/api/v1/auth/otp/verify` | POST | Public | `{ phone: string, otp: string }` | `{ success: boolean, token: string, user: object }` |
| `/api/v1/store/kot/:id` | GET | Manager JWT | None | `{ success: boolean, kot: object }` |

# CakeToHome — Comprehensive API Architecture Audit (API_AUDIT.md)

**Generated**: 2026-08-18  
**Audit Scope**: `/api/v1/*`, `/api/auth/*`, `/api/subscribe/*`

---

## 1. Standardized Response Envelope Convention

All CakeToHome API routes adhere to the uniform JSON envelope convention:
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully",
  "error": null,
  "statusCode": 200
}
```

---

## 2. API Endpoints Catalog & Security Matrix

### A. Authentication & Session APIs
| Route Path | Method | Purpose | Auth Required | RBAC Permission | Primary Backend / Engine |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/v1/auth/request-otp` | `POST` | Dispatches 6-digit SMS OTP | None (Public) | None | `ApiEngine.requestAuthOtp()` |
| `/api/v1/auth/verify-otp` | `POST` | Verifies OTP, provisions new profile, issues JWT | None (Public) | None | `ApiEngine.verifyAuthOtp()` |
| `/api/auth/session` | `GET` | Resolves active user profile from JWT | Optional | None | `resolveUserAccount()` |
| `/api/auth/logout` | `POST` | Clears session cookies & logs audit event | User Session | None | Cookie Clear + Audit |

### B. Customer Portal & CRM 360 APIs
| Route Path | Method | Purpose | Auth Required | RBAC Permission | Primary Backend / Engine |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/v1/admin/customers` | `GET` | Lists customers with RFM filters & search | Staff Session | `CUSTOMER_CRM.VIEW` | `CRM360Engine.listCustomers()` |
| `/api/v1/admin/customers/:id` | `GET` | Retrieves full Customer 360 profile | Staff Session | `CUSTOMER_CRM.VIEW` | `CRM360Engine.getCustomerProfile()` |
| `/api/v1/admin/customers/:uid/orders` | `GET` | Retrieves real customer orders | Staff Session | `CUSTOMER_CRM.VIEW` | `ApiEngine.getOrdersByCustomerUid()` |
| `/api/v1/admin/customers/export` | `GET` | Exports customer Excel workbook | Staff Session | `CUSTOMER_CRM.EXPORT` | `ExcelExportService.exportCustomers()` |

### C. Catalog, PIM & Inventory APIs
| Route Path | Method | Purpose | Auth Required | RBAC Permission | Primary Backend / Engine |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/v1/products` | `GET` | Lists store catalog with branch availability | None (Public) | None | `ApiEngine.getProducts()` |
| `/api/v1/products/slug/:slug` | `GET` | Retrieves product detail with weight tiers | None (Public) | None | `ApiEngine.getProductBySlug()` |
| `/api/v1/admin/catalog/products` | `POST` | Creates new catalog item | Staff Session | `CATALOG.MANAGE` | `ApiEngine.createProduct()` |
| `/api/v1/admin/catalog/products/:id` | `PUT` | Updates product details and weight pricing | Staff Session | `CATALOG.MANAGE` | `ApiEngine.updateProduct()` |
| `/api/v1/admin/branches/:id/inventory` | `POST` | Overrides branch stock levels | Staff Session | `INVENTORY.EDIT` | `ApiEngine.updateBranchStock()` |

### D. Cart, Recovery & Checkout APIs
| Route Path | Method | Purpose | Auth Required | RBAC Permission | Primary Backend / Engine |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/v1/cart` | `GET`/`POST` | Retrieves or updates active cart session | Optional | None | `ApiEngine.getCart()` / `updateCart()` |
| `/api/v1/cart/activity` | `POST` | Ingests real-time cart browsing events | None (Public) | None | `ApiEngine.trackCartActivity()` |
| `/api/v1/cart/recover` | `POST` | Restores abandoned cart via secure token | None (Public) | None | `ApiEngine.revalidateAndRestoreCart()` |
| `/api/v1/checkout/validate` | `POST` | Pre-flight validation of slot & branch | Optional | None | `ApiEngine.validateCheckout()` |
| `/api/v1/checkout/confirm` | `POST` | Finalizes order, reserves stock, creates invoice | Optional | None | `ApiEngine.confirmCheckout()` |

### E. Telemarketing Reorder & Reactivation APIs
| Route Path | Method | Purpose | Auth Required | RBAC Permission | Primary Backend / Engine |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/v1/admin/telemarketing/candidates` | `GET` | Lists scored outreach opportunities | Staff Session | `TELEMARKETING.VIEW` | `TelemarketingEngine.listCandidates()` |
| `/api/v1/admin/telemarketing/candidates/:id/log-call` | `POST` | Logs call outcome & schedules follow-up | Staff Session | `TELEMARKETING.CONTACT` | `TelemarketingEngine.logCall()` |
| `/api/v1/admin/telemarketing/candidates/:id/convert-order` | `POST` | Links authoritative customer order | Staff Session | `TELEMARKETING.CONVERT_ORDER` | `TelemarketingEngine.recordAttributedOrder()` |
| `/api/v1/admin/telemarketing/staff/eligible` | `GET` | Dynamic telecaller dropdown from RBAC | Staff Session | `TELEMARKETING.ASSIGN` | `StaffAccessControl.getEligibleTelecallers()` |

### F. Enterprise n8n & External Webhook APIs
| Route Path | Method | Purpose | Auth Required | RBAC Permission | Primary Backend / Engine |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/v1/admin/webhooks/endpoints` | `GET`/`POST` | Lists & creates webhook endpoints | Staff Session | `SETTINGS.VIEW`/`EDIT` | `WebhookEngine.getEndpoints()` / `createEndpoint()` |
| `/api/v1/admin/webhooks/endpoints/:id/rotate-secret` | `POST` | Rotates HMAC signing secret | Staff Session | `SETTINGS.EDIT` | `WebhookEngine.rotateSigningSecret()` |
| `/api/v1/admin/webhooks/logs` | `GET` | Retrieves delivery logs & metrics | Staff Session | `SETTINGS.VIEW` | `WebhookEngine.getLogs()` |
| `/api/v1/admin/webhooks/outbox` | `GET` | Retrieves transactional outbox items | Staff Session | `SETTINGS.VIEW` | `WebhookEngine.getOutboxItems()` |
| `/api/v1/admin/webhooks/dlq` | `GET` | Retrieves dead letter queue items | Staff Session | `SETTINGS.VIEW` | `WebhookEngine.getDeadLetterQueue()` |
| `/api/v1/admin/webhooks/outbox/:id/replay` | `POST` | Replays dead-letter event | Staff Session | `SETTINGS.EDIT` | `WebhookEngine.replayEvent()` |
| `/api/v1/admin/webhooks/test` | `POST` | Dispatches diagnostic test webhook | Staff Session | `SETTINGS.VIEW` | `WebhookEngine.testEndpoint()` |
| `/api/v1/admin/webhooks/callback` | `POST` | Ingests n8n workflow execution callback | HMAC Verified | None | `WebhookEngine.recordWorkflowCallback()` |

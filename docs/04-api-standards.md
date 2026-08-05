# 04 — API Standards

## RESTful Resource Naming Rules

### 🚫 STRICT PROHIBITION: NO VERBS IN URL PATHS
URL paths MUST identify resources (nouns), never actions (verbs).

| ❌ Forbidden (Verbs in Path) | ✅ Allowed (REST Nouns + Verbs in HTTP Method) |
| :--- | :--- |
| `POST /api/v1/getProducts` | `GET /api/v1/products` |
| `POST /api/v1/createOrder` | `POST /api/v1/orders` |
| `POST /api/v1/searchCake` | `GET /api/v1/products?search=cake` |
| `POST /api/v1/updateAddress` | `PATCH /api/v1/customers/addresses/:id` |
| `GET /api/v1/deleteWishlist` | `DELETE /api/v1/wishlist/:id` |

---

## Standard JSON Response Envelopes

Every API endpoint must return responses conforming to standard JSON envelopes:

### 1. Success Response Envelope
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150
  }
}
```

### 2. Error Response Envelope
```json
{
  "success": false,
  "error": {
    "code": "INVALID_OTP",
    "message": "The verification code provided is incorrect or has expired.",
    "details": []
  }
}
```

---

## Standard HTTP Status Codes

| Status Code | Meaning | Usage Scenario |
| :--- | :--- | :--- |
| `200 OK` | Request Succeeded | Successful `GET`, `PATCH`, `PUT` queries |
| `201 Created` | Resource Created | Successful `POST` creations (e.g. order placed) |
| `204 No Content` | Succeeded with No Content | Successful `DELETE` actions |
| `400 Bad Request` | Validation Error | Payload failed Zod schema checks |
| `401 Unauthorized` | Auth Required | Missing or invalid JWT header |
| `403 Forbidden` | Access Denied | User lacks role permission |
| `404 Not Found` | Resource Missing | Non-existent entity ID |
| `409 Conflict` | Unique State Violation | Duplicate phone / double booking conflict |
| `429 Too Many Requests` | Rate Limited | Exceeded OTP or request limits |
| `500 Internal Error` | Server Exception | Unhandled system failure |

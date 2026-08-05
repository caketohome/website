# 05 — Security Standards

## Authentication Architecture

CakeToHome uses two primary authentication mechanisms:

1. **Customer Authentication (Mobile Phone + OTP)**:
   * Customers log in via 6-digit SMS OTP.
   * OTPs are generated server-side using secure crypto randomness (`crypto.randomInt(100000, 999999)`).
   * OTPs are stored at rest using HMAC-SHA256 hashing (`crypto.createHmac("sha256", secret)`).
   * Rate-limiting enforced: 30-second resend cooldown, 5-minute TTL, maximum 5 invalid attempts before lock.
   * Successful verification issues a signed JWT token (`Authorization: Bearer <jwt_token>`).

2. **Staff & Admin Authentication (Credentials + RBAC + 2FA)**:
   * Staff/Admins log in with email/username and password (hashed via Argon2 / bcrypt).
   * Multi-Factor Authentication (TOTP 2FA) supported via standard authenticator apps (Google Authenticator).
   * Optional IP CIDR Whitelisting for admin endpoints.

---

## Roles & Access Control Matrix (RBAC)

| Role | Scope & Permissions |
| :--- | :--- |
| `customer` | Own account profile, addresses, orders, cart, wishlist, loyalty points. |
| `shop_manager` | Branch orders KDS, branch inventory availability matrix, slot capacities. |
| `delivery_partner` | Pincode delivery job board, claimed orders, route status updates. |
| `super_admin` | Global platform settings, all branches, CMS, SEO, analytics, audit logs. |

---

## Security Hardening Rules
* **Header Protection**: Use `helmet` middleware for HTTP security headers (HSTS, CSP, X-Frame-Options).
* **CORS Policy**: Restrict CORS origins strictly to authorized storefront and admin web origins.
* **Rate Limiting**: Enforce global and route-specific rate limiters via Redis (`express-rate-limit` with RedisStore).
* **Input Sanitization**: Strip all HTML/script tags from user inputs to prevent XSS.

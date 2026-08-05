# ADR-003: Mobile Phone OTP & Role-Based JWT Authentication

## Status
Accepted

## Context
Bakery customers expect frictionless mobile phone OTP login without passwords, while bakery staff and admins require role-gated access with 2FA TOTP support.

## Decision
1. **Customer Auth**: 6-digit SMS OTP, hashed at rest using HMAC-SHA256, 5-minute TTL, 30s resend cooldown.
2. **Session Security**: Issue signed JWT tokens (`Authorization: Bearer <token>`) with explicit role payload (`customer`, `shop`, `delivery_partner`, `admin`).
3. **Staff / Admin Auth**: Email/password credentials + Google Authenticator TOTP 2FA.

## Consequences
* **Positive**: Fast 1-click mobile verification for customer conversion; robust RBAC for staff and drivers.
* **Negative**: Requires Redis/DB tracking for OTP attempt limiting and token revocation lists.

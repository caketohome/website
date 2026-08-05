# ADR-006: Redis Distributed Caching & Rate Limiting

## Status
Accepted

## Decision
Use Redis 7 (`ioredis`) for high-speed catalog caching, rate limiting (`express-rate-limit` store), OTP resend cooldowns, and active session invalidations. Dynamic inventory and pricing data are NEVER cached to ensure data correctness.

# Changelog
All notable changes to the Cakes2Home Rewards Platform project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-07-17
### Added
- **Wallet Domain (Milestone 7.1)**:
  - Custom MikroORM database models `Wallet` and `WalletTransaction`.
  - Mutual locking system using string-key memory mutexes to prevent concurrent balance modifications.
  - Manual adjustment API endpoints for balance overrides.
- **Gift Cards Domain (Milestone 7.2)**:
  - Ledger-backed `GiftCard` and `GiftCardTransaction` models.
  - Alphanumeric code generation, activate/disable overrides, and expiry gates.
  - Double-entry balance debit checks.
- **Loyalty Program Domain (Milestone 7.3)**:
  - Rules engine point accumulation models `LoyaltyLedger`, `LoyaltyTransaction`, and `LoyaltyRule`.
  - Automatic tier promotions logic (Bronze, Silver, Gold, Platinum).
- **Referrals Flow Domain (Milestone 7.4)**:
  - Decoupled event-driven referrals engine mapping signups and conversions.
  - Qualification checks (minimum spent, minimum orders, IP/device duplicate fraud evaluations).
  - Suspicious indicator reviews queue.
- **Storefront Rewards Integration (Milestone 7.5)**:
  - Unified account dashboard components presenting wallets logs, loyalty progress bar, and SVG QR share codes.
  - checkout rewards redemption payment widget splitting debit calculations across multiple tokens.
- **Admin Controls extensions (Milestone 7.6)**:
  - Medusa Admin route extension dashboard under `/a/rewards`.
  - Tabbed overview displaying: Chronological Audit timeline, customer wallets listing, loyalty points adjusting, gift cards generators, referrals queue, and Customer 360 dashboards.
  - Customer search detail profile API returning aggregated rewards details.
- **Analytics & Notifications integration (Milestone 7.7)**:
  - Boot loader `seed-rewards-notification-templates.ts` registering default templates.
  - Best-effort event hook alerts and SMS/WhatsApp notification dispatches for credit, debit, gift card redemption, and referral payout events.

### Security
- Authenticated and authorized administrative overrides using Medusa Admin RBAC tokens.
- Input validation sanitization filters utilizing `zod` schemas.

### Performance
- Serialized database updates using lock keys for concurrent account wallets, loyalty ledgers, and gift cards modifications.

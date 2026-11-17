# 27 — UI/UX Redesign Brief (Workstream M13, queued after M12 PWA notifications)

Status: **PLANNED — not started.** Start only after M12 (PWA order alerts) is verified and deployed.
Source: owner brief "CakeToHome — Complete Application UI/UX Redesign, Master Implementation Prompt" (2026-11-16).
Prior planning to reuse first: `docs/redesign-checkpoints/` (route inventory, design system, animation system, implementation plan).

## Objective
Application-wide redesign into a premium, consistent bakery e-commerce brand — implemented in the real codebase and verified in a running browser, not mockups.
Must not look AI-generated or like a generic SaaS template.

## Non-negotiables
- **Preserve the homepage scroll animations** (reveals, stagger, parallax, sticky nav, carousels). Inspect and record before touching; don't swap the animation library without a verified reason; respect `prefers-reduced-motion`; no scroll-jacking, no layout shift.
- **UI only.** No changes to pricing, discounts, coupons, offers, tax, delivery charges, inventory, order creation, payments, refunds, cash/teller, accounting, or auth rules. No schema/migration changes for visual reasons; any needed backend change → evidence + approval first.
- **No fakes.** No mock APIs, hardcoded OTPs, fabricated metrics/tracking events/product attributes, or success shown before the backend confirms.
- **Security preserved:** auth (Supabase phone OTP), RBAC, customer ownership checks, branch isolation, rate limits. Frontend filtering is not an authorisation boundary.
- **One design system.** Centralised tokens in the existing token architecture; reuse components; no competing theme or new component library without verified need.
- Use the official logo/brand assets as source of truth; if a verified brand colour differs from the palette below, document it and use the brand value.
- Git: inspect status first, preserve uncommitted work, no commit/push without explicit authorisation.

## Colour tokens
| Token | HEX | Use |
|---|---|---|
| Primary Navy | `#1D2F5D` | headings, nav, key text |
| Primary Blue | `#245A96` | primary actions, links, active states |
| Secondary Blue | `#3978B8` | hover / selected |
| Light Blue | `#EAF2FA` | subtle highlight / selected bg |
| Deep Navy | `#152347` | footer, dark surfaces |
| White | `#FFFFFF` | cards, forms, nav |
| Warm White | `#FFFCF8` | page background |
| Cream | `#F8F3EB` | selected sections |
| Light Grey | `#F5F6F8` | secondary bg |
| Border Grey | `#E5E7EB` | borders |
| Muted Grey | `#6B7280` | secondary text |
| Dark Text | `#172033` | body text |
| Primary Gold | `#C28A2C` | small accents |
| Light Gold | `#F5E8CC` | highlighted surfaces |
| Dark Gold | `#9B6A19` | gold hover |
| Success / bg | `#16834A` / `#EAF7EF` | |
| Warning / bg | `#B7791F` / `#FFF6E5` | |
| Error / bg | `#C93636` / `#FDECEC` | |
| Info | `#245A96` | |

Balance ≈ 65% white/warm white, 20% neutrals, 10% navy/blue, 5% gold + status. Blue is selective — never whole sidebars/cards/sections.
Customer panel & login: page `#FFFCF8`, cards/sidebar `#FFFFFF`, headings `#1D2F5D`, active nav `#EAF2FA` bg + `#245A96` text, primary button `#1D2F5D` (hover `#245A96`), input focus `#245A96`.

Avoid: decorative waves, floating graphics, heavy gradients/glows/shadows, pill buttons and over-rounded cards everywhere, random icons, oversized repeated headings.
Prefer: real product photography, consistent grids, balanced whitespace, restrained borders, clear hierarchy.

## Scope (every existing route — build a route inventory first)
1. **Public site:** header/announcement/nav/search/cart, homepage, categories, listing (filters, sort, skeletons, empty/error), product detail (variants, egg/eggless, message, add to bag, wishlist), informational and legal pages, footer.
2. **Cart → checkout → confirmation:** totals from backend only; real order/payment state.
3. **Auth:** login, country code, OTP (paste, resend countdown, change number, invalid/expired states). Keep Supabase OTP, E.164, redirects, role checks.
4. **Customer panel:** overview, orders, order detail, tracking (real events only), addresses, profile, wishlist, settings, support — plus any other existing section.
5. **Admin panel:** every existing module; dense, readable tables/forms; real data only.
6. **CMS builder:** keep persistence, real save/publish, preview = live; no hardcoded homepage or duplicate offer records.
7. **Teller / operational UIs:** visual only; ledger, reconciliation, maker-checker, approvals untouched.
8. **Invoices & documents:** A4 + thermal + KOT + PDFs; keep GSTIN, invoice no./date, HSN/SAC, CGST/SGST/IGST, totals; test real PDF/thermal output.

## Quality gates
- Responsive at 320, 360, 375, 390, 414, 768, 1024, 1280, 1440 + large; no horizontal overflow or clipped controls.
- WCAG 2.2 AA: contrast, keyboard, visible focus, labels, modal focus, touch targets, reduced motion.
- Performance measured before/after (load, CLS, bundle, scroll animation); no regressions for visuals.
- Verification: typecheck, lint, production build, existing unit/integration/Playwright tests, real-browser screenshots (desktop/tablet/mobile) of every redesigned area, console/network clean. Never report unexecuted tests as passed.

## Phases
1 Audit + route inventory + baseline screenshots → 2 Design tokens/typography/shared components → 3 Public site (incl. animations) → 4 Cart/checkout → 5 Auth → 6 Customer panel → 7 Admin + CMS → 8 Teller, invoices, documents → 9 Full verification.
Stop and raise any major architectural uncertainty before risky changes.

## Final report must list
Skills actually used vs unavailable, routes covered, what changed per area, tests run with real results, screenshots, and anything not done.

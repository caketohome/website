# CHECKPOINT — PHASE 4: STOREFRONT CARDS & INTERACTIVE CLICKABILITY
**Timestamp:** 2026-09-12 15:16:00 IST  
**Environment:** Next.js 14 (`localhost:3000`), Medusa v2 / PostgreSQL 17.6  
**Git Branch:** `task/dev`  
**Current Phase:** Phase 4 — Storefront Cards & Interactive Clickability  

---

## 1. Phase Objective
Inspect and repair category cards, occasion cards, and product cards:
1. **Category and occasion cards:**
   - Entire card must be clickable.
   - Remove redundant repeated CTA text ("Preserve Memories →").
   - Destination controlled by persisted CMS/PIM data.
   - Maintain brand theme tokens (Navy `#1D2F5D`, Gold `#D4AF37`), eliminate arbitrary pink backgrounds.
   - Preserve image URLs.
2. **Product cards:**
   - Entire card clickable to product detail page via stretched link (`z-10`).
   - Remove separate "Order" button cluttering the card.
   - Wishlist button isolated at `z-20` with `e.stopPropagation()` so clicking wishlist does not trigger navigation.
   - Show only database-backed price, availability, labels, and badges.
   - Never show eggless/vegan/dairy-free claims unless explicitly active in PostgreSQL.
   - No fake stock, fake discounts, fake ratings, or fake delivery promises.

---

## 2. Invariants
- Zero deletion or modification of legacy database records.
- Preserve all existing checkpoints and reports.

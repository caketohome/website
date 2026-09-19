# CakeToHome — Design Tokens and Primitives (Phase 1 Checkpoint)

**Date**: 2026-09-11  
**Phase**: Phase 1 — Design Tokens and Primitives  
**Status**: COMPLETED  
**Brand Anchor**: `#1D2F5D` (Royal Patisserie Navy)

---

## 1. Objective
Establish a centralized, luxury patisserie design system anchored in `#1D2F5D` with semantic tokens for color, typography, spacing, surfaces, and interactive buttons. Ensure that all customer-facing sections and builder editors can utilize these unified tokens rather than ad-hoc inline styles.

---

## 2. Files Inspected & Modified

1. **`frontend/tailwind.config.ts`** [MODIFIED]
   - Added semantic brand tokens:
     - `brand-primary`: `#1D2F5D`
     - `brand-primary-dark`: `#0F1A36`
     - `brand-primary-light`: `#2A4380`
     - `brand-primary-soft`: `#EAEFF8`
     - `brand-cream`: `#FDFBF7`
     - `brand-warm-white`: `#FAFAF9`
     - `brand-surface`: `#FFFFFF`
     - `brand-surface-muted`: `#F4F5F7`
     - `brand-text`: `#111827`
     - `brand-text-muted`: `#64748B`
     - `brand-border`: `#E2E8F0`
     - `brand-gold`: `#D4AF37`
     - `brand-gold-soft`: `#FDF9EF`
     - `brand-gold-dark`: `#997A1E`
     - `brand-rose`: `#B76E79`
2. **`frontend/src/app/globals.css`** [MODIFIED]
   - Declared CSS variables in `:root` matching semantic tokens.
   - Created luxury component classes:
     - `.btn-brand-primary`: Rounded pill button in `#1D2F5D` with micro-elevation and hover translate.
     - `.btn-brand-secondary`: Clean outline button with navy border.
     - `.btn-brand-gold`: High-impact accent button in `#D4AF37`.
     - `.badge-brand-gold` and `.badge-brand-navy`: Micro-badges with subtle borders.
     - `.card-patisserie-light` and `.card-patisserie-dark`: Tactile hover elevation cards.
3. **`frontend/src/components/store/ui/luxury-primitives.tsx`** [NEW]
   - `BrandSectionWrapper`: Themeable section container enforcing responsive horizontal padding, max-w-7xl constraint, and controlled vertical spacing.
   - `BrandHeading`: Luxury serif heading (`Playfair Display`) with gold accent highlights, eyebrows, and accessibility hierarchy.
   - `BrandButton`: Accessible interactive link/button primitive.

---

## 3. Section Rhythm Architecture

The homepage will follow a deliberate visual cadence to prevent dark-navy or white-space monotony:
1. **Hero**: Royal Navy (`#1D2F5D`) with interactive 22-frame canvas or editorial hero mode.
2. **Signature Collections**: Warm Cream (`#FDFBF7`) with tactile cards.
3. **Bestsellers**: Pure White (`#FFFFFF`) with high-contrast product photography.
4. **Occasion Discovery**: Soft Slate (`#F8FAFC`) with festive badge pills.
5. **Brand Craft Story**: Deep Royal Navy (`#1D2F5D`) with gold accent quotes and artisanal bakery imagery.
6. **Trust & Delivery**: Warm Cream (`#FDFBF7`) with verified guarantee chips.
7. **Bespoke Custom Cake Studio**: Pure White (`#FFFFFF`) with step-by-step customizer.
8. **Social Proof**: Soft Slate (`#F8FAFC`) with genuine customer quotes and ratings.
9. **Final Conversion CTA**: Royal Navy (`#1D2F5D`) with dual gold-accent CTAs.

---

## 4. Next Phase
Proceed to **Phase 2 — Premium Homepage Sections**: Upgrade the 9 section types in `page-renderer.tsx` to utilize the new primitives and ensure full CMS control over layout, style, CTA, and media.

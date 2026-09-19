# Checkpoint 04 — Comprehensive Visual Design System & Brand Psychology

- **Checkpoint ID**: `CP-04-DESIGN-SYSTEM`
- **Date**: 2026-09-11
- **Current Phase**: Phase 2 — Design System & Visual Architecture
- **Objective**: Establish a unified, luxury patisserie design system anchored in `#1D2F5D` (Royal Patisserie Navy), harmonizing the 9 visual and emotional references into a purposeful, high-conversion visual language.
- **Risk Level**: LOW (Design Tokens & Styling Specifications)

---

## 1. Brand Identity Anchor & Palette Architecture

The primary brand anchor is **`#1D2F5D`** (Midnight Royal Navy). Rather than flooding every section in dark navy, the design system utilizes a deliberate **section contrast rhythm** alternating between deep navy anchors, warm editorial cream, pure gallery white, soft slate, and restrained antique gold accents.

### A. Semantic Color Palette

| Token Name | Hex Code | HSL / RGB | Purpose & Application Rules |
| :--- | :--- | :--- | :--- |
| `brand-primary` | `#1D2F5D` | `rgb(29, 47, 93)` | Primary brand anchor. Hero backgrounds, major CTA buttons, primary heading accents, footer. |
| `brand-primary-dark` | `#0F1A36` | `rgb(15, 26, 54)` | Ultra-deep navy for tenebrism shadows, high-contrast text on cream surfaces, dark card backgrounds. |
| `brand-primary-light`| `#2A4380` | `rgb(42, 67, 128)` | Interactive hover state for primary buttons, active tab borders, focus rings. |
| `brand-primary-soft` | `#EAEFF8` | `rgb(234, 239, 248)`| Subtle navy tint for input backgrounds, secondary badges, soft highlights. |
| `brand-cream` | `#FDFBF7` | `rgb(253, 251, 247)`| Warm editorial patisserie cream. Signature collection backdrops, testimonial surfaces. |
| `brand-warm-white` | `#FAFAF9` | `rgb(250, 250, 249)`| Gentle off-white for card interiors, reducing glare while maintaining crisp contrast. |
| `brand-surface` | `#FFFFFF` | `rgb(255, 255, 255)`| Pure gallery white for product card backgrounds, dialogs, and popovers. |
| `brand-surface-muted`| `#F4F5F7`| `rgb(244, 245, 247)`| Neutral light grey for borders, divider lines, and disabled button backgrounds. |
| `brand-text` | `#111827` | `rgb(17, 24, 39)` | High-contrast charcoal for all readable body text (WCAG AAA contrast on cream and white). |
| `brand-text-muted` | `#64748B` | `rgb(100, 116, 139)`| Slate grey for secondary metadata, product weights, delivery cutoff notices. |
| `brand-border` | `#E2E8F0` | `rgb(226, 232, 240)`| Clean hairline borders for card dividers, table rows, and input fields. |
| `brand-gold` | `#D4AF37` | `rgb(212, 175, 55)` | Antique Gold accent. Rating stars, craftsmanship badges, luxury ribbon tags, celebratory CTAs. |
| `brand-gold-soft` | `#FDF9EF` | `rgb(253, 249, 239)`| Soft ivory-gold tint for review badge backgrounds and guarantee chips. |
| `brand-gold-dark` | `#997A1E` | `rgb(153, 122, 30)` | High-contrast gold text on light backgrounds (WCAG AA accessible). |
| `brand-rose` | `#B76E79` | `rgb(183, 110, 121)`| Romantic rose-gold accent. Coquette ribbons, Valentine/Anniversary tags, artisanal berry highlights. |

---

## 2. Harmonized Application of the 9 Visual Styles

Each of the 9 mandated styles is applied **purposefully** rather than scattered randomly:

1. **Luxury Typography**:
   - *Application*: `Playfair Display` serif font for all primary and secondary headings (`h1`, `h2`), collection titles, and chef quotes. Provides instant French patisserie elegance.
2. **Modular Typography**:
   - *Application*: `Plus Jakarta Sans` / `Inter` geometric sans-serif for prices, weights, countdowns, delivery slot times, and technical specs. Ensures maximum clarity and legibility.
3. **Glassmorphism**:
   - *Application*: Applied strictly to floating navigation bars, dropdown menus, popovers, and sticky purchase drawers (`backdrop-filter: blur(20px)` with 85% opacity). Never used on long-form body text.
4. **Scrapbook Details**:
   - *Application*: Subtle rotated photo corners, chef recipe notebook stamps ("Baked Fresh Daily", "100% Belgian Cocoa"), and hand-drawn delivery route ribbons in the Brand Story section.
5. **Utilitarian Surrealism**:
   - *Application*: Used in the Bespoke Custom Cake Studio section — clean, hyper-functional 4-step customization grid paired with dreamlike 3D cake architecture visuals.
6. **Coquette**:
   - *Application*: Reserved strictly for Celebration, Birthday, and Romantic gifting sections — delicate ribbon tags, pastel rose badges, and celebration box packaging cues.
7. **Tenebrism (Chiaroscuro Contrast)**:
   - *Application*: High-contrast lighting in the Hero and Brand Story sections — intense spotlighting on decadent chocolate ganache textures emerging from deep Obsidian/Navy `#0D152B` shadows.
8. **Japandi (Restraint & Function)**:
   - *Application*: Guides the layout spacing, whitespace discipline, cart, checkout, and admin tables — calm, functional, clutter-free, and accessible.
9. **Anthropomorphic Details**:
   - *Application*: Subtle character micro-moments (e.g. friendly smiling chef whisk badge, joyful celebratory cake celebration avatars) to boost customer brand delight and memorability.

---

## 3. Typography Hierarchy

| Level | Font Family | Size (Desktop / Mobile) | Line Height | Tracking | Weight | Role |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Hero Display (H1)** | `Playfair Display` (Serif) | `48px` / `32px` | `1.15` | `-0.02em` | `700` (Bold) | Hero headline, major campaign banner |
| **Section Title (H2)** | `Playfair Display` (Serif) | `36px` / `26px` | `1.2` | `-0.015em`| `700` (Bold) | Section headings (Signature Collections, Bestsellers) |
| **Subsection (H3)** | `Playfair Display` (Serif) | `24px` / `20px` | `1.25` | `0` | `600` (SemiBold)| Product card titles, feature highlights |
| **Product Title** | `Plus Jakarta Sans` (Sans) | `16px` / `15px` | `1.35` | `0` | `600` (SemiBold)| Catalog grid card titles |
| **Price Display** | `Plus Jakarta Sans` (Sans) | `20px` / `18px` | `1.0` | `-0.01em` | `700` (Bold) | Live product pricing, discount strikeouts |
| **Eyebrow / Badge** | `Plus Jakarta Sans` (Sans) | `12px` / `11px` | `1.0` | `+0.05em` | `700` (Uppercase)| Section category eyebrows, bestseller tags |
| **Body Text** | `Plus Jakarta Sans` (Sans) | `16px` / `14px` | `1.6` | `0` | `400` (Regular) | Editorial story, product descriptions |
| **Metadata / Micro** | `Plus Jakarta Sans` (Sans) | `13px` / `12px` | `1.4` | `0` | `500` (Medium) | Weights, delivery slots, allergen warnings |

---

## 4. Spacing, Elevation & Component Primitives

### A. Spacing Tokens
- `spacing-xs`: `4px` (micro badges, gap between icon and label)
- `spacing-sm`: `8px` (button internal gap, input padding)
- `spacing-md`: `16px` (card content padding, form field gap)
- `spacing-lg`: `24px` (grid column gap, modal internal padding)
- `spacing-xl`: `32px` (section inner gap, desktop card padding)
- `spacing-2xl`: `48px` to `64px` (section vertical rhythm)
- `spacing-3xl`: `80px` to `112px` (hero and major narrative dividers)

### B. Radius & Elevation
- `rounded-pill`: `9999px` (buttons, badge chips, search bar)
- `rounded-card`: `20px` (`1.25rem`) (product cards, testimonial panels, modal containers)
- `shadow-subtle`: `0 4px 20px rgba(0, 0, 0, 0.04)` (light card resting state)
- `shadow-hover`: `0 12px 30px rgba(29, 47, 93, 0.08)` (light card interactive hover)
- `shadow-glow`: `0 16px 40px rgba(29, 47, 93, 0.3)` (dark navy spotlight surface)

### C. Core Component Primitives (defined in `luxury-primitives.tsx`)
1. **`BrandSectionWrapper`**: Standardized theme-aware section container supporting `theme="navy" | "cream" | "white" | "slate"` with responsive horizontal padding and `max-w-7xl` constraint.
2. **`BrandHeading`**: Accessible serif heading with optional antique gold highlight span, uppercase eyebrow badge, and subtitle.
3. **`BrandButton`**: Rounded pill interactive button in `variant="primary"` (`#1D2F5D`), `variant="secondary"` (navy outline), and `variant="gold"` (`#D4AF37`).
4. **`BrandCard`**: Responsive patisserie card with micro-elevation hover transition (`translateY(-3px)`).

---

## 5. Motion & Accessibility Safeguards
- **Reduced-Motion Enforced**: `@media (prefers-reduced-motion: reduce)` automatically suppresses transforms, sticky canvas scrolling, and parallax, rendering immediate crisp posters and instant transitions.
- **Contrast Guarantee**: All text meets WCAG 2.1 Level AA (minimum 4.5:1 for body, 3:1 for large text).
- **Touch Targets**: Minimum `44px x 44px` on all mobile clickable targets.

---

## 6. Comprehensive Style-by-Style Implementation Matrix
For the complete 23-point technical audit and implementation matrix covering all 9 mandatory visual styles (Glassmorphism, Modular Typography, Scrapbook, Utilitarian Surrealism, Coquette, Tenebrism, Japandi, Luxury Typography, Anthropomorphic Design), see:
👉 **[Checkpoint 04B: Mandatory Style-by-Style Implementation Audit](file:///e:/vig/cakes2home-main/cakes2home-main/docs/redesign-checkpoints/04b-style-by-style-audit.md)**.

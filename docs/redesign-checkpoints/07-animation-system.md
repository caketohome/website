# Checkpoint 07: Animation & Motion System Specification

- **Checkpoint ID**: `CP-07-MOTION`
- **Date**: 2026-09-11
- **Current Phase**: Phase 6 / Cross-Platform Motion Design
- **Status**: `PRODUCTION-READY (CURRENT ARCHITECTURE)`
- **Risk Level**: Low

---

## 1. Executive Summary & Philosophy

CakeToHome’s motion design system creates an immersive, sensory, and luxurious confectionery experience while maintaining strict **60fps performance** and full **WCAG 2.2 accessibility**. 

Motion is never purely decorative:
- It guides visual hierarchy.
- It rewards customer interaction.
- It provides immediate feedback on cart and order actions.
- It respects users who have enabled `prefers-reduced-motion`.

---

## 2. Desktop Canvas Scrubbing Engine (`ScrollFrameHero`)

The flagship visual experience on the homepage is the **22-frame desktop canvas scrubbing engine**:
- **Canvas Resolution**: High-DPI rendered canvas element.
- **Scroll Driver**: Smooth normalized scroll percentage driving frame index `0` to `21`.
- **Preloading Strategy**: Frame images are preloaded via an offscreen memory pipeline before initial reveal, eliminating flash of unrendered frames.
- **Durable Configuration**: Stored in `cmspg_home` under `desktop.frames`. CMS page saves and version rollbacks strictly preserve these assets.
- **Hardware Acceleration**: Canvas operations use `requestAnimationFrame` with passive scroll event listeners to prevent layout thrashing and main-thread blocking.

### Mobile & Low-Power Fallback
- On viewports below `768px` or devices with touch-primary pointers, the heavy canvas scrubber is automatically replaced by an optimized **Single Hero Poster** with subtle floating text animations.
- This ensures 0ms scroll lag on mobile network connections.

---

## 3. Motion Tokens & Easing Curves

```css
:root {
  /* Durations */
  --motion-duration-instant: 100ms;
  --motion-duration-fast: 200ms;
  --motion-duration-base: 350ms;
  --motion-duration-slow: 600ms;
  --motion-duration-cinematic: 1000ms;

  /* Easing Curves */
  --motion-ease-out: cubic-bezier(0.16, 1, 0.3, 1);       /* Smooth luxury deceleration */
  --motion-ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);  /* Symmetrical flow */
  --motion-ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);/* Micro-bounce for tags & badges */
}
```

---

## 4. Reusable Motion Primitives

1. **Card Elevation & Gold Glow (`hover-luxury`)**:
   - `transform: translateY(-4px)`
   - `box-shadow: 0 12px 30px -8px rgba(29, 47, 93, 0.15), 0 0 1px 1px rgba(212, 175, 55, 0.25)`
   - Applied to product cards, occasion tiles, and trust badges.
2. **Gold Shimmer (`animate-shimmer`)**:
   - Continuous subtle gradient sweep across CTA buttons and announcement bar highlights.
3. **Pill & Drawer Slide-Over**:
   - Smooth `cubic-bezier(0.16, 1, 0.3, 1)` entrance from right for cart and filter drawers.
4. **Cake Message Alert Reveal**:
   - Modal pop-in with `scale(0.95) → scale(1.0)` and `opacity: 0 → 1` over `200ms`.

---

## 5. Accessibility & Reduced Motion Safeguards

```css
@media (prefers-reduced-motion: reduce) {
  *, ::before, ::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```
- In `PageRenderer` and `ScrollFrameHero`, `prefers-reduced-motion` is queried via `window.matchMedia('(prefers-reduced-motion: reduce)')`.
- When enabled, the canvas scrubber freezes on the hero frame and displays static, accessible typography.

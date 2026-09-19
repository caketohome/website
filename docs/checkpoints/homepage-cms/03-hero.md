# Checkpoint 03: Premium Hero (Dual-Mode)

> **Phase**: Phase 3  
> **Status**: PENDING

---

## Scope & Objectives
1. Implement seamless dual-mode support for Hero section in `PageRenderer`:
   - **Mode A (Scroll Sequence Scrub)**: When `config.disable_scroll_sequence !== true` and frames exist, render `<ScrollFrameHero>` with luxury patisserie typography and gold badge overlays.
   - **Mode B (Luxury Editorial Static)**: When scroll sequence is disabled, render the static patisserie hero with Playfair serif typography, italic fragment, gold eyebrow (`#D4AF37`), and pill CTA buttons.
2. Ensure all text, badges, images, and CTAs are driven from PostgreSQL CMS section config without hardcoding.

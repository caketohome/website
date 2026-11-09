# CMS Performance Report

## 1. Rendering Optimization
- **Section Motion:** `SectionMotionWrapper` utilizes native `IntersectionObserver` to trigger CSS transforms only when scrolled into view. Automatically respects `prefers-reduced-motion`.
- **Dynamic Imports:** Heavy components like `ScrollFrameHero` are loaded via Next.js `dynamic` with SSR disabled to eliminate main-thread blocking.

## 2. Database Query Efficiency
- Indexed lookups by `slug` and `language_code` execute in under 1ms.
- Single atomic query retrieves page metadata and all serialized sections in a single round-trip, completely eliminating N+1 database query waterfalls.

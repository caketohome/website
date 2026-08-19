# CakeToHome Scroll Animation Architecture & Duplicate Root Cause Audit

## 1. System Inventory

| Component | File Path | Imported By | Rendered By | Initialization Count | Frame Source | Frame Range | Speed Config | Duplicate Risk / Cause |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `ScrollFrameHero` | `frontend/src/components/store/animation/scroll-frame-hero.tsx` | `page-renderer.tsx`, `storefront-product-homepage.tsx` | CMS Homepage (`sec_home_hero`), Catalog Fallback Homepage | 1 per component lifecycle (Instance scoped) | Cloudinary `frames1_XXXX.jpg` | 1–112 (Excessive 112 frames) | `scrollLengthVh: 240vh`, `easing: 0.20` | **Major Root Cause**: In-flight duplicate requests in `preloadAroundTarget`, un-memoized component-scoped `Map`, 112 frame range |
| `ScrollSequenceSection` (Legacy) | `frontend/src/components/store/animation/scroll-sequence-section.tsx` | None (Unused) | None | 0 | Cloudinary `frames1_XXXX.jpg` via `FrameCache` | 1–112 | `sectionHeight: 240vh`, `easing: 0.18` | Dead code (deprecated in favor of `ScrollFrameHero`) |
| `ScrollSequenceCanvas` (Legacy) | `frontend/src/components/store/animation/scroll-sequence-canvas.tsx` | `scroll-sequence-section.tsx` | None | 0 | `FrameCache` | 1–112 | `easing: 0.18` | Dead code (deprecated) |
| `FrameCache` (Legacy) | `frontend/src/components/store/animation/frame-cache.ts` | `scroll-sequence-section.tsx`, `scroll-sequence-canvas.tsx` | None | 0 | Cloudinary | 1–112 | N/A | Dead code (deprecated) |

---

## 2. Root Cause Analysis (Why Frames Loaded Twice)

Our systematic audit identified the exact combination of factors causing duplicate frame requests:

1. **In-Flight Scroll Preload Collision (`preloadAroundTarget`)**:
   - `scroll-frame-hero.tsx` previously scheduled background preloading of frames 16–112 in batches.
   - When the user scrolled, `handleScroll` triggered `preloadAroundTarget(target)` on every single scroll event.
   - `preloadAroundTarget` checked `!loadedFramesRef.current.has(frame)`.
   - Because frames currently downloading in the background queue were not yet complete (`onload` had not fired), `has(frame)` evaluated to `false`.
   - `preloadAroundTarget` instantiated a **second `new Image()`** with the identical Cloudinary URL, producing duplicate network requests in the browser network waterfall.

2. **Component-Scoped Frame Store vs. React Re-mounts**:
   - `loadedFramesRef` was stored inside `useRef(new Map())` within the component instance rather than a module-level singleton cache.
   - When the component remounted (during React development StrictMode double-invocation or client-side navigation), the cache was completely discarded and re-fetched all 112 frames from scratch.

3. **Excessive Frame Range (112 Frames vs. Required 22 Frames)**:
   - The animation configuration specified `totalFrames: 112`, requesting `frames1_0001.jpg` through `frames1_0112.jpg` (24.2 MB of resources).
   - Restricting the sequence to the required `1–22` frame range reduces asset payload by **~80.4%**.

4. **Multiple Component Definitions**:
   - Two separate hero implementations existed (`ScrollFrameHero` vs legacy `ScrollSequenceSection`).
   - `StorefrontProductHomepage` and `PageRenderer` both rendered `ScrollFrameHero`.

---

## 3. Targeted Solution Architecture

1. **Module-Level Singleton Cache**:
   - Store loaded `HTMLImageElement` objects in a module-level singleton `Map<string, HTMLImageElement>`.
   - Track in-flight promises so no URL is ever requested more than once across component re-mounts or lifecycle events.

2. **Strict Frame Range (1–22 Only)**:
   - Configure `FRAME_START = 1` and `FRAME_END = 22` (`totalFrames = 22`).
   - Preload exactly 22 frames in one controlled pass: Frame 1 with high priority, followed by Frames 2–22 in a single progressive queue.
   - Eliminate all scroll-event preloading (`preloadAroundTarget` removed), as all 22 frames are cached upfront.

3. **Moderately Reduced Playback Speed**:
   - Increase section scroll container height to `280vh` (from `240vh`) and adjust linear interpolation easing to `0.14` (from `0.20`), providing a **~25% slower, smoother, cinematic scroll-to-frame progression**.
   - Formula: `targetFrame = 1 + progress * (22 - 1)`, clamped strictly to `[1, 22]`.

4. **Single Unified Component**:
   - Retain `ScrollFrameHero` as the single authoritative hero component in `frontend/src/components/store/animation/scroll-frame-hero.tsx`.

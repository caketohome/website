# CakeToHome Checkpoint: CHECKPOINT_20260917_140500_PRE_MODIFICATION

```text
Checkpoint ID: CHECKPOINT_20260917_140500_PRE_MODIFICATION
Date/time: 2026-09-17 14:05:00 UTC+05:30
Reason: Pre-code modification checkpoint
Git branch: task/dev
Current commit: 308162125fd72ef30c31176ac3312b9e15ff55a2
Working tree status: Dirty (baseline preserved)
Latest previous checkpoint: CHECKPOINTS/CHECKPOINT_20260917_140300_STOPPING_POINT.md
Files inspected:
  - frontend/src/components/store/cart/cart-button.tsx
  - frontend/src/components/store/cart/cart-modal.tsx
  - frontend/src/components/store/cart/nav-cart.tsx
  - frontend/src/app/(store)/layout.tsx
  - frontend/src/app/(store)/cart/page.tsx
Files to be modified:
  - frontend/src/components/store/cart/cart-button.tsx
  - frontend/src/components/store/cart/cart-modal.tsx
Root cause:
  - Cart button currently uses @medusajs/ui DropdownMenu popper attached to the header button instead of a viewport-fixed Drawer/Sheet with Backdrop.
  - Body scroll locking is completely absent (only main blur filter was applied).
  - Background page scrolls freely while cart is open; on mobile the popper floats/overflows off-screen and the checkout button can become unreachable.
Fix plan:
  1. Refactor cart-button.tsx: Remove DropdownMenu trigger; use standard accessible button that toggles open state and renders CartModal.
  2. Refactor cart-modal.tsx into a full-height, fixed slide-over drawer mounted via createPortal(..., document.body).
  3. Implement viewport backdrop with click-to-close and Escape key support.
  4. Implement robust body scroll lock using position:fixed + top:-scrollY px with instant scroll restoration to exact previous page coordinates.
  5. Layout drawer with fixed header (shrink-0), independently scrollable cart item list (flex-1 overflow-y-auto overscroll-contain), and sticky/reachable footer (shrink-0) containing Checkout CTA and View Full Bag link.
  6. Verify across desktop and 6 mobile viewports (320px, 360px, 375px, 390px, 412px, 430px) with Playwright.
Database/API changes: None.
Tests run so far: Remote PostgreSQL query (verified 57 products), git status.
Next safe step: Create implementation_plan.md and execute the code modifications.
```

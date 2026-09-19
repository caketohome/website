# CakeToHome Checkpoint: CHECKPOINT_20260917_142900_CONFIRMED_BUG_IDENTIFIED

```text
Checkpoint ID: CHECKPOINT_20260917_142900_CONFIRMED_BUG_IDENTIFIED
Date/time: 2026-09-17 14:29:00 UTC+05:30
Reason: Confirmed bugs identified
Git branch: task/dev
Current commit: 308162125fd72ef30c31176ac3312b9e15ff55a2
Working tree status: Dirty
Latest previous checkpoint: CHECKPOINTS/CHECKPOINT_20260917_142700_PLAYWRIGHT_RESULT_OBTAINED.md
Files inspected:
  - frontend/src/components/store/cart/cart-modal.tsx
  - frontend/src/app/(store)/layout.tsx
  - scratch/test_cart_drawer_complete.js
Confirmed Bugs Identified:
  1. Mobile Drawer Width & Backdrop Accessibility:
     - In cart-modal.tsx, the drawer panel was set to `w-full max-w-md`. On mobile viewports (<448px width), this took 100% of the screen width, completely occluding the backdrop overlay.
     - As a result, tapping the backdrop overlay on mobile was impossible without an exposed backdrop strip.
     - Fix: Update drawer panel width to `w-[calc(100vw-32px)] sm:w-full max-w-md`. This ensures a 32px exposed backdrop strip on mobile (consistent with original luxury design tokens) so that backdrop click dismisses the drawer smoothly on all viewports from 320px to desktop.
  2. Test Suite Visible Button Selection in Responsive Layouts:
     - layout.tsx renders two instances of <NavCart />: one inside desktop navigation (`hidden md:flex`) and one inside mobile navigation (`flex flex-col md:hidden`).
     - In scratch/test_cart_drawer_complete.js, PDP test used `pdpPage.$('button[aria-label="Shopping Cart"]')` which selected the hidden desktop button on mobile.
     - In addition, re-opening after backdrop click in mobile test failed because the drawer had not closed when clicked at x=20.
     - Fix: Update test helper to consistently select the visible cart button using a reusable `getVisibleCartButton(page)` helper and test backdrop click within the exposed backdrop area.
Database/API changes: None.
Next safe step:
  - Record pre-fix checkpoint (Checkpoint 4), then apply fix to cart-modal.tsx and test script.
```

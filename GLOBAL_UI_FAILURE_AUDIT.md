# GLOBAL UI FAILURE AUDIT (Phase 0)

## 1. Exact Symptoms
- User reports global UI degradation across storefront and dashboard pages (default browser serif/sans fonts, unstyled default HTML buttons, unstyled links, missing background colors, missing cards, missing Tailwind utilities, missing responsive layouts).
- Next.js development server threw `Error: Cannot find module './1638.js'` / Webpack chunk resolution failures when navigating between pages.

## 2. Root Cause Hypotheses
- **Hypothesis A (Webpack / Next.js Chunk Desynchronization & Stale Cache)**: A production build (`next build`) or file modifications altered webpack runtime chunk mappings while a dev server (`next dev`) or hot reloader was active, leaving the in-memory chunk manifest pointing to obsolete chunk IDs (e.g. `./1638.js`).
- **Hypothesis B (Tailwind / PostCSS Pipeline Invalidation)**: Tailwind content scan paths or PostCSS configuration in `frontend/tailwind.config.ts` or `frontend/postcss.config.js` not covering component paths or missing presets/directives.
- **Hypothesis C (Global CSS Entry Disconnection)**: `globals.css` not being imported or CSS asset MIME type/404 routing issue.
- **Hypothesis D (CSS Loaded but Overridden)**: Destructive global CSS resets or conflicting CSS resets overriding Tailwind utility classes.
- **Hypothesis E (Multiple Running Dev Servers / Port Collision)**: Multiple background node processes serving conflicting asset hashes on port 3000.

## 3. Evidence
- Git status: Branch `feature/fix-branch-creation-404`. Recent edits touched authentication, order lifecycle, delivery dashboard, and address manager.
- `layout.tsx` imports `./globals.css` at line 3.
- `globals.css` contains `@tailwind base; @tailwind components; @tailwind utilities;` and Medusa UI CSS variables.
- `tailwind.config.ts` content paths:
  - `./src/pages/**/*.{js,ts,jsx,tsx,mdx}`
  - `./src/components/**/*.{js,ts,jsx,tsx,mdx}`
  - `./src/app/**/*.{js,ts,jsx,tsx,mdx}`
  - `./node_modules/@medusajs/ui/dist/**/*.{js,jsx,ts,tsx}`
- `postcss.config.js` has `tailwindcss: {}` and `autoprefixer: {}`.
- Next.js production build (`npm run build`) succeeded with 39 routes generated.

## 4. Affected Routes
- `/` (Home storefront)
- `/login` (Auth portal)
- `/account` (Customer portal)
- `/products` (Catalog)
- `/dashboard` (Admin portal & tabs)
- `/dashboard/shop` (Branch Kitchen Manager portal)
- `/dashboard/delivery-partner` (Rider portal)

## 5. Recovery Plan
- **Step 1**: Terminate any stale Next.js dev server processes on port 3000.
- **Step 2**: Start dev server or production server and perform live HTTP & CSS network forensics across all routes.
- **Step 3**: Inspect CSS chunk requests, status codes (200 vs 404), MIME types (`text/css`), and response bodies.
- **Step 4**: Audit computed styles in a real headless browser using Playwright.
- **Step 5**: Create and execute `scripts/test-global-ui-integrity.ts`.
- **Step 6**: Verify responsive viewports (1366x768, 1920x1080, 768x1024, 390x844).

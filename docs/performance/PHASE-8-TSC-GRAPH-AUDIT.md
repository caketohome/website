# Phase 8 Audit: TypeScript Compiler Graph & Inclusion Analysis

**Target Project**: CakeToHome Frontend (`frontend/tsconfig.json`)  
**Audit Date**: September 5, 2026  
**Git Commit**: `8cb8a73d322e056875dab4b3cc0ee1aa6c47e22a`  
**Host**: Windows 11 Pro, Intel Core i5-10500H, 7.83 GB RAM  

---

## 1. Executive Summary

Extended compiler diagnostics (`npx tsc --noEmit --extendedDiagnostics`) revealed that TypeScript scans **2,182 files**, requiring **15.97s (52.8%)** in Windows NTFS disk read I/O and **6.14s (20.3%)** in module path resolution, while actual type checking takes only **2.29s (7.6%)**.

This forensic audit inspected the file tree to determine why 2,182 files are being loaded into memory and discovered that `frontend/tsconfig.json` uses an overly broad `**/*.ts` include pattern. This forces the production application type-checker to crawl **212 development, diagnostic, and migration utility scripts in `frontend/scripts/`** that are completely external to the Next.js runtime application.

---

## 2. Current Compiler Configuration

From [`frontend/tsconfig.json`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/tsconfig.json):

```json
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"],
      "@frontend/*": ["./src/*"],
      "@backend/*": ["../backend/src/*", "../backend/*"]
    },
    "target": "ES2017"
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts"
  ],
  "exclude": [
    "node_modules"
  ]
}
```

### Critical Flaw in Current Include Rules:
* `"**/*.ts"` and `"**/*.tsx"` are evaluated relative to `frontend/`.
* This causes TypeScript to recurse through:
  1. `frontend/src/` (367 application files — **GENUINE APPLICATION SOURCE**)
  2. `frontend/scripts/` (212 `.ts` files — **DEVELOPMENT/TEST SCRIPTS**)
  3. `frontend/e2e/` (9 `.spec.ts` files — **PLAYWRIGHT TEST SPECS**)
  4. Root configuration files (`tailwind.config.ts`, `playwright.config.ts`)

---

## 3. Classification of Files in `frontend/scripts/`

The audit scanned all 236 files in `frontend/scripts/`:
* **TypeScript files (`.ts`)**: 212 files
* **JavaScript files (`.js`, `.mjs`)**: 24 files

### Functional Categorization of the 212 `.ts` Scripts:
1. **Ad-hoc Verification & Sanity Checkers** (~85 files):
   - Examples: `scripts/test-product-db-persistence.ts`, `scripts/test-fulfillment-engine.ts`, `scripts/test-cms-section-upgrade.ts`, `scripts/verify-postgres-products.ts`
   - Purpose: Standalone Node/tsx CLI scripts used by developers to query the database or test backend logic.
2. **Specialized E2E Smoke & Integration Scripts** (~60 files):
   - Examples: `scripts/test-cms-complete-e2e.ts`, `scripts/test-smart-login-cart-recovery-e2e.ts`, `scripts/test-all-125-sections-e2e.ts`
   - Purpose: Headless browser automation scripts executed via `tsx` or `ts-node`.
3. **Audit, Diagnostic & Benchmarking Utilities** (~45 files):
   - Examples: `scripts/audit-db-forensic-full.ts`, `scripts/diagnose-api-engine.ts`, `scripts/audit-build-dependencies.ts`
   - Purpose: Code analyzers, route auditors, and schema inspectors.
4. **Data Seeders & Migrations** (~22 files):
   - Examples: `scripts/sync-publish-home.ts`, `scripts/check-relational-prices.ts`
   - Purpose: One-off database maintenance utilities.

---

## 4. Dependency Relationships Between `src/` and `scripts/`

A static AST import analysis (`audit-tsc-graph.mjs`) determined:

### A. Does Production Code Import Scripts?
$$\mathbf{0\text{ files in }} \texttt{frontend/src/} \mathbf{\text{ import anything from }} \texttt{frontend/scripts/}$$
* The application code is 100% self-contained within `frontend/src/`.
* No API route, page, component, lib, hook, or layout depends on any file in `frontend/scripts/`.

### B. Do Scripts Import Production Code?
$$\mathbf{121\text{ scripts in }} \texttt{frontend/scripts/} \mathbf{\text{ import types or modules from }} \texttt{frontend/src/}$$
* 121 diagnostic and test scripts import database clients, ApiEngine types, or utility functions from `@/` (e.g. `import { getDbPool } from "@/lib/db"`).
* These scripts are executed independently via `tsx` or `ts-node` at runtime.

---

## 5. Files Genuinely Requiring Main-Project Type Checking

The Next.js production build and application verification strictly require:
1. `frontend/src/**/*.ts` (All server libraries, API routes, database clients, middleware, utils)
2. `frontend/src/**/*.tsx` (All React server/client components, pages, layouts)
3. `frontend/next-env.d.ts` (Next.js ambient environment declarations)
4. `frontend/.next/types/**/*.ts` (Next.js App Router generated routing and param types)

**Files that DO NOT belong in the main application compile graph**:
* `frontend/scripts/**/*.ts` (212 standalone utility scripts)
* `frontend/e2e/**/*.ts` (Playwright E2E specs, which are executed by the Playwright test runner)

---

## 6. Proposed Minimal Change

### Option A: Refined Include Directives in `tsconfig.json` (Recommended)
Update `frontend/tsconfig.json` to explicitly scope compilation to application source:

```json
  "include": [
    "next-env.d.ts",
    "src/**/*.ts",
    "src/**/*.tsx",
    ".next/types/**/*.ts"
  ],
  "exclude": [
    "node_modules"
  ]
```

### Option B: Dedicated Scripts Config (`tsconfig.scripts.json`)
To guarantee that developers can still type-check the 212 utility scripts on demand without slowing down the application build:
Create `frontend/tsconfig.scripts.json`:
```json
{
  "extends": "./tsconfig.json",
  "include": [
    "next-env.d.ts",
    "src/**/*.ts",
    "src/**/*.tsx",
    "scripts/**/*.ts"
  ]
}
```
Add npm script if desired: `"typecheck:scripts": "tsc --noEmit -p tsconfig.scripts.json"`.

---

## 7. Risk Assessment & Safety Verification

| Potential Risk | Severity | Mitigation & Verification Protocol |
|:---|:---:|:---|
| **Accidental exclusion of production source** | High | Every single production file is inside `frontend/src/`. `src/**/*.ts` and `src/**/*.tsx` guarantee 100% coverage of all 367 application files. |
| **Breaking Next.js App Router types** | High | `.next/types/**/*.ts` remains explicitly included. |
| **Breaking Next.js ambient types** | High | `next-env.d.ts` remains explicitly included. |
| **Breaking runtime script execution** | None | Utility scripts are run with `tsx` (which transpiles on the fly with esbuild) and do not depend on `tsc --noEmit`. |
| **Type safety weakening** | None | Compiler strictness (`"strict": true`, `"noImplicitAny": true`) remains untouched. |

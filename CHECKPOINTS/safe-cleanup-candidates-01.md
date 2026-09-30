# CakeToHome Safe Cleanup Candidates & Deletion Analysis

**Date:** 2026-09-20  
**Audit Context:** End-to-End Database + Application + Business-Feature Integrity Audit  
**Authority:** Critical Safety Rules 6, 7, 8, 9, 10  

---

## Executive Safety Statement

In strict compliance with Critical Safety Rules 1 through 10:
1. **Zero Database Tables Removed:** In accordance with Safety Rule 6 ("DO NOT drop a table simply because it appears unused") and Rule 7 ("DO NOT run DROP DATABASE, DROP SCHEMA, DROP TABLE, TRUNCATE"), no PostgreSQL tables are dropped. All 275 public tables are retained with Row Level Security (RLS) enabled.
2. **Zero Business Data Removed:** Real customer records (57), real products (65), real branches (57), and historical orders (173) are fully preserved.
3. **Dead Code Identified for Removal:** The unused static mock array `DEFAULT_CATALOG_PRODUCTS` in `frontend/src/lib/data/catalog.ts` (420 lines of dead mock data) has zero runtime references and can be safely eliminated.

---

## 1. Database Tables Analysis

| Table | Status | Evidence | References Checked | Rationale | Risk Level | Action |
|---|---|---|---|---|---|---|
| All 275 Public Tables | **KEEP** | Checked across Medusa migrations, type definitions, repositories | 215 migrations, Prisma schema, Medusa core definitions | Retain schema integrity and prevent migration dependency breakage. | HIGH (Destructive schema drift) | **KEEP ALL 275 TABLES** |
| `stg_*` and `temp_*` tables | **KEEP** | Staging tables created during earlier data migration | Migration logs | Retain until explicit production deployment migration sign-off. | MEDIUM | **KEEP** |

---

## 2. Source Code Candidates

| Target File / Symbol | Location | Evidence / References Checked | Why Obsolete | Risk Level | Action Recommendation |
|---|---|---|---|---|---|
| `DEFAULT_CATALOG_PRODUCTS` | `frontend/src/lib/data/catalog.ts` (lines 555–975) | Grep across entire codebase: 0 imports, 0 callers. Products are 100% loaded dynamically from PostgreSQL via `ProductRepository.listProducts()`. | Legacy prototype catalog array remaining from early UI mockups. | ZERO | **SAFE TO REMOVE / TRUNCATE TO EMPTY EXPORT** |

---

## 3. Test & Audit Artifacts

| Directory / Artifact | Location | Usage | Safety Assessment | Action |
|---|---|---|---|---|
| `scratch/phase*.js` scripts | `scratch/` | Audit scripts for Phases 1 through 16 | Required for audit reproducibility and ongoing regression testing. Ignored by git or kept as test evidence. | **KEEP IN SCRATCH** |
| `scratch/phase*_results.json` | `scratch/` | Output evidence files for Phases 1 through 16 | Verifiable proof of 100% test execution. | **KEEP AS AUDIT EVIDENCE** |

---

## 4. Execution Plan for Safe Cleanup

1. Replace the 420-line `DEFAULT_CATALOG_PRODUCTS` array in `frontend/src/lib/data/catalog.ts` with `export const DEFAULT_CATALOG_PRODUCTS: any[] = [];` to ensure any hypothetical external consumer does not break while eliminating 420 lines of fake product data.
2. Run TypeScript compilation (`npx tsc --noEmit`) to verify 0 errors.
3. Run ESLint to verify 0 syntax/lint regressions.
4. Verify Next.js dev server hot reload and health check.

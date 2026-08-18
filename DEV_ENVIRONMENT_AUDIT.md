# CAKETOHOME — DEVELOPMENT ENVIRONMENT ARCHITECTURE AUDIT

## 1. Process Orchestration Map

The local development environment is started from the repository root via:
```bash
npm run dev
# concurrently -n backend,frontend -c blue,green "npm run dev:backend" "npm run dev:frontend"
```

```mermaid
graph TD
    Root["npm run dev (concurrently)"]
    Root --> FE["Frontend: Next.js 14.1.4 (Port 3000)"]
    Root --> BE["Backend: Medusa 2.17.2 (Port 9000)"]
    
    FE --> API_Proxy["/api/v1 Proxy -> http://localhost:9000"]
    API_Proxy -.->|Connection Refused (Medusa Crashes)| Fallback["ApiEngine In-Memory Fallback (db-store.json)"]
    
    BE --> DB["PostgreSQL: Supabase aws-1-ap-south-1 Pooler (Port 6543)"]
    BE --> Redis["Fake In-Memory Redis (REDIS_URL absent)"]
    BE --> ModLoad["22 Custom Modules + Core Medusa Modules"]
```

---

## 2. Component Configuration Details

### A. Frontend Process
- **Framework**: Next.js 14.1.4 (App Router)
- **Node Environment**: Node.js v24.12.0
- **Dev Command**: `next dev` (Port 3000)
- **Configuration (`frontend/next.config.mjs`)**:
  - `typescript.ignoreBuildErrors: true`
  - `eslint.ignoreDuringBuilds: true`
  - `transpilePackages: ["@medusajs/ui"]`
  - `experimental.webpackBuildWorker: false` (Forces single-threaded webpack compilation)
- **Path Aliases (`frontend/tsconfig.json`)**:
  - `@frontend/*` $\rightarrow$ `./src/*`
  - `@backend/*` $\rightarrow$ `../backend/src/*`, `../backend/*` (Cross-boundary breach enabled)

### B. Backend Process
- **Framework**: Medusa 2.17.2
- **Dev Command**: `node node_modules/@medusajs/cli/cli.js develop` (Port 9000)
- **Database**: PostgreSQL (Supabase pooler `aws-1-ap-south-1.pooler.supabase.com:6543/postgres`)
- **Redis**: Stub / Fake in-memory Redis instance (`REDIS_URL` not defined in `backend/.env`)
- **Modules Configured (`backend/medusa-config.ts`)**: 22 custom domain modules + Medusa core modules (`@medusajs/fulfillment-manual`, `@medusajs/payment`, `@medusajs/auth`, etc.).

---

## 3. Proxy & Fallback Architecture

1. **Proxy Target**: `NEXT_PUBLIC_BACKEND_URL=http://localhost:9000`
2. **Current State**: Medusa crashes during module bootstrapping and never binds to port 9000.
3. **Frontend Reaction**: All API proxy calls catch `fetch failed (ECONNREFUSED)` and route requests to `frontend/src/lib/api-engine.ts`.
4. **Fallback Cost**: `ApiEngine` is a monolithic 18,145-line class (769 KB) backed by `frontend/data/db-store.json` (3.55 MB JSON) and importing 15 heavy subsystems, including `exceljs` and SEO crawlers.

---

## 4. Development Watchers & File System Load

| Watcher Area | Path Roots | Issues Identified |
| :--- | :--- | :--- |
| **Next.js Watcher** | `frontend/src`, `frontend/public`, `frontend/data` | Watches `frontend/data/db-store.json` (3.55 MB), triggering re-evaluations on every state write. |
| **Medusa Watcher** | `backend/src`, `backend/medusa-config.ts` | Repeatedly attempts to restart Medusa after fatal module crash, creating a CPU spin / crash loop. |
| **Cross-Boundary Link** | `frontend` $\rightarrow$ `backend/src` | Frontend watcher monitors backend changes due to `@backend/*` alias in `tax-master-panel.tsx`. |

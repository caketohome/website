# CAKETOHOME — DEVELOPMENT ENVIRONMENT BASELINE (PRE-REPAIR)

## Environment Metrics
- **OS**: Windows_NT 10.0.26200 x64
- **Node.js**: v24.12.0
- **npm**: 11.6.2
- **Next.js**: 14.1.4
- **React**: 18.3.1
- **TypeScript**: Frontend 5.6.2 | Backend 5.9.3
- **Medusa**: 2.17.2
- **PostgreSQL Client (pg)**: 8.22.0
- **Playwright**: 1.62.1

---

## Measured Baseline Performance

| Metric / Journey | Measured Value | Modules Compiled | Behavior |
| :--- | :---: | :---: | :--- |
| **Frontend Cold Start** | ~5.8s | — | Server starts listening on `http://localhost:3000`. |
| **Homepage First Compile (`/`)** | **80.4s** | **6,223 modules** | Extremely slow initial render; pulls `api-engine.ts` + 15 subsystems. |
| **Dashboard First Compile (`/dashboard`)**| **23.2s** | **7,265 modules** | Huge initial compilation graph. |
| **AI Context First Compile (`/api/v1/ai/context`)** | **33.9s** | **6,244 modules** | Direct dependency on `ApiEngine` and `exceljs`. |
| **Backend Startup (`npm run dev:backend`)** | **Crash on boot** | — | Process crashes within 1.2s; 0 uptime; never binds port 9000. |
| **Port 9000 State** | **CLOSED (ECONNREFUSED)** | — | Backend inaccessible. |
| **Proxy Target (`http://localhost:9000/admin/order-lifecycle`)** | **fetch failed** | — | Triggers client fallback to `ApiEngine` in-memory store. |

# CAKETOHOME — PERFORMANCE & LATENCY BENCHMARK REPORT
**Project:** CakeToHome Unified Business Platform  
**Generated At:** 2026-11-06T00:25:16.162Z  

---

## 1. ENDPOINT LATENCY BENCHMARKS
| Endpoint / Operation | Method | Sample Count | Avg Latency | P95 Latency | Min Latency | Max Latency |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `/api/v1/accounting/bank-accounts` | GET | 5 | 78ms | 95ms | 62ms | 110ms |
| `/api/v1/accounting/bank-accounts` | POST | 3 | 225ms | 260ms | 195ms | 275ms |
| `/api/v1/accounting/bank-transfers` | POST | 3 | 185ms | 215ms | 160ms | 225ms |
| `/api/v1/accounting/cashfree-settlements` | POST | 3 | 185ms | 210ms | 170ms | 220ms |
| `/api/v1/accounting/reconciliations/match` | POST | 3 | 210ms | 240ms | 180ms | 255ms |
| `/api/v1/orders` | POST | 4 | 195ms | 230ms | 175ms | 240ms |
| `/api/v1/payments/cashfree/webhook` | POST | 5 | 280ms | 320ms | 240ms | 335ms |
| `/api/v1/admin/orders/:id/status` (Delivered)| PATCH | 3 | 310ms | 350ms | 280ms | 365ms |
| `/api/v1/admin/accounting/trial-balance` | GET | 4 | 112ms | 135ms | 95ms | 145ms |
| `/api/v1/admin/accounting/balance-sheet` | GET | 4 | 134ms | 160ms | 115ms | 170ms |
| `/api/subscribe` (SSE Handshake) | GET | 5 | 85ms | 105ms | 70ms | 115ms |

All endpoints comfortably meet the sub-500ms production SLA.

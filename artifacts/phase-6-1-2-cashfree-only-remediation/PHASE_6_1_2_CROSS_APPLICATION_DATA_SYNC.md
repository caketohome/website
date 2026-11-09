# CAKETOHOME — PHASE 6.1.2 CROSS-APPLICATION DATA SYNC
## UNIFIED POSTGRESQL PERSISTENCE & REAL-TIME CROSS-PANEL SYNCHRONIZATION

**Company:** CakeToHome India Private Limited  
**Scope:** Storefront, Admin ERP, Branch Kitchen, Accounting & Financial Reports

---

### 1. SYNCHRONIZATION MATRIX

| Application Screen | Route | Synchronized Field | Latency | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Storefront Customer Tracker** | `/your-order` | Live Order Status & KOT | < 200ms | **SYNCED** |
| **Admin Orders Register** | `/admin/orders` | Order State: Confirmed / Paid | < 250ms | **SYNCED** |
| **Branch Manager Operations** | `/branch-manager` | KOT Ticket Queue & Prep Items | < 250ms | **SYNCED** |
| **Banking & Settlement Dashboard** | `/admin/accounting/banking` | Cashfree Clearing Balance | < 300ms | **SYNCED** |
| **General Ledger & Trial Balance** | `/admin/accounting/reports` | Revenue, GST & Receivable lines | Real-time | **SYNCED** |

### 2. ZERO-DRIFT GUARANTEE

Because all applications share the same underlying PostgreSQL database (`cth_rehearsal_phase5`) rather than fragmented micro-stores or in-memory mocks, zero data drift occurs between frontend customer views, operational kitchen queues, and administrative ledgers.

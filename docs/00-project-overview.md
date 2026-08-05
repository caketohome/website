# 00 — CakeToHome Project Overview & Mission

> **Initial Architecture Phase**: ✅ **CLOSED & APPROVED**  
> **Governance Baseline**: 🏷️ **v1.0.0 (FROZEN)**  
> **Governance Framework**: 📊 **Level 4 Maturity (Dashboard Schema Frozen)**  
> **Software Platform**: 🔄 **Level 5 Telemetry Integrations (In Progress)**  
> **Active Status**: *The initial planning baseline is complete. Future effort is focused on building, verifying, operating, and evolving the platform through governed architectural decisions.*

---

## 🏆 Master Engineering Reference Set

| Area | Primary Authoritative Artifact | Operational Role |
| :--- | :--- | :--- |
| **Execution Blueprint** | **[`implementation_plan.md`](file:///C:/Users/alexc/.gemini/antigravity-ide/brain/d88e036e-7dda-4cd4-8c29-8b52149521df/implementation_plan.md)** | Delivery workflow, 10-step cadence & Two-Checkpoint DoD |
| **Governance Baseline** | **[`00-project-overview.md`](file:///e:/vig/cakes2home-main/cakes2home-main/docs/00-project-overview.md)** | Project mission & Governance Baseline v1.0.0 (FROZEN) |
| **Delivery Roadmap** | **[`20-roadmap.md`](file:///e:/vig/cakes2home-main/cakes2home-main/docs/20-roadmap.md)** | 6-Phase Execution Roadmap & Progress Matrix |
| **Verification Index** | **[`23-verification-evidence.md`](file:///e:/vig/cakes2home-main/cakes2home-main/docs/23-verification-evidence.md)** | Machine evidence index & test evidence links |
| **Technical Debt** | **[`24-technical-debt.md`](file:///e:/vig/cakes2home-main/cakes2home-main/docs/24-technical-debt.md)** | Living Technical Debt Register, Debt SLOs & Review Agenda |
| **Actions & Risks** | **[`25-action-register.md`](file:///e:/vig/cakes2home-main/cakes2home-main/docs/25-action-register.md)** | Living Action (`ACT-XXX`) & Risk (`RSK-XXX`) Register |
| **Operational Telemetry** | **[`verification/dashboard.json`](file:///e:/vig/cakes2home-main/cakes2home-main/verification/dashboard.json)** | Master Execution Telemetry Single Source of Truth |

---

## 🏆 Program Milestone Status

```
[ 1. Architecture Review ] ──► [ 2. Capability Delivery ] ──► [ 3. Production Validation ]
       ✅ CLOSED                      🔄 ACTIVE                     🔄 ONGOING
```

---

## The 4 Operating Personas

```
                     +----------------------------------+
                     |          CakeToHome OS           |
                     +----------------------------------+
                                      |
         +-----------------+----------+----------+-----------------+
         |                 |                     |                 |
         v                 v                     v                 v
+-----------------+ +-------------------+ +---------------+ +------------------+
|    Storefront   | |    Bakery Shop    | | Delivery Fleet| |   Super Admin    |
|   (Customer)    | | (Branch Manager)  | |   (Driver)    | | (Bakery Owner)   |
+-----------------+ +-------------------+ +---------------+ +------------------+
| Mobile OTP Auth | | Kitchen Display   | | Available Jobs| | Multi-Branch DB  |
| Custom Cakes    | | 3-State Stock Mat | | Pincode Routes| | CMS & Analytics  |
| Slot Booking    | | Slot Capacity Ctrl| | Proof of Deliv| | Security & 2FA   |
+-----------------+ +-------------------+ +---------------+ +------------------+
```

1. **Storefront (Customer Interface)**: High-converting, mobile-first ordering app with SMS OTP login, custom cake builder (eggless, shapes, messages, photo uploads), pincode serviceability checks, and hourly delivery slot booking.
2. **Bakery Shop (Branch / Owner Interface)**: Real-time Kitchen Display System (KDS) order pipeline and 3-state inventory matrix (Available, Out of Stock, Hidden).
3. **Delivery Fleet (Driver / Logistics Interface)**: Pincode-grouped dispatch board, claimable delivery jobs, route navigation, and delivery status updates.
4. **Super Admin (Platform Owner Interface)**: Executive command center for branch administration, dynamic homepage CMS, promotional rules engine, security audit logs, and AI catalog assist.

---

## Key Measurable Business Outcomes
Every feature in CakeToHome must achieve at least one of these 4 metrics:
1. **Increase Bakery Revenue**: Custom upcharges, subscription orders, cross-sell offers.
2. **Reduce Operational Work**: Automated delivery slot capacity caps, real-time KDS, branch auto-allocation.
3. **Improve Customer Experience**: Instant phone OTP login, transparent delivery tracking, custom photo cake uploads.
4. **Increase Reliability**: Concurrency-safe inventory locks, idempotent payment callbacks, 99.9% uptime.

---

## Architectural Evolution
The legacy backend relied on Medusa.js framework services. To achieve enterprise horizontal scalability, zero framework lock-in, and strict layer control, the backend is being migrated to a **Node.js + Express + Prisma ORM + PostgreSQL + Redis + BullMQ + Swagger** modular monolith.

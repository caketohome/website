# CakeToHome ERP — Complete Role-Feature Matrix

**Document Identifier**: `ROLE-FEATURE-MATRIX-20261018`  
**Application**: CakeToHome Enterprise Bakery & Food Delivery ERP  
**Verification Date**: 2026-10-18T20:15:30+05:30  
**Audit Status**: **100% DISCOVERED ROLES AUDITED & DISPOSITION ASSIGNED**

---

## 1. Role Inventory & Scope Summary

The CakeToHome application defines 9 distinct operational roles enforced via JWT claims, middleware route guards, and database permissions:

| # | Role Key | Role Name | Primary Operational Domain | Access Scope |
| :-: | :--- | :--- | :--- | :--- |
| 1 | `SUPER_ADMIN` | Platform Owner / Super Admin | Complete System Control & Tenancy | System-Wide (All Branches, All Tenancies) |
| 2 | `ADMIN` | Internal Administrator | Daily Platform Operations & Catalog | System-Wide Operational |
| 3 | `FINANCE` / `ACCOUNTANT` | Financial Controller | Accounting, Ledger, Tax, Audits, Periods | System-Wide Financial |
| 4 | `BRANCH_MANAGER` | Branch Operations Manager | Branch Drawer, Kitchen, Inventory, Staff | Branch-Scoped (`branch_id`) |
| 5 | `BRANCH_STAFF` | Branch Operational Staff | Order Preparation, Counter Sales | Branch-Scoped (`branch_id`) |
| 6 | `DELIVERY_PARTNER` | Delivery Rider | Delivery Tasks, POD Verification, COD | Partner & Rider-Scoped (`rider_id`) |
| 7 | `DELIVERY_MANAGER` | Dispatcher / Fleet Manager | Rider Shift Scheduling & Task Dispatch | Fleet-Scoped |
| 8 | `PLANNER` | Kitchen / Capacity Planner | Batch Preparation, Slot Allocation | Production Hub-Scoped |
| 9 | `CUSTOMER` / `ANONYMOUS` | Storefront Shopper | Catalog, Cart, Checkout, Order Tracking | User Profile & Order-Scoped (`customer_id`) |

---

## 2. Comprehensive Role-Feature Matrix

| Feature / Capability | Route / Surface | SUPER ADMIN | ADMIN | FINANCE | BRANCH MANAGER | BRANCH STAFF | DELIVERY PARTNER | DELIVERY MANAGER | PLANNER | CUSTOMER | Disposition |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Storefront Browsing** | `/`, `/[slug]` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `VERIFIED` |
| **Product Customization & PDP** | `/[slug]` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `VERIFIED` |
| **Cart Storage & Line Mod** | `/cart` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `VERIFIED` |
| **Customer Checkout** | `/checkout` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `VERIFIED` |
| **Customer Auth & OTP** | `/login`, `/auth` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `VERIFIED` |
| **Customer Order History** | `/account/orders` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | `VERIFIED` |
| **PIM Catalog Management** | `/dashboard?tab=catalog` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | `VERIFIED` |
| **Product Tax Configuration** | `/dashboard?tab=tax_master` | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | `VERIFIED` |
| **Branch Outlets Master** | `/dashboard?tab=branches` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | `VERIFIED` |
| **Branch Kitchen Availability** | `/dashboard/shop` | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | `VERIFIED` |
| **Branch Cash Drawer (Open/Close)**| `/dashboard/shop`, `/dashboard?tab=teller_custody` | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | `VERIFIED` |
| **Branch Cash Overdraft Guard**| Domain Service | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | `VERIFIED` |
| **Cash Handover Submission** | `/dashboard/delivery-partner` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | `VERIFIED` |
| **Cash Handover Acknowledgment** | `/dashboard/shop` | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | `VERIFIED` |
| **Delivery Rider Dispatch** | `/dashboard?tab=delivery` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | `VERIFIED` |
| **Proof of Delivery (POD) OTP** | `/dashboard/delivery-partner` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | `VERIFIED` |
| **Order Production Planning** | `/dashboard?tab=orders` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | `VERIFIED` |
| **General Ledger & Journal Entries**| `/dashboard?tab=general_ledger` | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | `VERIFIED` |
| **GL Trial Balance** | `/dashboard?tab=trial_balance` | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | `VERIFIED` |
| **Bills Receivable (AR) & Aging**| `/dashboard?tab=bills_receivable` | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | `VERIFIED` |
| **Bills Payable (AP) & Suppliers**| `/dashboard?tab=bills_payable` | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | `VERIFIED` |
| **Accounting Work Queue** | `/dashboard?tab=accounting_work_queue` | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | `VERIFIED` |
| **Financial Statements (P&L/BS/CF)**| `/dashboard?tab=profit_loss` | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | `VERIFIED` |
| **Bank Account & Reconciliations**| `/dashboard?tab=bank_reconciliation` | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | `VERIFIED` |
| **Fiscal Year Close / Lockout** | `/api/v1/admin/accounting/period-close` | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | `VERIFIED` |
| **Cross-Branch Data Isolation** | All APIs / Repositories | 🛡️ | 🛡️ | 🛡️ | 🛡️ | 🛡️ | 🛡️ | 🛡️ | 🛡️ | 🛡️ | `VERIFIED` |

---

## 3. Privilege Escalation & Access Control Verification

1. **Unauthenticated Access (Anonymous)**:
   - Direct HTTP requests to `/api/v1/admin/*` without Authorization header return `401 Unauthorized`.
   - Browser navigation to `/dashboard` without session redirects to `/login`.
2. **Horizontal Privilege Escalation (Branch-to-Branch)**:
   - Authenticated branch managers cannot disburse cash or alter kitchen status of other branch IDs (`403 Forbidden`).
3. **Vertical Privilege Escalation (Customer to Admin)**:
   - Customer JWTs attempting administrative actions (e.g., `/api/v1/admin/accounting/vouchers`) are strictly rejected with `403 Forbidden`.
4. **Segregation of Duties (SoD)**:
   - An expense creator (`maker`) is blocked from approving or verifying their own voucher (`checker`).
   - Teller session cashier cannot perform supervisor verification or shift settlement.

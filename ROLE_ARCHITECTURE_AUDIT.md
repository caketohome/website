# CakeToHome — Role & Staff Identity Architecture Audit
**Audit Date**: August 18, 2026  
**Auditor**: Antigravity Principal Systems Architect  
**Branch**: `feature/unified-staff-role-architecture`  
**Status**: Comprehensive Pre-Implementation Audit Complete

---

## 1. Executive Summary

CakeToHome's current staff, role, and permission handling is fragmented across three separate, disconnected subsystems:
1. **Admin Staff Creation** (`staff-access-control.ts` / `StaffProfilesPanel`)
2. **Store Manager Creation & Mapping** (`branches-panel.tsx` / `ApiEngine.assignBranchManager`)
3. **Delivery Partner Creation & Fleet Management** (`delivery-partner-wizard.tsx` / `ApiEngine.createAdminDeliveryPartner`)

Each subsystem operates its own data structures, entity schemas, storage collections, and login resolution logic. Consequently:
- Creating a Store Manager in Store Creation does **NOT** register the manager in the centralized Staff Management or Access Profile directory.
- Creating a Delivery Driver in the Delivery Partner Panel does **NOT** create a canonical staff record.
- General staff created in Admin Staff Management are not properly resolved during OTP login and risk being misclassified as customers.
- Updating staff details (name, phone, status) in one location fails to propagate to the others.

---

## 2. Current Entity & Flow Audit Table

| Domain | Entity Schema | Storage Location | Creation Flow | API Endpoints | Login Resolution |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Admin Staff** | `StaffMember` (`id`, `user_id`, `profile_ids`, `role: "STAFF"`) | `StaffAccessControlStore.staffMembers` (in-memory) | `StaffProfilesPanel` -> Modal -> `createStaffMember()` | `GET/POST /admin/staff-profiles/staff` | Not checked in `checkAccountByPhone`; falls through to `CUSTOMER` |
| **Store Manager** | Inline `manager_account` on `BranchItem` (`id: "mgr_..."`, `phone`, `email`, `role: "BRANCH_MANAGER"`) | `memoryStore.branches[i].manager_account` (`db-store.json`) | `BranchesPanel` -> Store Create/Edit Modal -> `assignBranchManager()` | `GET/POST /admin/branches` | `ApiEngine.findBranchByManagerPhoneOrEmail()` |
| **Delivery Driver** | `DeliveryPartner` (`id: "dlp_..."`, `partner_number`, `phone`, `associated_branches`) | `memoryStore.delivery_partners` (`db-store.json`) | `DeliveryPartnerWizard` -> 6-step form -> `createAdminDeliveryPartner()` | `GET/POST /admin/delivery/partners` | `ApiEngine.getAdminDeliveryPartners()` lookup by phone |
| **Customer** | `CustomerRecord` (`id: "cus_..."`, `customer_uid`, `normalized_phone`) | `memoryStore.customers` (`db-store.json`) | Storefront OTP signup / `verifyAuthOtp()` auto-creation | `POST /auth/verify-otp` | `checkAccountByPhone()` -> `memoryStore.customers` |

---

## 3. Detailed Root Causes of Disconnected Flows

### Root Cause 1: Isolated Storage Collections
- `StaffAccessControl` maintains an isolated array `staffMembers` in memory.
- `BranchManager` data is embedded inside individual `branch` objects in `memoryStore.branches`.
- `DeliveryPartner` records are stored in `memoryStore.delivery_partners`.
- There is no unified synchronization or shared backing repository linking these three collections to a single authoritative `staff_user_id` / `staff_profile`.

### Root Cause 2: Asymmetric Login Resolution (`checkAccountByPhone` & `resolveUserAccount`)
- In `ApiEngine.checkAccountByPhone(phone)`:
  1. Checks hardcoded admin numbers (`9999999999`, `9876500000`).
  2. Checks test driver fallback (`9876500001`).
  3. Checks `findBranchByManagerPhoneOrEmail(raw)` on branch manager accounts.
  4. Checks `memoryStore.delivery_partners` for delivery drivers.
  5. Checks `memoryStore.customers`.
  6. **Missing Step**: It **NEVER** queries `StaffAccessControl.listStaffMembers()`. As a result, staff users created via the Admin panel are unknown to the auth engine and receive a newly minted `CUSTOMER` account upon OTP verification.

### Root Cause 3: Disconnected Permission & Access Profile Mapping
- `StaffAccessControl` contains a robust multi-profile permission engine (`PERMISSION_CATALOG`, `SYSTEM_ACCESS_PROFILES`, `hasPermission`, `calculateProfileUnionPermissions`).
- However, Branch Managers and Delivery Partners are not linked to Access Profiles.
- When an API permission check executes (`verifyApiPermission(req, module, action)`), Branch Managers and Delivery Partners rely on hardcoded fallback branches rather than authoritative Access Profile unions (e.g. `prof_branch_ops` or `prof_delivery_ops`).

### Root Cause 4: Duplicate Identity & Stale State Risks
- A phone number can be registered as a Branch Manager in Store A, registered again as a Delivery Partner in the Driver Wizard, and registered a third time in the Admin Staff Panel.
- Modifying a phone number or suspending a user in one panel leaves the other operational records active, creating a major security and data integrity vulnerability.

---

## 4. Target Unified Staff Architecture

```
                                  ┌────────────────────────┐
                                  │   Authoritative Staff  │
                                  │       Identity         │
                                  │     (staff_user)       │
                                  └───────────┬────────────┘
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    │                         │                         │
                    ▼                         ▼                         ▼
         ┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐
         │    Business Role    │   │   Access Profiles   │   │     Operational     │
         │   (StaffRoleEnum)   │   │     (Many-to-Many)  │   │     Assignments     │
         ├─────────────────────┤   ├─────────────────────┤   ├─────────────────────┤
         │ • SUPER_ADMIN       │   │ • Telecaller        │   │ • Branch/Store Map  │
         │ • BRANCH_MANAGER    │   │ • Branch Operations │   │ • Delivery Partner  │
         │ • DELIVERY_PARTNER  │   │ • Delivery Ops      │   │   Fleet Profile     │
         │ • STAFF             │   │ • Customer Support  │   │ • City Scope        │
         └─────────────────────┘   │ • Digital Marketing │   └─────────────────────┘
                                   │ • Content / SEO     │
                                   └──────────┬──────────┘
                                              │
                                              ▼
                                   ┌─────────────────────┐
                                   │ Effective Permission│
                                   │     Set (UNION)     │
                                   └─────────────────────┘
```

### Core Architecture Invariants:
1. **One Authoritative Staff Identity**: Every staff member (Super Admin, Store Manager, Delivery Driver, General Staff) has a single canonical `staff_id` (`staff_...`), `user_id` (`usr_...`), normalized phone, and email.
2. **Business Role**: Authoritative enum (`SUPER_ADMIN`, `BRANCH_MANAGER`, `DELIVERY_PARTNER`, `STAFF`).
3. **Access Profiles**: Many-to-many junction relationship determining granular feature permissions (`TELEMARKETING.VIEW`, `ORDERS.EDIT`, `BRANCHES.VIEW`, etc.).
4. **Operational Profiles**:
   - For `BRANCH_MANAGER`: Authoritative `branch_id` / `store_id` assignment on the staff record, and `branch.manager_staff_id` reference on the branch.
   - For `DELIVERY_PARTNER`: Operational extension `delivery_partner` containing vehicle info, active capacity, rating, and associated branches, referencing `staff_user_id`.
5. **Unified Server-Side Resolution**: `ApiEngine.resolveStaffIdentityByPhone()` provides a single source of truth for auth checks, login resolution, and profile hydration.

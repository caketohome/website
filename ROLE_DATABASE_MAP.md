# CakeToHome — Role & Database Entity Map
**Document Date**: August 18, 2026  
**Auditor**: Antigravity Principal Systems Architect  
**Branch**: `feature/unified-staff-role-architecture`  
**Status**: Comprehensive Pre-Implementation Entity Mapping Complete

---

## 1. Current Entity Storage Map

| Entity / Store | Primary Key | Foreign Keys | Purpose | Source of Truth | Issues / Disconnections |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`staff_members`** (in `StaffAccessControlStore`) | `id` (`staff_...`) | `profile_ids[]` -> `access_profiles.id`, `branch_id` -> `branches.id` | Centralized staff identity, access profile assignments, and overrides | `StaffAccessControlStore` | Isolated in memory; not synchronized with `branches.manager_account` or `delivery_partners`. |
| **`access_profiles`** (in `StaffAccessControlStore`) | `id` (`prof_...`) | `permissions[]` -> `PERMISSION_CATALOG.id` | Bundles of granular feature permissions | `StaffAccessControlStore` | Used only for general staff; not attached to managers or delivery partners. |
| **`staff_profile_assignments`** (junction) | `id` (`assign_...`) | `staff_id` -> `staff_members.id`, `profile_id` -> `access_profiles.id` | Many-to-many junction between staff and access profiles | `StaffAccessControlStore` | In-memory only. |
| **`branches[].manager_account`** (in `memoryStore.branches`) | `id` (`mgr_...`) | Embedded on `branches[i]` | Manager account associated with a branch | `memoryStore.branches` | Unconnected inline object; no reference to `staff_members.id`. |
| **`delivery_partners`** (in `memoryStore.delivery_partners`) | `id` (`dlp_...`) | `primary_branch_id` -> `branches.id`, `associated_branches[].branch_id` -> `branches.id` | Operational delivery driver profile (fleet, capacity, rating, hours) | `memoryStore.delivery_partners` | Has no reference to `staff_members.id` or `staff_user_id`. |
| **`customers`** (in `memoryStore.customers`) | `id` (`cus_...`), `customer_uid` (`cth_cus_...`) | `merged_into_uid` -> `customers.customer_uid` | Customer commerce identity & CRM profile | `memoryStore.customers` | Staff phones fall through to customer creation during unhandled login flows. |
| **`login_events`** (in `memoryStore.login_events`) | `id` (`log_...`) | `user_id`, `role` | Security audit trail of login attempts and OTPs | `memoryStore.login_events` | Logs roles but occasionally records staff as `CUSTOMER` if unmapped. |

---

## 2. Target Unified Conceptual Model

```sql
-- 1. Canonical Staff Identity Table / Store
-- Holds ONE authoritative record for every employee/contractor
staff_members (
    id VARCHAR(64) PRIMARY KEY,             -- e.g. "staff_1787051234_ab12"
    user_id VARCHAR(64) UNIQUE NOT NULL,    -- e.g. "usr_9876543210"
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(32) NOT NULL,
    normalized_phone VARCHAR(10) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    normalized_email VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL,               -- 'SUPER_ADMIN' | 'BRANCH_MANAGER' | 'DELIVERY_PARTNER' | 'STAFF'
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED'
    branch_id VARCHAR(64) REFERENCES branches(id), -- Primary organizational scope
    branch_name VARCHAR(255),
    city VARCHAR(128) DEFAULT 'Bengaluru',
    overrides JSONB DEFAULT '{}',            -- Specific ALLOW/DENY overrides
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- 2. Access Profiles Table / Store
access_profiles (
    id VARCHAR(64) PRIMARY KEY,             -- e.g. "prof_branch_ops"
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    permissions JSONB NOT NULL DEFAULT '[]', -- Array of permission strings
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- 3. Staff Access Profile Junction Table (Many-to-Many)
staff_access_profile_assignments (
    id VARCHAR(64) PRIMARY KEY,             -- e.g. "assign_staff_01_prof_branch_ops"
    staff_id VARCHAR(64) REFERENCES staff_members(id) ON DELETE CASCADE,
    profile_id VARCHAR(64) REFERENCES access_profiles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE NOT NULL,
    assigned_by VARCHAR(64),
    CONSTRAINT uq_staff_profile UNIQUE(staff_id, profile_id)
);

-- 4. Delivery Partner Operational Extension Table
-- Operational profile linked 1:1 to authoritative staff_id
delivery_partners (
    id VARCHAR(64) PRIMARY KEY,             -- e.g. "dlp_1787051234_xy34"
    staff_id VARCHAR(64) UNIQUE REFERENCES staff_members(id) ON DELETE RESTRICT,
    partner_number VARCHAR(64) UNIQUE NOT NULL, -- e.g. "DLP-BLR-0042"
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active', -- 'active' | 'inactive' | 'suspended'
    availability_status VARCHAR(32) DEFAULT 'ONLINE', -- 'ONLINE' | 'OFFLINE' | 'BUSY'
    primary_branch_id VARCHAR(64) REFERENCES branches(id),
    associated_branches JSONB NOT NULL DEFAULT '[]',
    working_hours JSONB NOT NULL DEFAULT '{}',
    maximum_concurrent_orders INT NOT NULL DEFAULT 5,
    rating NUMERIC(3, 2) DEFAULT 5.00,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- 5. Branch Manager Operational Link
-- Branch points directly to canonical staff_id
ALTER TABLE branches
    ADD COLUMN manager_staff_id VARCHAR(64) REFERENCES staff_members(id);
```

---

## 3. Atomic Synchronization Strategy

1. When **Store Manager** is assigned or updated:
   - Resolve/Create canonical `StaffMember` in `StaffAccessControlStore` with `role: "BRANCH_MANAGER"` and assign profile `prof_branch_ops` (plus any extra profiles).
   - Set `branch.manager_staff_id = staff.id` and keep `branch.manager_account` populated with synchronized staff attributes.
2. When **Delivery Partner** is created or updated:
   - Resolve/Create canonical `StaffMember` in `StaffAccessControlStore` with `role: "DELIVERY_PARTNER"` and assign profile `prof_delivery_ops` (plus any extra profiles).
   - Create/Update operational `delivery_partner` record referencing `staff_id: staff.id`.
3. When **Admin Staff** is created or updated:
   - Resolve/Create canonical `StaffMember` in `StaffAccessControlStore`.
   - If role is `BRANCH_MANAGER`, require `branch_id` and update branch manager mapping.
   - If role is `DELIVERY_PARTNER`, require delivery operational mapping and update `delivery_partners`.
4. When **Any Staff Phone** logs in via OTP:
   - `checkAccountByPhone()` and `verifyAuthOtp()` query `StaffAccessControl.getStaffMemberByPhone()`.
   - Returns authoritative `role`, `staff_id`, `access_profiles`, `effective_permissions`, `branch_id`, `partner_id`.
   - **Never** creates an inadvertent `CUSTOMER` record.

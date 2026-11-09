# CakeToHome — Role & Permission Matrix

**Project:** CakeToHome  
**Legal Entity:** CakeToHome India Private Limited  
**Model:** Multi-Tier RBAC with Branch & Company Scoping  

---

## 1. System Roles Definition

| Role ID | Role Name | Scope | Description |
| :--- | :--- | :--- | :--- |
| **`CUSTOMER`** | Customer | Self | Storefront purchasing, own profile, addresses, favorites, and order history. |
| **`DELIVERY_PARTNER`** | Delivery Partner | Assigned Trips | Fleet delivery partner interface, trip execution, status updates. |
| **`STORE_STAFF`** | Store Staff | Assigned Branch | Counter ordering, branch order dispatch, local stock inspection. |
| **`STORE_MANAGER`** | Store Manager | Assigned Branch(es) | Branch operational management, teller custody, branch staff coordination. |
| **`OPERATIONS`** | Central Operations | Cross-Branch / Fleet | Multi-branch routing, delivery fleet dispatch, logistics coordination. |
| **`FINANCE`** | Finance & Accounts | Global Company | Ledger access, GST reporting, BRS bank reconciliation, periods, payouts. |
| **`ADMIN`** | Administrator | Enterprise | Product catalog, pricing, store configuration, customer service. |
| **`SUPER_ADMIN`** | Super Administrator | Global Root | Unrestricted administrative control, system settings, RBAC role assignment. |

---

## 2. Permission Mapping Matrix

| Permission Code | Customer | Delivery Partner | Store Staff | Store Manager | Operations | Finance | Admin | Super Admin |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `profile:read_self` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `profile:update_self`| ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `profile:manage_all` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `order:create_self`  | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `order:read_self`    | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `order:read_branch`  | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| `order:manage_branch`| ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| `order:read_all`     | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| `inventory:read`     | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| `inventory:manage`   | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| `delivery:view_trips`| ❌ | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| `delivery:update`    | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| `finance:read_reports`| ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| `finance:manage_vouchers`| ❌| ❌| ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| `admin:full_access`  | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |

---

## 3. Privilege Escalation Defenses

1. **Client Role Stripping**: Client-supplied role parameters in signup, OTP verify, or profile updates are stripped server-side.
2. **Database Verification**: The authoritative role is loaded strictly from `public.user_role_assignments` using the verified `auth.users.id`.
3. **Branch Enforcement**: Store managers and staff can only access resources where `branch_id IN (SELECT branch_id FROM public.user_branch_memberships WHERE user_id = auth.uid())`.

# CakeToHome — Final Production Hardening Failure Analysis (Test 1.7)

## 1. Exact Failed Assertion Details

- **Test Suite**: `frontend/scripts/test-production-hardening-matrix.ts`
- **Test ID**: `1.7`
- **Test Name**: `Auth & Identity - Partition Isolation (Driver phone in Customer mode)`
- **Assertion**:
  ```typescript
  const driverCrossCheck = ApiEngine.resolveUserAccount({ role: "CUSTOMER", phone: "+91 98765 00001" });
  if (driverCrossCheck && driverCrossCheck.role === "CUSTOMER") {
    record("1.7", "Auth & Identity", "Partition Isolation (Driver phone in Customer mode)", "PASS", "Driver phone created isolated customer persona without administrative crossover");
  } else {
    record("1.7", "Auth & Identity", "Partition Isolation", "FAIL", "Driver phone crossed over");
  }
  ```
- **Expected Value**: `driverCrossCheck !== null` and `driverCrossCheck.role === "CUSTOMER"` (Isolated customer persona generated for storefront shopping).
- **Actual Value**: `driverCrossCheck === null` (causing the `else` branch to fire with `"Driver phone crossed over"`).
- **Source File**: `frontend/src/lib/api-engine.ts` (`resolveUserAccount`, lines 12620–12629).
- **Dependency**: `StaffAccessControl` in `frontend/src/lib/staff-access-control.ts`.
- **Classification**: **AUTH / CUSTOMER IDENTITY / RBAC PARTITION ISOLATION**.

---

## 2. Root Cause Trace

1. In the baseline commit `6cdffa3` (`cth-production-hardening-2026-08-18`), `ApiEngine.resolveUserAccount` handled domain queries hierarchically:
   - Queries with `role: "SUPER_ADMIN"`, `"BRANCH_MANAGER"`, or `"DELIVERY_PARTNER"` checked privileged stores. If an unprivileged customer phone was queried with a staff role, it returned `null` (Test 1.6: Role Isolation).
   - Queries with `role: "CUSTOMER"` skipped the privileged branches and fell through to customer resolution, generating an isolated customer persona (`id: cus_...`, `customer_uid: cth_cus_...`, `role: "CUSTOMER"`) even if the phone number was associated with a driver or branch manager (Test 1.7: Partition Isolation). This allowed delivery partners and branch managers to place orders on the storefront without permission bleed.
2. In commit `769551b` (`feat(staff-roles): finalize unified staff role architecture`), `StaffAccessControl` was introduced at the start of `ApiEngine.resolveUserAccount`:
   ```typescript
   const staffMember = cleanPhone
     ? StaffAccessControl.getStaffMemberByPhone(cleanPhone)
     : (query.userId ? StaffAccessControl.getStaffMember(query.userId) : null);

   if (staffMember) {
     if (query.role === "CUSTOMER") {
       // Strict role isolation: Staff phone/account cannot be returned when querying for customer
       return null;
     }
     ...
   }
   ```
3. Because `+91 98765 00001` was registered in `StaffAccessControl` as `staff_mgr_01` (Rajesh Kumar), passing `role: "CUSTOMER"` matched `staffMember` and immediately returned `null` instead of falling through to create/resolve the isolated customer persona.
4. This broke Test 1.7 in `test-production-hardening-matrix.ts` and caused the 58/59 regression.

---

## 3. Test Integrity & Expected Behavior Verification

- The test in `frontend/scripts/test-production-hardening-matrix.ts` (lines 81–87) and the API route in `frontend/src/app/api/v1/[...path]/route.ts` (lines 314–315) are strictly identical to the release checkpoint `6cdffa3`.
- The test verifies a fundamental CakeToHome architectural requirement:
  - **Privileged access requests (`role: STAFF/MANAGER/DRIVER`) by customers must FAIL (`null`)**.
  - **Unprivileged customer requests (`role: CUSTOMER`) by staff/drivers must SUCCEED with an isolated `CUSTOMER` persona without administrative privileges**.

---

## 4. Remediation Plan

1. In `frontend/src/lib/api-engine.ts` (`resolveUserAccount`), when `query.role === "CUSTOMER"`:
   - Do NOT return `null` when a staff member is found in `StaffAccessControl`.
   - Skip returning the privileged staff account and allow resolution to fall through to the customer store / dynamic customer persona generator (`role: "CUSTOMER"`, `customer_uid: cth_cus_<cleanPhone>`).
2. In `frontend/scripts/test-unified-staff-roles-e2e.ts` (Group 5), align the assertion to verify that `staffAsCustomer` resolves to an isolated `CUSTOMER` persona with zero staff permissions (`staffAsCustomer?.role === "CUSTOMER"` and `staffAsCustomer?.profile_ids === undefined`).
3. Re-run `test-production-hardening-matrix.ts` to verify **59/59 (100% PASS)**.
4. Re-run all critical regression suites.

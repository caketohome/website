# CakeToHome — Supabase Authentication Test Suite Report

**Project:** CakeToHome  
**Legal Entity:** CakeToHome India Private Limited  
**Test Suite:** `scripts/test_supabase_auth_suite.cjs`  
**Execution Environment:** Node.js 24 + Embedded PostgreSQL 16.14 (`cth_rehearsal_phase5_7`)  
**Overall Result:** **37 PASSED / 0 FAILED (100% SUCCESS RATE)**  

---

## 1. Suite Execution Summary

```
======================================================================
CAKETOHOME — SUPABASE AUTHENTICATION & RBAC VERIFICATION SUITE
======================================================================

--- SUITE 1: PHONE NUMBER NORMALIZATION & E.164 ---
[PASS] 10-digit Indian number normalized to +91 
[PASS] Indian number with spaces normalized to +91 
[PASS] Indian number with leading 0 normalized to +91 
[PASS] Indian number with country code 91 normalized to +91 
[PASS] Already formatted E.164 preserved 
[PASS] International E.164 number preserved 
[PASS] Invalid empty string returns empty 

--- SUITE 2: DATABASE INTEGRATION & SCHEMAS ---
[PASS] Table public.profiles exists in database 
[PASS] Table public.roles exists in database 
[PASS] Table public.permissions exists in database 
[PASS] Table public.role_permissions exists in database 
[PASS] Table public.user_role_assignments exists in database 
[PASS] Table public.user_branch_memberships exists in database 
[PASS] Table public.user_company_memberships exists in database 
[PASS] Table public.auth_audit_events exists in database 
[PASS] All 8 canonical roles exist in public.roles (Found: 8)
[PASS] All 8 auth tables have RLS enabled in PostgreSQL (8/8 enabled)

--- SUITE 3: IDEMPOTENT PROFILE PROVISIONING & TRIGGERS ---
[PASS] User inserted into auth.users (UUID: 047ac637-d35e-41bd-a2ad-4d5822a4d6cc)
[PASS] Profile automatically created by trigger on auth.users 
[PASS] Profile has status ACTIVE 
[PASS] Profile phone matches E.164 
[PASS] Default CUSTOMER role automatically assigned 
[PASS] Audit event recorded for user creation 
[PASS] Profile creation remains strictly idempotent (zero duplicates) 

--- SUITE 4: RBAC & BRANCH SCOPING ENFORCEMENT ---
[PASS] User can hold STORE_MANAGER role 
[PASS] User mapped to authorized branch br_partner_04 
[PASS] User cannot access unauthorized branch br_no_seller_05 
[PASS] Foreign key ON DELETE CASCADE cleanly purges profile upon auth.user deletion 

--- SUITE 5: JWT VERIFICATION & TAMPER DEFENSE ---
[PASS] Valid JWT cryptographically verifies successfully 
[PASS] Tampered JWT signature is rejected 
[PASS] Privilege escalation via forged JWT payload is rejected 
[PASS] Expired JWT is rejected 
[PASS] JWT signed with invalid secret is rejected 

--- SUITE 6: ROW LEVEL SECURITY (RLS) POLICIES ---
[PASS] RLS allows caller to select own profile 
[PASS] auth.uid() helper returns active session sub UUID 

--- SUITE 7: FAIL-CLOSED SECURITY & SECRETS HYGIENE ---
[PASS] JWT_SECRET is configured and non-empty 
[PASS] Service role key is not committed to client bundles 

======================================================================
TEST SUMMARY: 37 PASSED | 0 FAILED | TOTAL: 37
SUCCESS RATE: 100%
======================================================================
```

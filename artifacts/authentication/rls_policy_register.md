# CakeToHome — Row Level Security (RLS) Policy Register

**Project:** CakeToHome  
**Legal Entity:** CakeToHome India Private Limited  
**Target:** PostgreSQL Database Security Layer  

---

## 1. RLS Status Register

All identity, authorization, and customer tables have Row Level Security enabled:

| Table Name | RLS Status | Policies Implemented | Security Invariant |
| :--- | :---: | :---: | :--- |
| `public.profiles` | **ENABLED** | 2 | Users select/update own profile; Admins select all |
| `public.roles` | **ENABLED** | 1 | Public read-only; mutations restricted |
| `public.permissions` | **ENABLED** | 1 | Public read-only; mutations restricted |
| `public.role_permissions` | **ENABLED** | 1 | Public read-only; mutations restricted |
| `public.user_role_assignments` | **ENABLED** | 2 | Users view own roles; Super Admin manages |
| `public.user_branch_memberships`| **ENABLED** | 2 | Users view own branches; Admin/Super Admin manages |
| `public.user_company_memberships`| **ENABLED** | 2 | Users view own company; Admin/Super Admin manages |
| `public.auth_audit_events` | **ENABLED** | 2 | System append-only; Super Admin read-only |

---

## 2. Policy Definitions

### 2.1 Helper Function: `public.auth_has_role(check_role VARCHAR)`
```sql
CREATE OR REPLACE FUNCTION public.auth_has_role(check_role VARCHAR)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_role_assignments ura
    WHERE ura.user_id = auth.uid()
      AND (ura.role_id = check_role OR ura.role_id = 'SUPER_ADMIN')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth;
```

### 2.2 `public.profiles` Policies
- **SELECT**:
  ```sql
  CREATE POLICY "profiles_select_own_or_admin" ON public.profiles
  FOR SELECT USING (
      id = auth.uid() OR public.auth_has_role('ADMIN') OR public.auth_has_role('SUPER_ADMIN')
  );
  ```
- **UPDATE**:
  ```sql
  CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
  ```

### 2.3 `public.user_role_assignments` Policies
- **SELECT**:
  ```sql
  CREATE POLICY "role_assign_select_own_or_admin" ON public.user_role_assignments
  FOR SELECT USING (
      user_id = auth.uid() OR public.auth_has_role('ADMIN') OR public.auth_has_role('SUPER_ADMIN')
  );
  ```
- **MUTATE (INSERT / UPDATE / DELETE)**:
  ```sql
  CREATE POLICY "role_assign_admin_manage" ON public.user_role_assignments
  FOR ALL USING (public.auth_has_role('SUPER_ADMIN'))
  WITH CHECK (public.auth_has_role('SUPER_ADMIN'));
  ```

### 2.4 `public.user_branch_memberships` Policies
- **SELECT**:
  ```sql
  CREATE POLICY "branch_member_select_own_or_admin" ON public.user_branch_memberships
  FOR SELECT USING (
      user_id = auth.uid() OR public.auth_has_role('ADMIN') OR public.auth_has_role('SUPER_ADMIN')
  );
  ```
- **MUTATE**:
  ```sql
  CREATE POLICY "branch_member_admin_manage" ON public.user_branch_memberships
  FOR ALL USING (public.auth_has_role('ADMIN') OR public.auth_has_role('SUPER_ADMIN'))
  WITH CHECK (public.auth_has_role('ADMIN') OR public.auth_has_role('SUPER_ADMIN'));
  ```

### 2.5 `public.auth_audit_events` Policies
- **INSERT**:
  ```sql
  CREATE POLICY "audit_events_insert_system" ON public.auth_audit_events
  FOR INSERT WITH CHECK (TRUE);
  ```
- **SELECT**:
  ```sql
  CREATE POLICY "audit_events_select_admin" ON public.auth_audit_events
  FOR SELECT USING (public.auth_has_role('SUPER_ADMIN'));
  ```

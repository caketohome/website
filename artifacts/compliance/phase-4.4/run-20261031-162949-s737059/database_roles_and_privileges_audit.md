# PostgreSQL Database Roles and Privileges Security Audit

## 1. Actual Roles Inventory (pg_roles)
An empirical audit of the PostgreSQL 16.14 catalog on port 5433 revealed:
- `cth_test_user`: `rolsuper = true`, `rolcreaterole = true`, `rolcreatedb = true`, `rolcanlogin = true`, `rolreplication = true`, `rolbypassrls = true`.
- Standard system roles: `pg_read_all_data`, `pg_write_all_data`, `pg_monitor`, etc.

## 2. Principle of Least Privilege Analysis
Because `cth_test_user` has superuser privileges in the embedded environment, defenses cannot rely on discretionary access control (GRANT/REVOKE) alone. All state invariants must be enforced by:
1. `ENABLE ALWAYS` triggers that execute even under `session_replication_role = 'replica'`.
2. Statement-level triggers that abort `TRUNCATE`.
3. Check constraints validated at the engine level.
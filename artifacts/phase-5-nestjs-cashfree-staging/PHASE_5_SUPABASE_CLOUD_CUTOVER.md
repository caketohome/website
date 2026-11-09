# CAKETOHOME — SUPABASE CLOUD CUTOVER
## Identity Migration, OTP Verification & Session Architecture

- **Auth Provider:** Supabase Auth (GoTrue)
- **Cutover Status:** VERIFIED

### 1. Cutover Procedures
1. Mobile OTP requests are dispatched via Supabase Auth SMS channel.
2. In development and staging rehearsal, deterministic test codes (`123456`) are enabled for automated testing.
3. JWT validation decodes Supabase Base64URL claims, extracting `sub` (User ID) and `user_metadata.role`.
4. Role hierarchy is checked against authoritative `user_role_assignments` table in PostgreSQL.

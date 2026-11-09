# CakeToHome — Authentication Environment Configuration Guide

**Project:** CakeToHome  
**Legal Entity:** CakeToHome India Private Limited  

---

## 1. Environment Variable Specifications

| Variable Name | Environment | Scoping | Purpose | Example / Required Format |
| :--- | :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Frontend | Public | Supabase Auth API endpoint | `https://[PROJECT_REF].supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Frontend | Public | Supabase Anon / Publishable Key | `sb_publishable_...` |
| `DATABASE_URL` | Backend/API | Server-Only | PostgreSQL Connection Pooler | `postgresql://postgres.[REF]:[PASS]@[HOST]:6543/postgres` |
| `JWT_SECRET` | Both | Server-Only | Cryptographic signing secret | 64-character random string |
| `COOKIE_SECRET` | Backend | Server-Only | Session cookie signing secret | 64-character random string |

---

## 2. `.env.example` Reference Template

```bash
# ==============================================================================
# CakeToHome — Production Environment Template
# ==============================================================================

# Database Pooler (Supavisor Port 6543)
DATABASE_URL="postgresql://postgres.[PROD_REF]:[SECURE_PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"

# Storefront URLs
FRONTEND_URL="https://caketohome.com"
NEXT_PUBLIC_BASE_URL="https://caketohome.com"
NEXT_PUBLIC_BACKEND_URL="https://api.caketohome.com"

# Supabase Auth
NEXT_PUBLIC_SUPABASE_URL="https://[PROD_REF].supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_[KEY]"

# Cryptographic Secrets (Server-Only — NEVER expose to browser)
JWT_SECRET="[GENERATE_RANDOM_64_CHAR_HEX_OR_BASE64]"
COOKIE_SECRET="[GENERATE_RANDOM_64_CHAR_HEX_OR_BASE64]"

# CORS Configuration
STORE_CORS="https://caketohome.com"
ADMIN_CORS="https://caketohome.com"
AUTH_CORS="https://caketohome.com"
```

---

## 3. Secret Hygiene Rules

1. **Zero Secret Exposure**: Never prefix server secrets (`service_role`, database passwords, SMS API keys) with `NEXT_PUBLIC_`.
2. **Environment Segregation**: Development credentials must never be deployed to production Render or Supabase environments.
3. **Fail-Closed Target Guard**: `frontend/src/lib/db.ts` enforces that test environments will abort immediately if `DATABASE_URL` targets remote Supabase hosts.

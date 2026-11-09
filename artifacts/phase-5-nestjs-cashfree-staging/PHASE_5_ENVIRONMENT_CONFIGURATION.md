# CAKETOHOME — ENVIRONMENT CONFIGURATION
## Sanitized Variable Matrix (Staging vs Production)

| Variable | Staging (Current) | Production (Target) | Secret? |
|---|---|---|---|
| `NODE_ENV` | `staging` | `production` | No |
| `PORT` | `9000` | `9000` | No |
| `CASHFREE_ENV` | `SANDBOX` | `PRODUCTION` | No |
| `CASHFREE_APP_ID` | `<STAGING_APP_ID>` | `<PROD_APP_ID>` | Yes |
| `CASHFREE_SECRET_KEY` | `<STAGING_SECRET_KEY>` | `<PROD_SECRET_KEY>` | Yes |
| `SUPABASE_PROJECT_REF` | `xfvgumatwucammmbwdwv` | `xfvgumatwucammmbwdwv` | No |
| `SUPABASE_URL` | `https://xfvgumatwucammmbwdwv.supabase.co` | `https://xfvgumatwucammmbwdwv.supabase.co` | No |
| `DATABASE_URL` | `postgresql://...:5433/cth_rehearsal_phase5` | `postgresql://.../cth_production` | Yes |

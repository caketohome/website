# OTP SMS via Ping4SMS — status & finishing steps

## How it works
Site → Supabase Auth (generates + verifies the 6-digit OTP) → **Send SMS hook**
`public.send_sms_ping4sms` → Ping4SMS HTTP API
`GET https://site.ping4sms.com/api/smsapi?key&route&sender&number&sms&templateid`

Migration: `backend/src/migrations/20261113_ping4sms_send_sms_hook.sql`

## Already done (2026-11-13)
- Supabase → Authentication → Sign In / Providers → **Phone: enabled** (expiry 300 s, 6 digits)
- Supabase → Authentication → Hooks → **Send SMS hook: enabled** → Postgres `public.send_sms_ping4sms`
- Supabase Vault:
  | Secret | Value |
  |---|---|
  | `ping4sms_api_key` | set (from Ping4SMS → Developer → Http Api) |
  | `ping4sms_message` | set — approved text with `{{OTP}}` |
  | `ping4sms_sender` | **PLACEHOLDER — replace** |
  | `ping4sms_template_id` | **0 — replace** |
  | `ping4sms_route` | not set → defaults to `2` (Transactional, 11,000 credits). Set `4` if Trans OTP is enabled. |
- Verified end-to-end up to Ping4SMS: it currently answers `110 Invalid DLT Template ID`
  because the template is still awaiting approval. Until then OTP login shows
  "We couldn't send an SMS right now."

## When Ping4SMS approves the template
1. In Ping4SMS, confirm the **Sender ID** and **Template** appear under Messaging → Sender ID / Template.
2. Supabase → Project Settings → **Vault** → edit:
   - `ping4sms_sender` → the 6-letter sender ID
   - `ping4sms_template_id` → the DLT template ID (e.g. `1707…`)
   - (if the approved wording differs) `ping4sms_message` → exact approved text, `{{OTP}}` for the code
3. Log in on the site with a test number. A successful send is recorded in
   `public.auth_audit_events` as `OTP_SMS_SEND` / `SUCCESS` with the Ping4SMS message id.

No code change or redeploy is needed — the hook reads Vault on every send.

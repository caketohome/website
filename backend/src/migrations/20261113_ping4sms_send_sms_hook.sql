-- CakeToHome — Supabase Auth "Send SMS" hook → Ping4SMS (2026-11-13)
--
-- Supabase generates and verifies the OTP; this function only delivers it.
-- Config lives in Supabase Vault (Dashboard → Project Settings → Vault), never in code:
--   ping4sms_api_key      Ping4SMS account API key (Developer → Http Api → View API Key)
--   ping4sms_sender       DLT-approved 6-letter sender ID / header
--   ping4sms_template_id  DLT template ID (e.g. 1707…)
--   ping4sms_message      Exact approved template text with {{OTP}} (or {OTP}) where the code goes
--   ping4sms_route        optional, default 2 (Transactional)
-- Then: Dashboard → Authentication → Hooks → Send SMS → Postgres → public.send_sms_ping4sms
--
-- Ping4SMS API: GET https://site.ping4sms.com/api/smsapi?key&route&sender&number&sms&templateid
-- route: Vault ping4sms_route (default 2 = Transactional; this account has no route-4 credits). Success body = numeric message id; 101–110 = error codes.

CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.send_sms_ping4sms(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_key    text;
  v_sender text;
  v_tpl    text;
  v_msg    text;
  v_route  text;
  v_phone  text := right(regexp_replace(coalesce(event->'user'->>'phone', ''), '\D', '', 'g'), 10);
  v_otp    text := event->'sms'->>'otp';
  v_resp   extensions.http_response;
  v_body   text;
BEGIN
  SELECT max(decrypted_secret) FILTER (WHERE name = 'ping4sms_api_key'),
         max(decrypted_secret) FILTER (WHERE name = 'ping4sms_sender'),
         max(decrypted_secret) FILTER (WHERE name = 'ping4sms_template_id'),
         max(decrypted_secret) FILTER (WHERE name = 'ping4sms_message'),
         coalesce(max(decrypted_secret) FILTER (WHERE name = 'ping4sms_route'), '2')
    INTO v_key, v_sender, v_tpl, v_msg, v_route
    FROM vault.decrypted_secrets
   WHERE name LIKE 'ping4sms_%';

  IF v_key IS NULL OR v_sender IS NULL OR v_tpl IS NULL OR v_msg IS NULL THEN
    RAISE LOG 'send_sms_ping4sms: Vault config missing';
  INSERT INTO public.auth_audit_events (id, user_id, phone, event_type, status, metadata, created_at)
  VALUES (gen_random_uuid(), NULL, '+91' || v_phone, 'OTP_SMS_SEND', 'FAILURE', jsonb_build_object('reason', 'config_missing'), now());
    RETURN jsonb_build_object('error', jsonb_build_object('http_code', 500, 'message', 'SMS provider not configured'));
  END IF;
  IF v_phone !~ '^[6-9][0-9]{9}$' OR v_otp !~ '^[0-9]{4,10}$' THEN
    RETURN jsonb_build_object('error', jsonb_build_object('http_code', 400, 'message', 'Invalid phone or OTP'));
  END IF;

  PERFORM extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '8000');
  SELECT * INTO v_resp FROM extensions.http_get(
    'https://site.ping4sms.com/api/smsapi'
    || '?key='        || extensions.urlencode(v_key)
    || '&route='      || extensions.urlencode(v_route)
    || '&sender='     || extensions.urlencode(v_sender)
    || '&number='     || v_phone
    || '&sms='        || extensions.urlencode(replace(replace(v_msg, '{{OTP}}', v_otp), '{OTP}', v_otp))
    || '&templateid=' || extensions.urlencode(v_tpl)
  );
  v_body := trim(coalesce(v_resp.content, ''));

  -- Each call is recorded in auth_audit_events (OTP_SMS_SEND) without the OTP or key.
  -- Note: on a FAILURE return Supabase rolls the request back, so only SUCCESS rows persist;
  -- failures are visible in Postgres logs (RAISE LOG) and as "SMS delivery failed" to the client.
  -- Success = numeric message id (longer than the 3-digit error codes).
  IF v_resp.status <> 200 OR v_body !~ '^[0-9]+$' OR v_body ~ '^1(0[1-9]|10)$' THEN
    RAISE LOG 'send_sms_ping4sms failed: http % body %', v_resp.status, left(v_body, 40);  -- never logs OTP/key
  INSERT INTO public.auth_audit_events (id, user_id, phone, event_type, status, metadata, created_at)
  VALUES (gen_random_uuid(), NULL, '+91' || v_phone, 'OTP_SMS_SEND', 'FAILURE', jsonb_build_object('reason', 'provider_rejected', 'http', v_resp.status, 'ping4sms_code', left(v_body, 10)), now());
    RETURN jsonb_build_object('error', jsonb_build_object('http_code', 502, 'message', 'SMS delivery failed'));
  END IF;

  INSERT INTO public.auth_audit_events (id, user_id, phone, event_type, status, metadata, created_at)
  VALUES (gen_random_uuid(), NULL, '+91' || v_phone, 'OTP_SMS_SEND', 'SUCCESS', jsonb_build_object('ping4sms_message_id', left(v_body, 30)), now());
  RETURN '{}'::jsonb;
END;
$$;

-- Only Supabase Auth may call it.
REVOKE ALL ON FUNCTION public.send_sms_ping4sms(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_sms_ping4sms(jsonb) TO supabase_auth_admin;

/**
 * CakeToHome — Supabase Phone Auth (server only).
 *
 * Identity  = Supabase Auth user (OTP sent + verified by Supabase, never by us).
 * Profile   = public.profiles.id = auth.users.id, provisioned idempotently here.
 * Authz     = public.user_role_assignments (+ server-side staff records), never client input.
 * Session   = short-lived app JWT (_cth_jwt, httpOnly) + Supabase refresh token (_cth_sb_rt, httpOnly).
 */
import { createClient, type AuthError, type User } from "@supabase/supabase-js";
import type { NextResponse } from "next/server";
import { dbQuery, dbTransaction } from "../db";
import { getSupabaseConfig } from "../supabase/config";
import { getAuthoritativeUserFromDb } from "../supabase/server";
import { signAuthToken } from "../security/auth-session";
import { normalizeIndianMobile } from "./phone";

export const APP_SESSION_COOKIE = "_cth_jwt";
export const REFRESH_COOKIE = "_cth_sb_rt";
const APP_SESSION_TTL = 8 * 60 * 60; // role/suspension changes apply within 8h at worst (on /api/auth/me: immediately)
const REFRESH_TTL = 30 * 24 * 60 * 60;

/** Cookies older flows set; cleared on login/logout so stale client state never lingers. */
export const LEGACY_AUTH_COOKIES = [
  "_medusa_jwt", "_cth_role", "_cth_user_id", "_cth_customer_uid", "_cth_phone",
  "_cth_branch_id", "_cth_shop_id", "_cth_partner_id", "_cth_auth_token", "admin_session",
];

export class PhoneAuthError extends Error {
  constructor(public code: string, message: string, public status = 400, public retryAfter?: number) {
    super(message);
  }
}

function supabase() {
  const cfg = getSupabaseConfig();
  if (!cfg.hasValidConfig) {
    throw new PhoneAuthError("auth_not_configured", "Login is temporarily unavailable.", 503);
  }
  return createClient(cfg.url, cfg.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function mapAuthError(err: AuthError): PhoneAuthError {
  const code = err.code || "";
  if (code === "phone_provider_disabled" || code === "sms_send_failed" || /provider|twilio|sms/i.test(err.message)) {
    // Log the provider reason server-side only; never the phone or OTP.
    console.error("[PhoneAuth] SMS provider error:", code || err.status, err.message);
    return new PhoneAuthError("sms_unavailable", "We couldn't send an SMS right now. Please try again later.", 503);
  }
  if (err.status === 429 || code.startsWith("over_")) {
    return new PhoneAuthError("rate_limited", "Too many attempts. Please wait a minute and try again.", 429, 60);
  }
  if (code === "otp_expired") {
    return new PhoneAuthError("otp_invalid", "That code is invalid or has expired. Request a new one.", 400);
  }
  if (code === "signup_disabled") {
    return new PhoneAuthError("signup_disabled", "New sign-ups are currently closed.", 403);
  }
  console.error("[PhoneAuth] Supabase auth error:", code || err.status, err.message);
  return new PhoneAuthError("auth_failed", "Authentication failed. Please try again.", 400);
}

function requirePhone(raw: unknown): string {
  const phone = normalizeIndianMobile(raw);
  if (!phone) throw new PhoneAuthError("invalid_phone", "Enter a valid 10-digit Indian mobile number.", 400);
  return phone;
}

/** Same response whether or not the number has an account (no enumeration). */
export async function requestPhoneOtp(rawPhone: unknown): Promise<{ phone: string }> {
  const phone = requirePhone(rawPhone);
  const { error } = await supabase().auth.signInWithOtp({ phone, options: { channel: "sms" } });
  if (error) throw mapAuthError(error);
  return { phone };
}

export interface AuthContext { ip?: string; userAgent?: string }

export interface AppSession {
  token: string;
  refreshToken: string;
  role: string;
  userId: string;
  isNewProfile: boolean;
  needsProfile: boolean;
}

export async function verifyPhoneOtp(rawPhone: unknown, rawCode: unknown, ctx: AuthContext): Promise<AppSession> {
  const phone = requirePhone(rawPhone);
  const token = typeof rawCode === "string" ? rawCode.replace(/\D/g, "") : "";
  if (token.length !== 6) throw new PhoneAuthError("otp_invalid", "Enter the 6-digit code.", 400);

  const { data, error } = await supabase().auth.verifyOtp({ phone, token, type: "sms" });
  if (error || !data.session || !data.user) {
    await audit(null, phone, "LOGIN_FAILED", "FAILURE", ctx, { reason: error?.code || "no_session" });
    throw error ? mapAuthError(error) : new PhoneAuthError("auth_failed", "Authentication failed.", 400);
  }
  return buildSession(data.user, data.session.refresh_token, ctx, "LOGIN_SUCCESS");
}

/** Rotates the Supabase refresh token; fails if the Supabase session was revoked/logged out. */
export async function refreshAppSession(refreshToken: string, ctx: AuthContext): Promise<AppSession> {
  const { data, error } = await supabase().auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session || !data.user) {
    throw error ? mapAuthError(error) : new PhoneAuthError("session_expired", "Session expired.", 401);
  }
  return buildSession(data.user, data.session.refresh_token, ctx, "SESSION_REFRESHED");
}

/** Revokes the Supabase session behind this refresh token (best effort). */
export async function revokeSupabaseSession(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) return;
  try {
    const client = supabase();
    const { error } = await client.auth.refreshSession({ refresh_token: refreshToken });
    if (!error) await client.auth.signOut({ scope: "local" });
  } catch {
    // Already invalid — nothing to revoke.
  }
}

async function buildSession(user: User, refreshToken: string, ctx: AuthContext, event: string): Promise<AppSession> {
  // Phone comes from the Supabase-verified identity, never from the request body.
  const phone = normalizeIndianMobile(user.phone ? `+${user.phone.replace(/^\+/, "")}` : "");
  if (!phone) throw new PhoneAuthError("auth_failed", "Verified account has no Indian mobile number.", 400);

  const { isNew, status } = await provisionProfile(user.id, phone, ctx);
  if (status === "SUSPENDED" || status === "DEACTIVATED") {
    await audit(user.id, phone, "LOGIN_BLOCKED", "FAILURE", ctx, { status });
    throw new PhoneAuthError("account_suspended", "This account is not active. Contact support.", 403);
  }
  if (event !== "SESSION_REFRESHED") await audit(user.id, phone, event, "SUCCESS", ctx);

  const claims = await resolveSessionClaims(user.id, phone);
  return {
    token: signAuthToken(claims, APP_SESSION_TTL),
    refreshToken,
    role: claims.role,
    userId: user.id,
    isNewProfile: isNew,
    needsProfile: !claims.name,
  };
}

/**
 * Idempotent profile + role provisioning, serialized per phone.
 * Super Admin is granted only when the *verified* phone is in public.super_admin_allowlist.
 */
async function provisionProfile(userId: string, phone: string, ctx: AuthContext): Promise<{ isNew: boolean; status: string }> {
  const authPhone = phone.slice(1); // auth.users stores phone without "+"
  return dbTransaction(async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [phone]);

    // A legacy/orphan profile may hold this phone (pre-Supabase rows have no auth identity).
    // Keep it for history, carry descriptive fields over, but NEVER its roles.
    const legacy = await c.query(
      `UPDATE public.profiles p
          SET phone = 'legacy-' || substr(md5(p.id::text), 1, 12), status = 'SUPERSEDED', updated_at = now()
        WHERE p.phone = $1 AND p.id <> $2
          AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id AND u.phone = $3)
        RETURNING p.id, p.full_name, p.display_name, p.email`,
      [phone, userId, authPhone]
    );
    const carried = legacy.rows[0] || {};

    const ins = await c.query(
      `INSERT INTO public.profiles (id, phone, full_name, display_name, email, status, last_activity_at)
       VALUES ($1, $2, $3, $4, $5, 'ACTIVE', now())
       ON CONFLICT (id) DO UPDATE SET phone = EXCLUDED.phone, last_activity_at = now(), updated_at = now()
       RETURNING status, (xmax = 0) AS inserted`,
      [userId, phone, carried.full_name || null, carried.display_name || null, carried.email || null]
    );

    await c.query(
      `INSERT INTO public.user_role_assignments (user_id, role_id) VALUES ($1, 'CUSTOMER')
       ON CONFLICT (user_id, role_id) DO NOTHING`,
      [userId]
    );

    const allow = await c.query(`SELECT label FROM public.super_admin_allowlist WHERE phone = $1`, [phone]);
    if (allow.rows.length) {
      const granted = await c.query(
        `INSERT INTO public.user_role_assignments (user_id, role_id) VALUES ($1, 'SUPER_ADMIN')
         ON CONFLICT (user_id, role_id) DO NOTHING RETURNING id`,
        [userId]
      );
      await c.query(
        `UPDATE public.profiles SET display_name = COALESCE(display_name, $2) WHERE id = $1`,
        [userId, allow.rows[0].label]
      );
      if (granted.rows.length) {
        await auditWith(c, userId, phone, "SUPER_ADMIN_PROVISIONED", "SUCCESS", ctx, {
          business_identity: allow.rows[0].label,
          source: "super_admin_allowlist",
        });
      }
    }

    if (legacy.rows.length) {
      await auditWith(c, userId, phone, "PROFILE_LEGACY_SUPERSEDED", "SUCCESS", ctx, {
        legacy_profile_ids: legacy.rows.map((r: any) => r.id),
      });
    }
    return { isNew: Boolean(ins.rows[0].inserted), status: ins.rows[0].status };
  });
}

/** DB role ids -> roles the existing app routes/guards understand. */
const ROLE_ALIASES: Record<string, string> = { STORE_MANAGER: "BRANCH_MANAGER", STORE_STAFF: "STAFF" };

async function resolveSessionClaims(userId: string, phone: string) {
  const db = await getAuthoritativeUserFromDb(userId);
  if (!db) throw new PhoneAuthError("auth_failed", "Profile unavailable. Please try again.", 503);

  const digits = phone.slice(-10);
  let role = ROLE_ALIASES[db.primary_role] || db.primary_role;
  let branchId = db.branch_ids[0] || null;
  let partnerId: string | null = null;

  // Staff/manager/delivery records are admin-managed server data (not client input).
  // SUPER_ADMIN is never derived from them — only from user_role_assignments.
  if (role === "CUSTOMER") {
    try {
      const { ApiEngine } = await import("../api-engine");
      await ApiEngine.ensureHydrated();
      const staff = ApiEngine.checkAccountByPhone(digits);
      if (staff.exists && staff.role !== "CUSTOMER" && staff.role !== "SUPER_ADMIN") {
        role = staff.role;
        branchId = staff.branch_id || branchId;
        partnerId = staff.partner_id || null;
      }
    } catch {
      // staff store unavailable -> stay CUSTOMER (fail closed)
    }
  }

  let customerUid = `cth_cus_${digits}`; // existing order/address/customer linkage key
  if (role === "CUSTOMER") {
    try {
      const { ApiEngine } = await import("../api-engine");
      customerUid = ApiEngine.ensureCustomerForVerifiedPhone(digits, { name: db.full_name || undefined }).customer_uid;
    } catch (err: any) {
      console.error("[PhoneAuth] customer record sync failed:", err.message);
    }
  }

  return {
    userId,
    role,
    phone: digits,
    customerUid,
    customerId: userId,
    branchId,
    partnerId,
    name: db.display_name || db.full_name || "",
    email: db.email || "",
  };
}

/** Re-reads roles/status from the DB for an existing app session. Returns null if access must end. */
export async function revalidateClaims(userId: string, phoneDigits: string) {
  const db = await getAuthoritativeUserFromDb(userId); // excludes SUSPENDED
  if (!db || db.status === "DEACTIVATED") return null;
  return resolveSessionClaims(userId, `+91${phoneDigits}`);
}

export function mintToken(claims: Awaited<ReturnType<typeof resolveSessionClaims>>): string {
  return signAuthToken(claims, APP_SESSION_TTL);
}

export function setSessionCookies(res: NextResponse, session: { token: string; refreshToken?: string }) {
  const secure = process.env.NODE_ENV === "production";
  res.cookies.set(APP_SESSION_COOKIE, session.token, {
    httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: APP_SESSION_TTL,
  });
  if (session.refreshToken) {
    res.cookies.set(REFRESH_COOKIE, session.refreshToken, {
      httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: REFRESH_TTL,
    });
  }
  for (const name of LEGACY_AUTH_COOKIES) res.cookies.set(name, "", { path: "/", maxAge: 0 });
}

/**
 * Re-issue the app session token after the user edits their own profile, so the
 * name shown in the header/menus updates immediately instead of after token expiry.
 * The Supabase refresh token is left as is.
 */
export async function reissueSessionToken(res: NextResponse, userId: string, phoneDigits: string) {
  const claims = await revalidateClaims(userId, phoneDigits);
  if (!claims) return;
  const secure = process.env.NODE_ENV === "production";
  res.cookies.set(APP_SESSION_COOKIE, mintToken(claims), {
    httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: APP_SESSION_TTL,
  });
}

export function clearSessionCookies(res: NextResponse) {
  for (const name of [APP_SESSION_COOKIE, REFRESH_COOKIE, ...LEGACY_AUTH_COOKIES]) {
    res.cookies.set(name, "", { path: "/", maxAge: 0, expires: new Date(0) });
  }
}

async function audit(userId: string | null, phone: string, event: string, status: string, ctx: AuthContext, metadata: object = {}) {
  try {
    await auditWith({ query: dbQuery }, userId, phone, event, status, ctx, metadata);
  } catch (err: any) {
    console.error("[PhoneAuth] audit write failed:", err.message);
  }
}

async function auditWith(
  c: { query: (sql: string, params: any[]) => Promise<any> },
  userId: string | null, phone: string, event: string, status: string, ctx: AuthContext, metadata: object = {}
) {
  await c.query(
    `INSERT INTO public.auth_audit_events (id, user_id, phone, event_type, ip_address, user_agent, status, metadata, created_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, now())`,
    [userId, phone, event, ctx.ip || null, (ctx.userAgent || "").slice(0, 500) || null, status, JSON.stringify(metadata)]
  );
}

export function requestContext(req: Request): AuthContext {
  return {
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined,
    userAgent: req.headers.get("user-agent") || undefined,
  };
}

/** Profile completion / edit: only descriptive fields; identity, role and status are never writable here. */
export async function updateOwnProfile(userId: string, phoneDigits: string, input: { name?: unknown; email?: unknown }) {
  const name = typeof input.name === "string" ? input.name.trim().replace(/\s+/g, " ") : "";
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  if (name.length < 2 || name.length > 100) throw new PhoneAuthError("invalid_name", "Enter your name (2–100 characters).");
  if (email && (email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    throw new PhoneAuthError("invalid_email", "Enter a valid email address.");
  }
  const res = await dbQuery(
    `UPDATE public.profiles
        SET full_name = $2, display_name = $2, email = COALESCE(NULLIF($3, ''), email),
            is_profile_completed = true, updated_at = now()
      WHERE id = $1 AND status = 'ACTIVE'
      RETURNING id`,
    [userId, name, email]
  );
  if (!res.rowCount) throw new PhoneAuthError("profile_not_found", "Profile not found.", 404);
  try {
    const { ApiEngine } = await import("../api-engine");
    ApiEngine.ensureCustomerForVerifiedPhone(phoneDigits, { name, email: email || undefined });
  } catch {
    // storefront customer record is best-effort; profile is the source of truth
  }
}

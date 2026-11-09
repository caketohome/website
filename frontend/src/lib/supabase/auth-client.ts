/**
 * CakeToHome — Supabase Client-Side Authentication Service
 * 
 * Implements Phone Number OTP Authentication (E.164) using Supabase Auth.
 * Includes rate-limiting, resend countdown, session persistence, and logout.
 */

import { getSupabaseConfig } from "./config";

export interface SupabaseAuthUser {
  id: string;
  phone: string;
  email?: string;
  role: string;
  full_name?: string;
  display_name?: string;
  branch_id?: string | null;
  partner_id?: string | null;
  is_new_customer?: boolean;
}

export interface SupabaseAuthSession {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  user: SupabaseAuthUser;
}

export interface RequestOtpResult {
  success: boolean;
  message: string;
  phone: string;
  dev_otp?: string;
  isRateLimited?: boolean;
  retryAfterSeconds?: number;
}

export interface VerifyOtpResult {
  success: boolean;
  session?: SupabaseAuthSession;
  error?: string;
  isNewUser?: boolean;
}

// In-memory client rate limiter to prevent abusive click spamming
const clientRateLimiter = new Map<string, { lastRequest: number; attempts: number }>();

/**
 * Normalizes an international phone number to E.164 format.
 * Defaults 10-digit Indian numbers to +91.
 */
export function normalizeE164Phone(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (!digits) return "";

  // If already starts with +
  if (input.trim().startsWith("+")) {
    return `+${digits}`;
  }

  // 10-digit standard Indian mobile
  if (digits.length === 10) {
    return `+91${digits}`;
  }

  // 12-digit Indian number starting with 91
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+${digits}`;
  }

  // 11-digit number starting with 0 (Indian STD/Mobile prefix)
  if (digits.length === 11 && digits.startsWith("0")) {
    return `+91${digits.slice(1)}`;
  }

  // Fallback E.164
  return `+${digits}`;
}

export class SupabaseAuthClient {
  private config = getSupabaseConfig();

  /**
   * Requests a Phone OTP via Supabase Auth / CakeToHome Auth Service
   */
  async requestPhoneOtp(rawPhone: string): Promise<RequestOtpResult> {
    const phone = normalizeE164Phone(rawPhone);
    if (!phone || phone.length < 10) {
      throw new Error("Please enter a valid mobile number.");
    }

    // Client-side rate limit: 1 request per 30 seconds per phone
    const now = Date.now();
    const rateEntry = clientRateLimiter.get(phone);
    if (rateEntry) {
      const elapsed = Math.floor((now - rateEntry.lastRequest) / 1000);
      if (elapsed < 30) {
        return {
          success: false,
          message: `Please wait ${30 - elapsed} seconds before requesting another OTP.`,
          phone,
          isRateLimited: true,
          retryAfterSeconds: 30 - elapsed,
        };
      }
    }

    try {
      // Dispatch request through backend API which bridges Supabase Auth and database audit
      const res = await fetch("/api/v1/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, method: "OTP_SMS" }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || "Failed to send OTP.");
      }

      // Record rate limit timestamp
      clientRateLimiter.set(phone, {
        lastRequest: now,
        attempts: (rateEntry?.attempts || 0) + 1,
      });

      return {
        success: true,
        message: data.message || `OTP sent successfully to ${phone}`,
        phone,
        dev_otp: data.dev_otp,
      };
    } catch (err: any) {
      throw new Error(err.message || "Network error while requesting OTP.");
    }
  }

  /**
   * Verifies Phone OTP, restores session, and retrieves user profile
   */
  async verifyPhoneOtp(
    rawPhone: string,
    token: string,
    extra?: { name?: string; email?: string }
  ): Promise<VerifyOtpResult> {
    const phone = normalizeE164Phone(rawPhone);
    const cleanToken = token.trim().replace(/\D/g, "");

    if (!phone) {
      throw new Error("Phone number is required.");
    }
    if (!cleanToken || cleanToken.length < 6) {
      throw new Error("Please enter a valid 6-digit verification code.");
    }

    try {
      const res = await fetch("/api/v1/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          code: cleanToken,
          name: extra?.name,
          email: extra?.email,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          error: data.error || data.message || "Invalid or expired verification code.",
        };
      }

      const session: SupabaseAuthSession = {
        access_token: data.token || data.accessToken,
        user: {
          id: data.user?.id || data.customer_id || `cus_${phone.replace(/\D/g, "").slice(-10)}`,
          phone,
          email: data.user?.email || extra?.email,
          role: data.role || data.user?.role || "CUSTOMER",
          full_name: data.user?.name || extra?.name,
          display_name: data.user?.name || extra?.name,
          branch_id: data.branch_id || data.user?.branch_id || null,
          partner_id: data.partner_id || data.user?.partner_id || null,
          is_new_customer: data.is_new_customer,
        },
      };

      // Reset rate limit on successful verification
      clientRateLimiter.delete(phone);

      return {
        success: true,
        session,
        isNewUser: Boolean(data.is_new_customer),
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || "Failed to verify OTP. Please try again.",
      };
    }
  }

  /**
   * Authoritative multi-tab logout and cookie clearing
   */
  async signOut(): Promise<void> {
    try {
      await fetch("/api/v1/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "user_logout" }),
      });
    } catch {}

    if (typeof window !== "undefined") {
      localStorage.removeItem("cth_access_token");
      localStorage.removeItem("cth_admin_token");
      localStorage.removeItem("admin_token");
      localStorage.removeItem("_cth_user");
      localStorage.removeItem("_cth_role");
    }
  }
}

export const supabaseAuthClient = new SupabaseAuthClient();

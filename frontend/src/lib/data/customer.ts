/**
 * CakeToHome Storefront Customer Data Layer
 * Connects frontend UI to custom NestJS Core API (/api/v1).
 */

import { apiClient } from "../api-client";

export interface OtpRequestResponse {
  sent: boolean;
  message: string;
  resend_after?: number;
}

/** Session cookies are set httpOnly by the server; no token ever reaches client JS. */
export interface OtpVerifyResponse {
  role: string;
  redirect_to: string;
  is_new_customer: boolean;
  needs_profile: boolean;
}

/** Error carrying the server's machine-readable code (otp_invalid, rate_limited, sms_unavailable, ...). */
export class OtpError extends Error {
  constructor(public code: string, message: string, public retryAfter?: number) {
    super(message);
  }
}

export interface CustomerAddress {
  id: string;
  customer_id: string;
  label?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  line1: string;
  line2?: string | null;
  city: string;
  state?: string | null;
  pincode?: string | null;
  country: string;
  latitude?: number | null;
  longitude?: number | null;
  is_default_shipping: boolean;
  is_default_billing: boolean;
}

export interface AddressInput {
  label?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  pincode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  is_default_shipping?: boolean;
  is_default_billing?: boolean;
}

async function postAuth<T>(path: string, body: object): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });
  } catch {
    throw new OtpError("network", "Network error. Check your connection and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.success === false) {
    const retry = Number(res.headers.get("Retry-After")) || undefined;
    throw new OtpError(data?.code || "auth_failed", data?.error || "Something went wrong. Please try again.", retry);
  }
  return data as T;
}

export async function requestOtp(phone: string): Promise<OtpRequestResponse> {
  const data = await postAuth<any>("/api/v1/auth/request-otp", { phone });
  return { sent: true, message: data.message, resend_after: data.resend_after };
}

export async function verifyOtp(phone: string, code: string): Promise<OtpVerifyResponse> {
  return postAuth<OtpVerifyResponse>("/api/v1/auth/verify-otp", { phone, code });
}

export async function fetchCurrentCustomer(): Promise<any> {
  try {
    const res = await apiClient.get("/customer/me");
    if (res?.success && res?.customer) {
      return res.customer;
    }
    return null;
  } catch {
    return null;
  }
}

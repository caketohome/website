/**
 * CakeToHome Storefront Customer Data Layer
 * Connects frontend UI to custom NestJS Core API (/api/v1).
 */

import { apiClient } from "../api-client";

export interface OtpRequestResponse {
  sent: boolean;
  dev_otp?: string;
  message: string;
  account_exists?: boolean;
  role?: string;
}

export interface OtpVerifyResponse {
  customer_id: string;
  customer_uid?: string;
  is_new_customer: boolean;
  token?: string;
  detected_role?: string;
  role?: string;
  user?: any;
  branch_id?: string;
  partner_id?: string;
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

/**
 * Smart automatic role detection based on input mobile number or username/email.
 * Real role verification is ALWAYS server-authoritative upon OTP verification.
 */
export function detectUserRole(phoneOrEmail: string): { role: string; label: string; redirectPath: string } {
  const clean = (phoneOrEmail || "").trim().toLowerCase().replace(/\s+/g, "");
  const cleanDigits = clean.replace(/\D/g, "");

  // Explicit demo keywords for testing (non-numeric) or delivery partner phones
  if (clean === "driver" || clean === "dlp" || clean === "delivery" || cleanDigits === "9900011111" || cleanDigits === "9900022222") {
    return {
      role: "delivery_partner",
      label: "🛵 Delivery Partner Fleet",
      redirectPath: "/dashboard/delivery-partner",
    };
  }

  // Explicit admin keywords or super admin phones
  if (clean === "admin" || clean === "superadmin" || clean === "owner" || cleanDigits === "9999999999" || cleanDigits === "9876500000") {
    return {
      role: "admin",
      label: "🛡️ Super Admin Control",
      redirectPath: "/dashboard",
    };
  }

  // Branch manager keywords or branch manager phone
  if (clean === "shop" || clean === "shpmgr" || clean === "manager" || clean === "branch" || cleanDigits === "9876500001") {
    return {
      role: "shop",
      label: "🏪 Branch & Shop Manager Control Center",
      redirectPath: "/dashboard/shop",
    };
  }

  // All other phone numbers default to Customer Profile; backend OTP verification provides server-authoritative role
  return {
    role: "customer",
    label: "👤 Customer Profile",
    redirectPath: "/account",
  };
}

export async function requestOtp(phone: string): Promise<OtpRequestResponse> {
  const isDev = process.env.NODE_ENV !== "production";
  try {
    const res: any = await Promise.race([
      apiClient.requestOtp(phone),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 30000))
    ]);

    return {
      sent: true,
      dev_otp: (isDev && res?.dev_otp) ? res.dev_otp : undefined,
      message: res.message || "OTP sent successfully",
      account_exists: res.account_exists,
      role: res.role,
    };
  } catch (err: any) {
    if (!isDev) {
      throw new Error(err.message || "Failed to send OTP. Please try again.");
    }
    const detected = detectUserRole(phone);
    return {
      sent: true,
      dev_otp: "123456",
      message: "Development fallback: OTP service unavailable",
      account_exists: true,
      role: detected.role === "admin" ? "SUPER_ADMIN" : (detected.role === "shop" ? "BRANCH_MANAGER" : (detected.role === "delivery_partner" ? "DELIVERY_PARTNER" : "CUSTOMER")),
    };
  }
}

export async function verifyOtp(phone: string, otp: string, extra?: { name?: string; email?: string }): Promise<OtpVerifyResponse> {
  const isDev = process.env.NODE_ENV !== "production";
  const detected = detectUserRole(phone);
  try {
    const res: any = await Promise.race([
      apiClient.verifyOtp(phone, otp, extra),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 30000))
    ]);

    const token = res.accessToken || res.token;
    if (!res || !token) {
      throw new Error("Verification failed: no token received");
    }

    return {
      customer_id: res.user?.customer_id || res.user?.id || res.customer_id || `cus_${phone.replace(/\D/g, "").slice(-10)}`,
      customer_uid: res.user?.customer_uid || res.customer_uid || `cth_cus_${phone.replace(/\D/g, "").slice(-10)}`,
      is_new_customer: res.is_new_customer ?? false,
      token,
      detected_role: res.role || detected.role,
      role: res.role || (detected.role === "admin" ? "SUPER_ADMIN" : (detected.role === "shop" ? "BRANCH_MANAGER" : (detected.role === "delivery_partner" ? "DELIVERY_PARTNER" : "CUSTOMER"))),
      user: res.user,
      branch_id: res.branch_id || res.user?.branch_id,
      partner_id: res.partner_id || res.user?.partner_id,
    };
  } catch (err: any) {
    if (!isDev) {
      throw new Error(err.message || "OTP verification failed. Please try again.");
    }
    // Development fallback only
    const fallbackRole = detected.role === "admin" ? "SUPER_ADMIN" : (detected.role === "shop" ? "BRANCH_MANAGER" : (detected.role === "delivery_partner" ? "DELIVERY_PARTNER" : "CUSTOMER"));
    return {
      customer_id: `cus_${phone.replace(/\D/g, "").slice(-10)}`,
      customer_uid: `cth_cus_${phone.replace(/\D/g, "").slice(-10)}`,
      is_new_customer: false,
      token: "mock_jwt_token_for_dev",
      detected_role: detected.role,
      role: fallbackRole,
    };
  }
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

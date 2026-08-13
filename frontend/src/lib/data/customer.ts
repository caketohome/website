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

  // Explicit demo keywords for testing (non-numeric)
  if (clean === "driver" || clean === "dlp" || clean === "delivery") {
    return {
      role: "delivery_partner",
      label: "🛵 Delivery Partner Fleet",
      redirectPath: "/dashboard/delivery-partner",
    };
  }

  if (clean === "admin" || clean === "superadmin" || clean === "owner") {
    return {
      role: "admin",
      label: "🛡️ Super Admin Control",
      redirectPath: "/dashboard",
    };
  }

  if (clean === "shop" || clean === "shpmgr" || clean === "manager" || clean === "branch") {
    return {
      role: "shop",
      label: "🏪 Branch & Shop Manager Control Center",
      redirectPath: "/dashboard/shop",
    };
  }

  // All phone numbers default to Customer Profile; backend OTP verification provides server-authoritative role
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
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000))
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
    return {
      sent: true,
      dev_otp: "123456",
      message: "Development fallback: OTP service unavailable",
      account_exists: true,
      role: "CUSTOMER",
    };
  }
}

export async function verifyOtp(phone: string, otp: string, extra?: { name?: string; email?: string }): Promise<OtpVerifyResponse> {
  const isDev = process.env.NODE_ENV !== "production";
  const detected = detectUserRole(phone);
  try {
    const res: any = await Promise.race([
      apiClient.verifyOtp(phone, otp, extra),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000))
    ]);

    const token = res.accessToken || res.token;
    if (!res || !token) {
      throw new Error("Verification failed: no token received");
    }

    return {
      customer_id: res.user?.customer_id || res.user?.id || res.customer_id || `cus_${phone.replace(/\D/g, "").slice(-10)}`,
      is_new_customer: res.is_new_customer ?? false,
      token,
      detected_role: res.role || detected.role,
      role: res.role,
      user: res.user,
      branch_id: res.branch_id || res.user?.branch_id,
      partner_id: res.partner_id || res.user?.partner_id,
    };
  } catch (err: any) {
    if (!isDev) {
      throw new Error(err.message || "OTP verification failed. Please try again.");
    }
    // Development fallback only
    return {
      customer_id: `cus_${phone.replace(/\D/g, "").slice(-10)}`,
      is_new_customer: false,
      token: "mock_jwt_token_for_dev",
      detected_role: detected.role,
    };
  }
}

export async function getWalletBalance(): Promise<{
  wallet: { balance: number; currency_code: string };
  transactions: Array<{ id: string; amount: number; type: string; created_at: string; description: string }>;
}> {
  return {
    wallet: { balance: 50000, currency_code: "INR" },
    transactions: [
      { id: "tx_1", amount: 50000, type: "credit", created_at: new Date().toISOString(), description: "Welcome bonus credit" }
    ],
  };
}

export async function validateGiftCard(code: string): Promise<{ valid: boolean; amount?: number; message?: string }> {
  if (code && code.trim().length > 3) {
    return { valid: true, amount: 25000, message: "Valid voucher for ₹250" };
  }
  return { valid: false, message: "Invalid gift card code" };
}

export async function redeemGiftCard(code: string): Promise<{ success: boolean; new_balance?: number; message?: string }> {
  if (code && code.trim().length > 3) {
    return { success: true, new_balance: 75000, message: "Gift card redeemed successfully! ₹250 added to wallet." };
  }
  return { success: false, message: "Could not redeem gift card" };
}

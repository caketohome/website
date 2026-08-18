/**
 * CakeToHome Client-Safe Customer Data Layer
 */

import { apiClient } from "../api-client";

const isDev = process.env.NODE_ENV !== "production";

export interface OtpRequestResponse {
  sent: boolean;
  dev_otp?: string;
  message: string;
}

export interface OtpVerifyResponse {
  customer_id: string;
  customer_uid?: string;
  is_new_customer: boolean;
  token?: string;
  role?: string;
  detected_role?: string;
  user?: any;
  branch_id?: string;
  partner_id?: string;
}

export async function requestOtp(phone: string): Promise<OtpRequestResponse> {
  try {
    const res = await apiClient.requestOtp(phone);
    return {
      sent: true,
      dev_otp: isDev ? res.dev_otp : undefined,
      message: "OTP sent",
    };
  } catch (err: any) {
    if (!isDev) {
      throw new Error(err.message || "Failed to send OTP.");
    }
    return { sent: true, dev_otp: "123456", message: "Development fallback: OTP service unavailable" };
  }
}

export async function verifyOtp(phone: string, otp: string): Promise<OtpVerifyResponse> {
  try {
    const res: any = await apiClient.verifyOtp(phone, otp);
    return {
      customer_id: res.customer_id || res.user?.id || `cus_${phone.replace(/\D/g, "")}`,
      is_new_customer: res.is_new_customer ?? false,
      token: res.accessToken || res.token,
    };
  } catch (err: any) {
    if (!isDev) {
      throw new Error(err.message || "OTP verification failed.");
    }
    return { customer_id: "cus_9876543210", is_new_customer: false, token: "mock_jwt_token_for_dev" };
  }
}

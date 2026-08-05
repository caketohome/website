import { CustomerRole } from "./customer.constants";

export interface OtpRequestInput {
  phone: string;
}

export interface OtpRequestResult {
  sent: boolean;
  message: string;
  dev_otp?: string;
}

export interface OtpVerifyInput {
  phone: string;
  otp: string;
}

export interface OtpVerifyResult {
  customer_id: string;
  is_new_customer: boolean;
  token: string;
  detected_role: CustomerRole;
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
  pincode: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  is_default_shipping?: boolean;
  is_default_billing?: boolean;
}

export interface CustomerAuthPayload {
  customer_id: string;
  phone: string;
  role: CustomerRole;
}

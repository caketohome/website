/**
 * Shared types for the Customer module.
 */

export interface OtpRequestInput {
    phone: string;
    /** Optional context for rate-limiting / analytics. */
    ip?: string;
    user_agent?: string;
}

export interface OtpVerifyInput {
    phone: string;
    otp: string;
    ip?: string;
    user_agent?: string;
    device?: string;
}

export interface OtpVerifyResult {
    success: boolean;
    /** The customer_id to issue an auth token for. */
    customer_id?: string;
    /** Whether this verification created a brand-new customer. */
    is_new_customer?: boolean;
    error?: string;
}

export interface AddressInput {
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
    country?: string;
    latitude?: number | null;
    longitude?: number | null;
    is_default_shipping?: boolean;
    is_default_billing?: boolean;
}

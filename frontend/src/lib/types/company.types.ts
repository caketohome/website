/**
 * CakeToHome ERP — Company & GST Registration Types
 * Phase A: Database-backed legal entity and GST registration master data.
 *
 * REPLACES: Hardcoded "company_default" string across 9 files.
 * CONSTRAINTS: INR only, Indian FY (April-March), real GSTIN validation.
 */

// ─── Company Row (maps to public.company) ──────────────────────────────────────

export interface CompanyRow {
  id: string;
  legal_name: string;
  trade_name: string | null;
  registered_address: string | null;
  city: string | null;
  state_code: string;
  pin_code: string | null;
  pan: string | null;
  cin: string | null;
  fssai: string | null;
  currency: string; // Always 'INR'
  fy_start_month: number; // 4 = April
  invoice_prefix: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanyCreateInput {
  legal_name: string;
  trade_name?: string;
  registered_address?: string;
  city?: string;
  state_code: string;
  pin_code?: string;
  pan?: string;
  cin?: string;
  fssai?: string;
  invoice_prefix?: string;
  phone?: string;
  email?: string;
  website?: string;
}

export interface CompanyUpdateInput {
  legal_name?: string;
  trade_name?: string;
  registered_address?: string;
  city?: string;
  state_code?: string;
  pin_code?: string;
  pan?: string;
  cin?: string;
  fssai?: string;
  invoice_prefix?: string;
  phone?: string;
  email?: string;
  website?: string;
  is_active?: boolean;
}

// ─── GST Registration Row (maps to public.gst_registration) ────────────────────

export type GstRegistrationType =
  | "REGULAR"
  | "COMPOSITION"
  | "ISD"
  | "CASUAL"
  | "SEZ"
  | "NRTP";

export interface GstRegistrationRow {
  id: string;
  company_id: string;
  gstin: string;
  state_code: string;
  registration_type: GstRegistrationType;
  legal_name: string | null;
  is_active: boolean;
  effective_from: string | null;
  effective_to: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface GstRegistrationCreateInput {
  company_id: string;
  gstin: string;
  state_code: string;
  registration_type?: GstRegistrationType;
  legal_name?: string;
  effective_from?: string;
}

export interface GstRegistrationUpdateInput {
  registration_type?: GstRegistrationType;
  legal_name?: string;
  is_active?: boolean;
  effective_from?: string;
  effective_to?: string;
}

// ─── Service Response Types ────────────────────────────────────────────────────

export type CompanyServiceErrorCode =
  | "UNAUTHORIZED"
  | "COMPANY_NOT_FOUND"
  | "COMPANY_ALREADY_EXISTS"
  | "VALIDATION_FAILED"
  | "INVALID_PAN"
  | "INVALID_STATE_CODE"
  | "OPERATION_FAILED";

export type GstServiceErrorCode =
  | "UNAUTHORIZED"
  | "GST_NOT_FOUND"
  | "DUPLICATE_GSTIN"
  | "INVALID_GSTIN"
  | "INVALID_STATE_CODE"
  | "STATE_MISMATCH"
  | "COMPANY_NOT_FOUND"
  | "VALIDATION_FAILED"
  | "OPERATION_FAILED";

export type CompanyApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: CompanyServiceErrorCode };

export type GstApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: GstServiceErrorCode };

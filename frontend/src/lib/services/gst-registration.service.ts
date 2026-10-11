/**
 * CakeToHome ERP — GST Registration Service
 * Phase A: Business logic for GST registration management.
 *
 * KEY RULES:
 * - Only SUPER_ADMIN can create, update, or deactivate GST registrations.
 * - GSTIN format validated: 2-digit state + PAN-based + entity + check.
 * - First 2 digits of GSTIN must match the state_code field.
 * - Company must exist before GST registration can be created.
 * - No fake GSTIN fallback. No hardcoded values.
 * - PostgreSQL → Repository → Service → API → UI.
 */

import { GstRegistrationRepository } from "../repositories/gst-registration.repository";
import { CompanyRepository } from "../repositories/company.repository";
import type {
  GstRegistrationRow,
  GstRegistrationCreateInput,
  GstRegistrationUpdateInput,
  GstApiResponse,
  GstServiceErrorCode,
} from "../types/company.types";

// ─── Validation ────────────────────────────────────────────────────────────────

/** Standard Indian GSTIN: 2-digit state + 10-char PAN + 1 entity + 1 check + 1 default */
const GSTIN_REGEX = /^\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z0-9][A-Z0-9]$/;
const STATE_CODE_REGEX = /^\d{2}$/;

function validateGstInput(input: GstRegistrationCreateInput): string | null {
  if (!input.company_id?.trim()) {
    return "Company ID is required.";
  }
  if (!input.gstin?.trim()) {
    return "GSTIN is required.";
  }
  const gstin = input.gstin.trim().toUpperCase();
  if (!GSTIN_REGEX.test(gstin)) {
    return `Invalid GSTIN format '${input.gstin}'. Expected 15-character Indian GSTIN (e.g., 29AAAAA0000A1Z5).`;
  }
  if (!input.state_code?.trim()) {
    return "State code is required.";
  }
  if (!STATE_CODE_REGEX.test(input.state_code.trim())) {
    return `Invalid state code '${input.state_code}'. Must be 2-digit Indian state code.`;
  }
  // State code must match first 2 chars of GSTIN
  if (gstin.substring(0, 2) !== input.state_code.trim()) {
    return `State code '${input.state_code}' does not match GSTIN prefix '${gstin.substring(0, 2)}'. The first 2 digits of GSTIN must equal the state code.`;
  }
  return null;
}

// ─── GST Registration Service ──────────────────────────────────────────────────

export class GstRegistrationServiceError extends Error {
  readonly code: GstServiceErrorCode;

  constructor(code: GstServiceErrorCode, message: string) {
    super(message);
    this.name = "GstRegistrationServiceError";
    this.code = code;
  }
}

export class GstRegistrationService {
  /**
   * List all GST registrations for the active company.
   */
  static async listRegistrations(
    companyId: string,
    activeOnly: boolean = false,
  ): Promise<GstApiResponse<GstRegistrationRow[]>> {
    try {
      const rows = await GstRegistrationRepository.listByCompany(companyId, activeOnly);
      return { success: true, data: rows };
    } catch (e: any) {
      return { success: false, error: `Failed to list GST registrations: ${e.message}` };
    }
  }

  /**
   * Get a specific GST registration by ID.
   */
  static async getRegistration(id: string): Promise<GstApiResponse<GstRegistrationRow>> {
    try {
      const row = await GstRegistrationRepository.findById(id);
      if (!row) {
        return { success: false, error: `GST registration '${id}' not found.`, code: "GST_NOT_FOUND" };
      }
      return { success: true, data: row };
    } catch (e: any) {
      return { success: false, error: `Failed to retrieve GST registration: ${e.message}` };
    }
  }

  /**
   * Resolve GSTIN for a given state code (Place of Supply).
   * Used by invoicing to determine the correct seller GSTIN.
   */
  static async resolveGstinForState(
    companyId: string,
    stateCode: string,
  ): Promise<GstApiResponse<GstRegistrationRow>> {
    try {
      const row = await GstRegistrationRepository.findByStateCode(companyId, stateCode);
      if (!row) {
        return {
          success: false,
          error: `No active GST registration found for state '${stateCode}'. Register the company's GSTIN for this state.`,
          code: "GST_NOT_FOUND",
        };
      }
      return { success: true, data: row };
    } catch (e: any) {
      return { success: false, error: `Failed to resolve GSTIN: ${e.message}` };
    }
  }

  /**
   * Create a new GST registration.
   */
  static async createRegistration(
    input: GstRegistrationCreateInput,
    actorId: string,
    actorRole: string,
  ): Promise<GstApiResponse<GstRegistrationRow>> {
    // 1. Authorization
    if (actorRole !== "SUPER_ADMIN") {
      return {
        success: false,
        error: "Only Super Admin can create GST registrations.",
        code: "UNAUTHORIZED",
      };
    }

    // 2. Validate input
    const validationError = validateGstInput(input);
    if (validationError) {
      return { success: false, error: validationError, code: "VALIDATION_FAILED" };
    }

    // 3. Verify company exists
    const company = await CompanyRepository.findById(input.company_id);
    if (!company) {
      return {
        success: false,
        error: `Company '${input.company_id}' not found. Create the company master first.`,
        code: "COMPANY_NOT_FOUND",
      };
    }

    // 4. Check for duplicate GSTIN
    const existingGstin = await GstRegistrationRepository.findByGstin(input.gstin.trim().toUpperCase());
    if (existingGstin) {
      return {
        success: false,
        error: `GSTIN '${input.gstin.toUpperCase()}' is already registered (ID: ${existingGstin.id}).`,
        code: "DUPLICATE_GSTIN",
      };
    }

    // 5. Create
    try {
      const row = await GstRegistrationRepository.create(input, actorId);
      return { success: true, data: row };
    } catch (e: any) {
      if (e.code === "23505") {
        return {
          success: false,
          error: `GSTIN '${input.gstin}' already exists.`,
          code: "DUPLICATE_GSTIN",
        };
      }
      if (e.code === "23514" && e.constraint?.includes("gstin")) {
        return {
          success: false,
          error: `Invalid GSTIN format.`,
          code: "INVALID_GSTIN",
        };
      }
      return { success: false, error: `Failed to create GST registration: ${e.message}`, code: "OPERATION_FAILED" };
    }
  }

  /**
   * Update a GST registration.
   */
  static async updateRegistration(
    id: string,
    input: GstRegistrationUpdateInput,
    actorId: string,
    actorRole: string,
  ): Promise<GstApiResponse<GstRegistrationRow>> {
    // 1. Authorization
    if (actorRole !== "SUPER_ADMIN") {
      return {
        success: false,
        error: "Only Super Admin can update GST registrations.",
        code: "UNAUTHORIZED",
      };
    }

    // 2. Verify exists
    const existing = await GstRegistrationRepository.findById(id);
    if (!existing) {
      return { success: false, error: `GST registration '${id}' not found.`, code: "GST_NOT_FOUND" };
    }

    // 3. Update
    try {
      const updated = await GstRegistrationRepository.update(id, input);
      if (!updated) {
        return { success: false, error: "GST registration not found after update.", code: "GST_NOT_FOUND" };
      }
      return { success: true, data: updated };
    } catch (e: any) {
      return { success: false, error: `Failed to update GST registration: ${e.message}`, code: "OPERATION_FAILED" };
    }
  }
}

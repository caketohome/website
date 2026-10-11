/**
 * CakeToHome ERP — Company Service
 * Phase A: Business logic for the Company Master.
 *
 * KEY RULES:
 * - Only SUPER_ADMIN can create, update, or deactivate the company.
 * - CakeToHome operates as a single legal entity (singleton enforced by DB).
 * - Currency is locked to INR. FY start month locked to April (4).
 * - PAN format validated: AAAAA9999A.
 * - State code validated: 2-digit Indian state code.
 * - No mock data. No static arrays. No JSON imports.
 * - PostgreSQL → Repository → Service → API → UI.
 */

import { CompanyRepository } from "../repositories/company.repository";
import type {
  CompanyRow,
  CompanyCreateInput,
  CompanyUpdateInput,
  CompanyApiResponse,
  CompanyServiceErrorCode,
} from "../types/company.types";

// ─── Validation Helpers ────────────────────────────────────────────────────────

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const STATE_CODE_REGEX = /^\d{2}$/;

function validateCompanyInput(
  input: CompanyCreateInput | CompanyUpdateInput,
  isCreate: boolean,
): string | null {
  if (isCreate) {
    const ci = input as CompanyCreateInput;
    if (!ci.legal_name?.trim()) {
      return "Legal name is required.";
    }
    if (!ci.state_code?.trim()) {
      return "State code is required.";
    }
  }

  if (input.state_code !== undefined && !STATE_CODE_REGEX.test(input.state_code.trim())) {
    return `Invalid state code '${input.state_code}'. Must be a 2-digit Indian state code (e.g., '29' for Karnataka).`;
  }

  if (input.pan !== undefined && input.pan !== null && input.pan.trim() !== "") {
    if (!PAN_REGEX.test(input.pan.trim().toUpperCase())) {
      return `Invalid PAN format '${input.pan}'. Expected format: AAAAA9999A.`;
    }
  }

  return null;
}

// ─── Company Service ───────────────────────────────────────────────────────────

export class CompanyServiceError extends Error {
  readonly code: CompanyServiceErrorCode;

  constructor(code: CompanyServiceErrorCode, message: string) {
    super(message);
    this.name = "CompanyServiceError";
    this.code = code;
  }
}

export class CompanyService {
  /**
   * Get the active company configuration.
   * Returns null if not yet configured — this is NOT an error condition.
   */
  static async getCompany(): Promise<CompanyApiResponse<CompanyRow | null>> {
    try {
      const company = await CompanyRepository.getActiveCompany();
      return { success: true, data: company };
    } catch (e: any) {
      return { success: false, error: `Failed to retrieve company: ${e.message}` };
    }
  }

  /**
   * Create the company master.
   * Only one active company is allowed (singleton enforced by DB unique index).
   */
  static async createCompany(
    input: CompanyCreateInput,
    actorId: string,
    actorRole: string,
  ): Promise<CompanyApiResponse<CompanyRow>> {
    // 1. Authorization
    if (actorRole !== "SUPER_ADMIN") {
      return {
        success: false,
        error: "Only Super Admin can create the company master.",
        code: "UNAUTHORIZED",
      };
    }

    // 2. Validate input
    const validationError = validateCompanyInput(input, true);
    if (validationError) {
      return { success: false, error: validationError, code: "VALIDATION_FAILED" };
    }

    // 3. Check if company already exists
    const existing = await CompanyRepository.getActiveCompany();
    if (existing) {
      return {
        success: false,
        error: `Company already configured: '${existing.legal_name}' (${existing.id}). Use update instead.`,
        code: "COMPANY_ALREADY_EXISTS",
      };
    }

    // 4. Create
    try {
      const company = await CompanyRepository.create(input, actorId);
      return { success: true, data: company };
    } catch (e: any) {
      // Handle DB constraint violations gracefully
      if (e.code === "23505") {
        return {
          success: false,
          error: "An active company already exists. Only one company is allowed.",
          code: "COMPANY_ALREADY_EXISTS",
        };
      }
      if (e.code === "23514" && e.constraint?.includes("pan")) {
        return {
          success: false,
          error: `Invalid PAN format. Expected: AAAAA9999A.`,
          code: "INVALID_PAN",
        };
      }
      return { success: false, error: `Failed to create company: ${e.message}`, code: "OPERATION_FAILED" };
    }
  }

  /**
   * Update company master fields.
   */
  static async updateCompany(
    companyId: string,
    input: CompanyUpdateInput,
    actorId: string,
    actorRole: string,
  ): Promise<CompanyApiResponse<CompanyRow>> {
    // 1. Authorization
    if (actorRole !== "SUPER_ADMIN") {
      return {
        success: false,
        error: "Only Super Admin can update the company master.",
        code: "UNAUTHORIZED",
      };
    }

    // 2. Validate input
    const validationError = validateCompanyInput(input, false);
    if (validationError) {
      return { success: false, error: validationError, code: "VALIDATION_FAILED" };
    }

    // 3. Verify company exists
    const existing = await CompanyRepository.findById(companyId);
    if (!existing) {
      return {
        success: false,
        error: `Company '${companyId}' not found.`,
        code: "COMPANY_NOT_FOUND",
      };
    }

    // 4. Update
    try {
      const updated = await CompanyRepository.update(companyId, input);
      if (!updated) {
        return { success: false, error: "Company not found after update.", code: "COMPANY_NOT_FOUND" };
      }
      return { success: true, data: updated };
    } catch (e: any) {
      if (e.code === "23514" && e.constraint?.includes("pan")) {
        return {
          success: false,
          error: `Invalid PAN format. Expected: AAAAA9999A.`,
          code: "INVALID_PAN",
        };
      }
      return { success: false, error: `Failed to update company: ${e.message}`, code: "OPERATION_FAILED" };
    }
  }

  /**
   * Resolve the active company ID for use by other services.
   * This is the single canonical replacement for all "company_default" references.
   */
  static async resolveCompanyId(): Promise<string> {
    return CompanyRepository.resolveCompanyId();
  }
}

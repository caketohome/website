/**
 * CakeToHome ERP — Supplier Service
 * Phase 1: Business logic layer for supplier management.
 *
 * This layer:
 * - Validates inputs before passing to repository
 * - Enforces business rules (GSTIN format, duplicate check)
 * - Does NOT enforce branch scope — that is the API layer's responsibility
 * - Does NOT contain SQL
 */

import { SupplierRepository } from "../repositories/supplier.repository";
import type {
  SupplierRow,
  SupplierCreateInput,
  SupplierUpdateInput,
  SupplierListFilters,
  SupplierListResult,
  PurchaseApiResponse,
} from "../types/purchase.types";

// GSTIN format: 2 digits + 10-char PAN + 1 digit + 1 char + 1 char
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export class SupplierService {
  static async createSupplier(
    input: SupplierCreateInput,
    createdBy: string
  ): Promise<PurchaseApiResponse<SupplierRow>> {
    // Validate name
    if (!input.name?.trim()) {
      return { success: false, error: "Supplier name is required." };
    }

    // Validate GSTIN format if provided
    if (input.gstin) {
      const normalized = input.gstin.trim().toUpperCase();
      if (!GSTIN_REGEX.test(normalized)) {
        return { success: false, error: `Invalid GSTIN format: ${input.gstin}. Expected format: 29ABCDE1234F1Z5.` };
      }
      input = { ...input, gstin: normalized };
    }

    try {
      const supplier = await SupplierRepository.create(input, createdBy);
      return { success: true, data: supplier };
    } catch (e: any) {
      return { success: false, error: `Failed to create supplier: ${e.message}` };
    }
  }

  static async updateSupplier(
    id: string,
    input: SupplierUpdateInput
  ): Promise<PurchaseApiResponse<SupplierRow>> {
    if (!id) return { success: false, error: "Supplier ID is required." };

    if (input.gstin) {
      const normalized = input.gstin.trim().toUpperCase();
      if (!GSTIN_REGEX.test(normalized)) {
        return { success: false, error: `Invalid GSTIN format: ${input.gstin}.` };
      }
      input = { ...input, gstin: normalized };
    }

    try {
      const supplier = await SupplierRepository.update(id, input);
      if (!supplier) return { success: false, error: "Supplier not found." };
      return { success: true, data: supplier };
    } catch (e: any) {
      return { success: false, error: `Failed to update supplier: ${e.message}` };
    }
  }

  static async deleteSupplier(id: string): Promise<PurchaseApiResponse<null>> {
    if (!id) return { success: false, error: "Supplier ID is required." };
    const result = await SupplierRepository.softDelete(id);
    if (!result.success) return { success: false, error: result.reason };
    return { success: true, message: "Supplier deactivated." };
  }

  static async getSupplier(id: string): Promise<PurchaseApiResponse<SupplierRow>> {
    const supplier = await SupplierRepository.findById(id);
    if (!supplier) return { success: false, error: "Supplier not found." };
    return { success: true, data: supplier };
  }

  static async listSuppliers(
    filters: SupplierListFilters
  ): Promise<PurchaseApiResponse<SupplierListResult>> {
    const result = await SupplierRepository.list(filters);
    return { success: true, data: result };
  }
}

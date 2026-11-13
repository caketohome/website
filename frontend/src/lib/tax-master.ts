/**
 * CakeToHome — Client-Side Tax Master Service
 * Manages statutory GST tax configurations via the Admin API → PostgreSQL.
 *
 * IMPORTANT: All data is fetched from and persisted to PostgreSQL via /api/v1/admin/tax/*
 * No in-memory storage or hardcoded business data. Database errors are propagated explicitly.
 */

export interface TaxRegionRecord {
  id: string;
  country_code: string;
  province_code?: string | null;
  parent_id?: string | null;
  provider_id?: string | null;
  metadata?: {
    name?: string;
    state_name?: string;
    state_code?: string;
    jurisdiction?: string;
    [key: string]: any;
  } | null;
}

export interface TaxConfigurationRecord {
  id: string;
  name: string;
  code: string;
  description?: string;
  taxability: "Taxable" | "Exempt" | "Nil Rated" | "Non-GST";
  gstRatePct: number;
  cgstRatePct: number;
  sgstRatePct: number;
  igstRatePct: number;
  cessRatePct: number;
  taxInclusive: boolean;
  applicableSupplyType: "BOTH" | "INTRA-STATE" | "INTER-STATE";
  applicableCustomerType: "BOTH" | "B2B" | "B2C";
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
  usageCount?: number;
  isDefault?: boolean;
  countryCode?: string;
  provinceCode?: string;
  regionId?: string;
}

const API_BASE = "/api/v1";

function buildHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...(extra || {}) };
  if (typeof window !== "undefined") {
    try {
      const token =
        window.localStorage.getItem("cth_auth_token") ||
        window.localStorage.getItem("auth_token") ||
        window.localStorage.getItem("admin_token");
      if (token && !headers["Authorization"]) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    } catch {
      // Ignore storage access errors in restricted contexts
    }
  }
  return headers;
}

export class TaxMasterService {
  private static cachedConfigurations: TaxConfigurationRecord[] = [];
  private static cachedRegions: TaxRegionRecord[] = [];

  /**
   * Fetch all tax configurations from PostgreSQL via the API.
   * Throws an explicit Error if the API or database returns an error.
   */
  public static async fetchTaxConfigurations(): Promise<TaxConfigurationRecord[]> {
    const res = await fetch(`${API_BASE}/admin/tax/configurations`, {
      credentials: "include",
      headers: buildHeaders(),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.success === false) {
      throw new Error(data?.error || data?.message || `Failed to load tax configurations (HTTP ${res.status})`);
    }
    const configs: TaxConfigurationRecord[] = Array.isArray(data?.configurations) ? data.configurations : [];
    TaxMasterService.cachedConfigurations = configs;
    return configs;
  }

  /**
   * Save (create or update) a tax configuration to PostgreSQL.
   */
  public static async saveTaxConfiguration(
    record: Partial<TaxConfigurationRecord>
  ): Promise<{ success: boolean; id?: string; configuration?: TaxConfigurationRecord; error?: string }> {
    try {
      const method = record.id ? "PUT" : "POST";
      const res = await fetch(`${API_BASE}/admin/tax/configurations`, {
        method,
        credentials: "include",
        headers: buildHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          id: record.id || undefined,
          name: record.name,
          code: record.code,
          rate: record.gstRatePct,
          gstRatePct: record.gstRatePct,
          cgstRatePct: record.cgstRatePct,
          sgstRatePct: record.sgstRatePct,
          igstRatePct: record.igstRatePct,
          cessRatePct: record.cessRatePct ?? 0,
          taxability: record.taxability,
          applicableSupplyType: record.applicableSupplyType || "BOTH",
          applicableCustomerType: record.applicableCustomerType || "BOTH",
          taxInclusive: record.taxInclusive !== false,
          isActive: record.isActive !== false,
          effectiveFrom: record.effectiveFrom,
          effectiveTo: record.effectiveTo || null,
          is_default: record.isDefault ?? false,
          tax_region_id: record.regionId || undefined,
          metadata: {
            description: record.description,
            taxability: record.taxability,
            cgst_rate: record.cgstRatePct,
            sgst_rate: record.sgstRatePct,
            igst_rate: record.igstRatePct,
            cess_rate: record.cessRatePct ?? 0,
            tax_inclusive: record.taxInclusive !== false,
            supply_type: record.applicableSupplyType || "BOTH",
            customer_type: record.applicableCustomerType || "BOTH",
            effective_from: record.effectiveFrom,
            effective_to: record.effectiveTo || null,
            is_active: record.isActive !== false,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success !== true) {
        return {
          success: false,
          error: data?.error || data?.message || `Failed to save tax configuration (HTTP ${res.status})`,
        };
      }
      await TaxMasterService.fetchTaxConfigurations();
      return {
        success: true,
        id: data?.id,
        configuration: data?.configuration,
      };
    } catch (err: any) {
      console.error("[TaxMasterService] Failed to save tax configuration:", err);
      return { success: false, error: err?.message || "Network error while saving tax configuration." };
    }
  }

  /**
   * Toggle active/inactive status for a tax configuration.
   */
  public static async toggleActive(
    id: string,
    isActive: boolean
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/admin/tax/configurations/toggle`, {
        method: "POST",
        credentials: "include",
        headers: buildHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ id, is_active: isActive }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success !== true) {
        return {
          success: false,
          error: data?.error || data?.message || `Failed to toggle tax configuration (HTTP ${res.status})`,
        };
      }
      await TaxMasterService.fetchTaxConfigurations();
      return { success: true };
    } catch (err: any) {
      console.error("[TaxMasterService] Failed to toggle tax configuration:", err);
      return { success: false, error: err?.message || "Failed to toggle tax configuration." };
    }
  }

  /**
   * Assign an authoritative tax rate from public.tax_rate to a product in PostgreSQL.
   */
  public static async assignProductTax(
    productId: string,
    taxRateId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/admin/tax/assign-product`, {
        method: "POST",
        credentials: "include",
        headers: buildHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ productId, taxRateId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success !== true) {
        return {
          success: false,
          error: data?.error || data?.message || `Failed to assign product tax (HTTP ${res.status})`,
        };
      }
      return { success: true };
    } catch (err: any) {
      console.error("[TaxMasterService] Failed to assign product tax:", err);
      return { success: false, error: err?.message || "Failed to assign product tax." };
    }
  }

  /**
   * Fetch tax regions from PostgreSQL.
   * Throws an explicit Error if the API or database returns an error.
   */
  public static async fetchTaxRegions(): Promise<TaxRegionRecord[]> {
    const res = await fetch(`${API_BASE}/admin/tax/regions`, {
      credentials: "include",
      headers: buildHeaders(),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.success === false) {
      throw new Error(data?.error || data?.message || `Failed to load tax regions (HTTP ${res.status})`);
    }
    const regions: TaxRegionRecord[] = Array.isArray(data?.regions) ? data.regions : [];
    TaxMasterService.cachedRegions = regions;
    return regions;
  }

  /**
   * Synchronous accessor returning cached PostgreSQL tax configurations.
   */
  public static listTaxConfigurations(): TaxConfigurationRecord[] {
    return TaxMasterService.cachedConfigurations;
  }

  public static listTaxRegions(): TaxRegionRecord[] {
    return TaxMasterService.cachedRegions;
  }

  public static getTaxConfigurationById(id: string): TaxConfigurationRecord | undefined {
    return TaxMasterService.cachedConfigurations.find((c) => c.id === id);
  }

  public static getTaxConfigurationByCode(code: string): TaxConfigurationRecord | undefined {
    return TaxMasterService.cachedConfigurations.find((c) => c.code === code);
  }
}

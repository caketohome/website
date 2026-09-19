/**
 * CakeToHome — Client-Side Tax Master Service
 * Manages statutory GST tax configurations via the Admin API → PostgreSQL.
 *
 * IMPORTANT: All data is fetched from and persisted to PostgreSQL via /api/v1/admin/tax/*
 * No in-memory storage or hardcoded business data.
 */

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
  regionId?: string;
}

const API_BASE = "/api/v1";

export class TaxMasterService {
  /**
   * Fetch all tax configurations from PostgreSQL via the API.
   */
  public static async fetchTaxConfigurations(): Promise<TaxConfigurationRecord[]> {
    try {
      const res = await fetch(`${API_BASE}/admin/tax/configurations`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data?.configurations || [];
    } catch (err) {
      console.error("[TaxMasterService] Failed to fetch tax configurations:", err);
      return [];
    }
  }

  /**
   * Save (create or update) a tax configuration to PostgreSQL.
   */
  public static async saveTaxConfiguration(
    record: Partial<TaxConfigurationRecord>
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/admin/tax/configurations`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: record.id || undefined,
          name: record.name,
          code: record.code,
          rate: record.gstRatePct,
          is_default: record.isDefault ?? false,
          tax_region_id: record.regionId,
          metadata: {
            description: record.description,
            cess_rate: record.cessRatePct ?? 0,
            tax_inclusive: record.taxInclusive !== false,
            supply_type: record.applicableSupplyType || "BOTH",
            customer_type: record.applicableCustomerType || "BOTH",
            effective_from: record.effectiveFrom,
            effective_to: record.effectiveTo,
            taxability: record.taxability,
          },
        }),
      });
      const data = await res.json();
      return { success: data?.success === true, id: data?.id, error: data?.error };
    } catch (err: any) {
      console.error("[TaxMasterService] Failed to save tax configuration:", err);
      return { success: false, error: err.message };
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, is_active: isActive }),
      });
      const data = await res.json();
      return { success: data?.success === true, error: data?.error };
    } catch (err: any) {
      console.error("[TaxMasterService] Failed to toggle tax configuration:", err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Fetch tax regions from PostgreSQL.
   */
  public static async fetchTaxRegions(): Promise<any[]> {
    try {
      const res = await fetch(`${API_BASE}/admin/tax/regions`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data?.regions || [];
    } catch (err) {
      console.error("[TaxMasterService] Failed to fetch tax regions:", err);
      return [];
    }
  }

  // ── Deprecated synchronous methods for backward compatibility ──
  // These now return empty arrays. Use the async methods above.
  public static listTaxConfigurations(): TaxConfigurationRecord[] {
    console.warn("[TaxMasterService] listTaxConfigurations() is deprecated. Use fetchTaxConfigurations() instead.");
    return [];
  }

  public static getTaxConfigurationById(id: string): TaxConfigurationRecord | undefined {
    console.warn("[TaxMasterService] getTaxConfigurationById() is deprecated.");
    return undefined;
  }

  public static getTaxConfigurationByCode(code: string): TaxConfigurationRecord | undefined {
    console.warn("[TaxMasterService] getTaxConfigurationByCode() is deprecated.");
    return undefined;
  }
}

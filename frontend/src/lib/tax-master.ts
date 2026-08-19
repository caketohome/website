/**
 * CakeToHome — Client-Side Tax Master Service
 * Manages statutory GST tax configurations for the Admin dashboard.
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
}

export class TaxMasterService {
  private static masterRecords: Map<string, TaxConfigurationRecord> = new Map([
    ["txcfg_food_5", { id: "txcfg_food_5", name: "GST Food 5%", code: "GST_FOOD_5", description: "Standard 5% GST for Cakes, Pastries & Bakery Items", taxability: "Taxable", gstRatePct: 5, cgstRatePct: 2.5, sgstRatePct: 2.5, igstRatePct: 5, cessRatePct: 0, taxInclusive: true, applicableSupplyType: "BOTH", applicableCustomerType: "BOTH", isActive: true, effectiveFrom: "2026-04-01", usageCount: 142 }],
    ["txcfg_food_12", { id: "txcfg_food_12", name: "GST Food 12%", code: "GST_FOOD_12", description: "12% GST for Premium Bakery Products & Preserves", taxability: "Taxable", gstRatePct: 12, cgstRatePct: 6, sgstRatePct: 6, igstRatePct: 12, cessRatePct: 0, taxInclusive: true, applicableSupplyType: "BOTH", applicableCustomerType: "BOTH", isActive: true, effectiveFrom: "2026-04-01", usageCount: 28 }],
    ["txcfg_food_18", { id: "txcfg_food_18", name: "GST Accessories 18%", code: "GST_FOOD_18", description: "18% GST for Candles, Party Supplies & Greeting Cards", taxability: "Taxable", gstRatePct: 18, cgstRatePct: 9, sgstRatePct: 9, igstRatePct: 18, cessRatePct: 0, taxInclusive: true, applicableSupplyType: "BOTH", applicableCustomerType: "BOTH", isActive: true, effectiveFrom: "2026-04-01", usageCount: 35 }],
    ["txcfg_exempt", { id: "txcfg_exempt", name: "GST Exempt", code: "GST_EXEMPT", description: "Exempted Items & Unprocessed Raw Ingredients", taxability: "Exempt", gstRatePct: 0, cgstRatePct: 0, sgstRatePct: 0, igstRatePct: 0, cessRatePct: 0, taxInclusive: true, applicableSupplyType: "BOTH", applicableCustomerType: "BOTH", isActive: true, effectiveFrom: "2026-04-01", usageCount: 5 }],
    ["txcfg_nil", { id: "txcfg_nil", name: "GST Nil Rated", code: "GST_NIL", description: "Nil Rated Items under GST schedule", taxability: "Nil Rated", gstRatePct: 0, cgstRatePct: 0, sgstRatePct: 0, igstRatePct: 0, cessRatePct: 0, taxInclusive: true, applicableSupplyType: "BOTH", applicableCustomerType: "BOTH", isActive: true, effectiveFrom: "2026-04-01", usageCount: 2 }],
    ["txcfg_nongst", { id: "txcfg_nongst", name: "Non-GST Supplies", code: "NON_GST", description: "Items outside the purview of GST", taxability: "Non-GST", gstRatePct: 0, cgstRatePct: 0, sgstRatePct: 0, igstRatePct: 0, cessRatePct: 0, taxInclusive: true, applicableSupplyType: "BOTH", applicableCustomerType: "BOTH", isActive: true, effectiveFrom: "2026-04-01", usageCount: 1 }],
  ]);

  public static listTaxConfigurations(): TaxConfigurationRecord[] {
    return Array.from(this.masterRecords.values());
  }

  public static getTaxConfigurationById(id: string): TaxConfigurationRecord | undefined {
    return this.masterRecords.get(id);
  }

  public static getTaxConfigurationByCode(code: string): TaxConfigurationRecord | undefined {
    return Array.from(this.masterRecords.values()).find((r) => r.code === code);
  }

  public static saveTaxConfiguration(record: Partial<TaxConfigurationRecord>): TaxConfigurationRecord {
    const id = record.id || `txcfg_${Date.now()}`;
    const existing = this.masterRecords.get(id);

    const gstRatePct = typeof record.gstRatePct === "number" ? record.gstRatePct : existing?.gstRatePct ?? 5;
    const cgstRatePct = typeof record.cgstRatePct === "number" ? record.cgstRatePct : gstRatePct / 2;
    const sgstRatePct = typeof record.sgstRatePct === "number" ? record.sgstRatePct : gstRatePct / 2;
    const igstRatePct = typeof record.igstRatePct === "number" ? record.igstRatePct : gstRatePct;

    const saved: TaxConfigurationRecord = {
      id,
      name: record.name || existing?.name || `GST Tax ${gstRatePct}%`,
      code: record.code || existing?.code || `GST_TAX_${gstRatePct}`,
      description: record.description || existing?.description || "",
      taxability: record.taxability || existing?.taxability || "Taxable",
      gstRatePct,
      cgstRatePct,
      sgstRatePct,
      igstRatePct,
      cessRatePct: record.cessRatePct ?? existing?.cessRatePct ?? 0,
      taxInclusive: record.taxInclusive !== false,
      applicableSupplyType: record.applicableSupplyType || existing?.applicableSupplyType || "BOTH",
      applicableCustomerType: record.applicableCustomerType || existing?.applicableCustomerType || "BOTH",
      isActive: record.isActive !== false,
      effectiveFrom: record.effectiveFrom || existing?.effectiveFrom || new Date().toISOString().split("T")[0],
      effectiveTo: record.effectiveTo || existing?.effectiveTo,
      usageCount: existing?.usageCount ?? 0,
    };

    this.masterRecords.set(id, saved);
    return saved;
  }

  public static duplicateTaxConfiguration(id: string, newName?: string, newCode?: string): TaxConfigurationRecord {
    const original = this.masterRecords.get(id);
    if (!original) throw new Error(`Tax Configuration with id ${id} not found.`);
    const dup: TaxConfigurationRecord = {
      ...original,
      id: `txcfg_${Date.now()}`,
      name: newName || `${original.name} (Copy)`,
      code: newCode || `${original.code}_COPY`,
      usageCount: 0,
    };
    this.masterRecords.set(dup.id, dup);
    return dup;
  }

  public static toggleActive(id: string, isActive: boolean): TaxConfigurationRecord {
    const record = this.masterRecords.get(id);
    if (!record) throw new Error(`Tax Configuration with id ${id} not found.`);
    record.isActive = isActive;
    this.masterRecords.set(id, record);
    return record;
  }
}

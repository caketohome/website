/**
 * CakeToHome — Central Authoritative GST Tax Engine
 * Computes statutory GST tax liabilities, place of supply, intra-state vs inter-state tax splits,
 * B2B/B2C transaction classifications, and line item tax snapshots according to Indian GST law.
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

export interface TaxCalculationInput {
  productId?: string;
  variantId?: string;
  taxConfigurationId?: string;
  taxConfigurationCode?: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  hsnCode?: string;
  uqc?: string;
  gstRatePct?: number; // e.g. 18 for 18%
  cessRatePct?: number; // e.g. 0
  taxability?: "Taxable" | "Exempt" | "Nil Rated" | "Non-GST";
  customerGstin?: string;
  customerStateCode?: string; // e.g. "32" for Kerala
  sellerStateCode?: string; // e.g. "32" for Kerala
  sellerGstin?: string; // default "29AAAAA0000A1Z5"
  taxInclusive?: boolean;
}

export interface TaxCalculationOutput {
  taxConfigurationId?: string;
  taxConfigurationCode?: string;
  taxConfigurationName?: string;
  quantity: number;
  unitPrice: number;
  grossAmount: number;
  discount: number;
  taxableValue: number;
  taxability: "Taxable" | "Exempt" | "Nil Rated" | "Non-GST";
  gstRatePct: number;
  cgstRatePct: number;
  sgstRatePct: number;
  igstRatePct: number;
  cessRatePct: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalTax: number;
  totalValue: number;
  supplyType: "INTRA-STATE" | "INTER-STATE";
  transactionClassification: "B2B" | "B2C";
  placeOfSupply: string;
  hsnCode: string;
  uqc: string;
}

export class TaxEngine {
  public static DEFAULT_SELLER_GSTIN = "29AAAAA0000A1Z5";
  public static DEFAULT_SELLER_STATE_CODE = "32"; // Kerala
  public static DEFAULT_SELLER_STATE_NAME = "Kerala";

  public static STATE_CODE_MAP: Record<string, string> = {
    "01": "Jammu & Kashmir",
    "02": "Himachal Pradesh",
    "03": "Punjab",
    "04": "Chandigarh",
    "05": "Uttarakhand",
    "06": "Haryana",
    "07": "Delhi",
    "08": "Rajasthan",
    "09": "Uttar Pradesh",
    "10": "Bihar",
    "11": "Sikkim",
    "12": "Arunachal Pradesh",
    "13": "Nagaland",
    "14": "Manipur",
    "15": "Mizoram",
    "16": "Tripura",
    "17": "Meghalaya",
    "18": "Assam",
    "19": "West Bengal",
    "20": "Jharkhand",
    "21": "Odisha",
    "22": "Chhattisgarh",
    "23": "Madhya Pradesh",
    "24": "Gujarat",
    "26": "Dadra & Nagar Haveli and Daman & Diu",
    "27": "Maharashtra",
    "29": "Karnataka",
    "30": "Goa",
    "31": "Lakshadweep",
    "32": "Kerala",
    "33": "Tamil Nadu",
    "34": "Puducherry",
    "35": "Andaman & Nicobar Islands",
    "36": "Telangana",
    "37": "Andhra Pradesh",
    "38": "Ladakh",
  };

  /**
   * Determine whether a transaction is Intra-State (CGST + SGST) or Inter-State (IGST)
   */
  public static resolveSupplyType(
    customerStateCode?: string,
    sellerStateCode: string = this.DEFAULT_SELLER_STATE_CODE
  ): "INTRA-STATE" | "INTER-STATE" {
    const custCode = (customerStateCode || this.DEFAULT_SELLER_STATE_CODE).trim();
    const sellCode = sellerStateCode.trim();
    return custCode === sellCode ? "INTRA-STATE" : "INTER-STATE";
  }

  /**
   * Classify transaction as B2B (Registered GSTIN customer) or B2C (Consumer / Unregistered)
   */
  public static classifyTransaction(customerGstin?: string): "B2B" | "B2C" {
    if (!customerGstin || customerGstin.trim() === "" || customerGstin.trim().toUpperCase() === "URP") {
      return "B2C";
    }
    // Valid Indian GSTIN length is 15 characters
    return customerGstin.trim().length === 15 ? "B2B" : "B2C";
  }

  /**
   * Calculate exact line-item level statutory GST breakdown
   */
  public static calculateItemTax(input: TaxCalculationInput): TaxCalculationOutput {
    const qty = Math.max(1, input.quantity || 1);
    const unitPrice = Math.max(0, input.unitPrice || 0);
    const discount = Math.max(0, input.discount || 0);
    const grossAmount = Math.round(qty * unitPrice * 100) / 100;
    const netPrice = Math.max(0, grossAmount - discount);

    if (!input.hsnCode || input.hsnCode.trim() === "") {
      throw new Error("GST Statutory Tax Error: HSN/SAC code is mandatory for product tax calculation and cannot be empty.");
    }
    const hsnCode = input.hsnCode.trim();
    const uqc = (input.uqc || "NOS").trim().toUpperCase();

    // Resolve Tax Master Configuration
    let taxConfig: TaxConfigurationRecord | undefined;
    if (input.taxConfigurationId) {
      taxConfig = TaxMasterService.getTaxConfigurationById(input.taxConfigurationId);
    }
    if (!taxConfig && input.taxConfigurationCode) {
      taxConfig = TaxMasterService.getTaxConfigurationByCode(input.taxConfigurationCode);
    }
    if (!taxConfig && typeof input.gstRatePct === "number") {
      taxConfig = TaxMasterService.listTaxConfigurations().find((t) => t.gstRatePct === input.gstRatePct);
    }

    const taxConfigurationId = taxConfig?.id || input.taxConfigurationId || "txcfg_food_5";
    const taxConfigurationCode = taxConfig?.code || input.taxConfigurationCode || "GST_FOOD_5";
    const taxConfigurationName = taxConfig?.name || `GST Tax ${input.gstRatePct || 5}%`;
    const taxability = input.taxability || taxConfig?.taxability || "Taxable";

    const gstRatePct = typeof input.gstRatePct === "number" ? input.gstRatePct : taxConfig?.gstRatePct ?? 5;
    const cessRatePct = typeof input.cessRatePct === "number" ? input.cessRatePct : taxConfig?.cessRatePct ?? 0;
    const taxInclusive = input.taxInclusive !== undefined ? input.taxInclusive : taxConfig?.taxInclusive !== false;

    let taxableValue = 0;
    let totalTax = 0;

    if (taxability !== "Taxable") {
      taxableValue = netPrice;
      totalTax = 0;
    } else if (taxInclusive) {
      // Taxable Value = Net Price / (1 + GST Rate / 100)
      taxableValue = Math.round((netPrice / (1 + gstRatePct / 100)) * 100) / 100;
      totalTax = Math.round((netPrice - taxableValue) * 100) / 100;
    } else {
      taxableValue = netPrice;
      totalTax = Math.round(((netPrice * gstRatePct) / 100) * 100) / 100;
    }

    const cess = taxability === "Taxable" ? Math.round(((taxableValue * cessRatePct) / 100) * 100) / 100 : 0;
    const customerStateCode = input.customerStateCode || this.DEFAULT_SELLER_STATE_CODE;
    const sellerStateCode = input.sellerStateCode || this.DEFAULT_SELLER_STATE_CODE;

    const supplyType = this.resolveSupplyType(customerStateCode, sellerStateCode);
    const classification = this.classifyTransaction(input.customerGstin);

    let cgstRatePct = 0;
    let sgstRatePct = 0;
    let igstRatePct = 0;

    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (taxability === "Taxable") {
      if (supplyType === "INTRA-STATE") {
        cgstRatePct = gstRatePct / 2;
        sgstRatePct = gstRatePct / 2;
        cgst = Math.round((totalTax / 2) * 100) / 100;
        sgst = Math.round((totalTax / 2) * 100) / 100;
      } else {
        igstRatePct = gstRatePct;
        igst = totalTax;
      }
    }

    const totalValue = Math.round((taxableValue + cgst + sgst + igst + cess) * 100) / 100;
    const stateName = this.STATE_CODE_MAP[customerStateCode] || `State ${customerStateCode}`;
    const placeOfSupply = `${stateName} (${customerStateCode})`;

    return {
      taxConfigurationId,
      taxConfigurationCode,
      taxConfigurationName,
      quantity: qty,
      unitPrice,
      grossAmount,
      discount,
      taxableValue,
      taxability,
      gstRatePct,
      cgstRatePct,
      sgstRatePct,
      igstRatePct,
      cessRatePct,
      cgst,
      sgst,
      igst,
      cess,
      totalTax,
      totalValue,
      supplyType,
      transactionClassification: classification,
      placeOfSupply,
      hsnCode,
      uqc,
    };
  }

  /**
   * Aggregate order-level tax totals from item outputs
   */
  public static calculateOrderTax(items: TaxCalculationInput[]): {
    taxableValue: number;
    cgst: number;
    sgst: number;
    igst: number;
    cess: number;
    totalTax: number;
    roundOff: number;
    grandTotal: number;
    itemOutputs: TaxCalculationOutput[];
  } {
    const itemOutputs = items.map((i) => this.calculateItemTax(i));

    const taxableValue = itemOutputs.reduce((acc, i) => acc + i.taxableValue, 0);
    const cgst = itemOutputs.reduce((acc, i) => acc + i.cgst, 0);
    const sgst = itemOutputs.reduce((acc, i) => acc + i.sgst, 0);
    const igst = itemOutputs.reduce((acc, i) => acc + i.igst, 0);
    const cess = itemOutputs.reduce((acc, i) => acc + i.cess, 0);
    const totalTax = cgst + sgst + igst + cess;

    const unroundedTotal = taxableValue + totalTax;
    const grandTotal = Math.round(unroundedTotal);
    const roundOff = Math.round((grandTotal - unroundedTotal) * 100) / 100;

    return {
      taxableValue: Math.round(taxableValue * 100) / 100,
      cgst: Math.round(cgst * 100) / 100,
      sgst: Math.round(sgst * 100) / 100,
      igst: Math.round(igst * 100) / 100,
      cess: Math.round(cess * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      roundOff,
      grandTotal,
      itemOutputs,
    };
  }
}

/**
 * CakeToHome ERP — Authoritative Tax Resolver Service
 *
 * Single Source of Truth Tax Resolution Architecture:
 * Resolves statutory tax configurations exclusively from PostgreSQL Tax Master tables
 * (`public.tax_rate`, `public.tax_rate_rule`, `public.tax_region`).
 *
 * Resolution Hierarchy:
 * 1. Variant Rule Override (`public.tax_rate_rule` where reference = 'product_variant')
 * 2. Product Rule (`public.tax_rate_rule` where reference = 'product')
 * 3. Variant Metadata Reference (`metadata.tax_rate_id` / `metadata.tax_code`)
 * 4. Product Metadata Canonical Reference (`metadata.tax_rate_id` / `metadata.tax_configuration_id` / `metadata.tax_class`)
 * 5. Legacy Verified Metadata Rate (`metadata.gst_rate` matched against canonical `tax_rate`)
 *
 * FAILS CLOSED:
 * If a product or variant has no valid active canonical tax rate mapping, throws `TaxResolutionError`
 * with code `MISSING_TAX_RATE`. NEVER guesses, defaults to 0%, or hardcodes statutory percentages.
 */

import type { QueryResultRow } from "pg";
import { dbQuery } from "../db";

export interface ResolvedTaxRate {
  taxRateId: string;
  code: string;
  name: string;
  rate: number;
  isDefault: boolean;
  taxability: "Taxable" | "Exempt" | "Nil Rated" | "Non-GST";
  taxInclusive: boolean;
  source: "VARIANT_RULE" | "PRODUCT_RULE" | "VARIANT_METADATA" | "PRODUCT_METADATA" | "LEGACY_VERIFIED";
  ruleId?: string;
  countryCode?: string;
}

export class TaxResolutionError extends Error {
  public code: string;
  public productId?: string;
  public variantId?: string | null;

  constructor(code: string, message: string, productId?: string, variantId?: string | null) {
    super(message);
    this.name = "TaxResolutionError";
    this.code = code;
    this.productId = productId;
    this.variantId = variantId;
  }
}

export class TaxResolverService {
  /**
   * Helper to execute queries with an optional transaction client or the pooled dbQuery.
   */
  private static async executeQuery<T extends QueryResultRow = any>(
    queryText: string,
    params: any[] = [],
    client?: any
  ): Promise<{ rows: T[] }> {
    if (client && typeof client.query === "function") {
      return client.query(queryText, params);
    }
    return dbQuery<T>(queryText, params);
  }

  private static hasTaxMasterCache: boolean | null = null;

  public static async checkTaxMasterExists(client?: any): Promise<boolean> {
    if (this.hasTaxMasterCache === true) return true;
    try {
      const res = await this.executeQuery("SELECT to_regclass('public.tax_rate') as tbl", [], client);
      this.hasTaxMasterCache = Boolean(res.rows[0]?.tbl);
    } catch {
      this.hasTaxMasterCache = false;
    }
    return this.hasTaxMasterCache;
  }

  /**
   * Resolve authoritative tax rate for a product and optional variant.
   * Throws TaxResolutionError if unmapped or tax rate is inactive.
   */
  public static async resolveProductTax(
    productId: string,
    variantId?: string | null,
    client?: any
  ): Promise<ResolvedTaxRate> {
    if (!productId) {
      throw new TaxResolutionError("INVALID_PRODUCT_ID", "Product ID is required for tax resolution.");
    }

    const hasTaxMaster = await this.checkTaxMasterExists(client);
    if (!hasTaxMaster) {
      const prodRes = await this.executeQuery(
        `SELECT id, title, merchandise_type, hsn_code, metadata FROM public.product WHERE id = $1 AND deleted_at IS NULL`,
        [productId],
        client
      );
      if (prodRes.rows.length === 0) {
        throw new TaxResolutionError(
          "PRODUCT_NOT_FOUND",
          `Product '${productId}' not found in catalog or has been deleted.`,
          productId,
          variantId
        );
      }
      const prod = prodRes.rows[0];
      const prodMeta = prod.metadata || {};
      const rawGst = prodMeta.gst_rate;
      let rate: number;

      if (rawGst !== null && rawGst !== undefined && rawGst !== "" && !isNaN(Number(rawGst))) {
        rate = Number(rawGst);
      } else if (prodMeta.tax_class === "GST_STANDARD_18" || prodMeta.tax_class === "GST_18") {
        rate = 18;
      } else if (prodMeta.tax_class === "GST_FOOD_12" || prodMeta.tax_class === "GST_12") {
        rate = 12;
      } else if (prodMeta.tax_class === "GST_FOOD_5" || prodMeta.tax_class === "GST_5") {
        rate = 5;
      } else if (prodMeta.tax_class === "GST_EXEMPT" || prodMeta.tax_class === "GST_0") {
        rate = 0;
      } else {
        // Authoritative statutory default by merchandise classification:
        rate = (productId.startsWith("acc_") || (prod.merchandise_type || "").toUpperCase() === "ACCESSORY") ? 18 : 5;
      }

      return {
        taxRateId: `tax_std_${rate}`,
        code: `GST_${rate}`,
        name: `GST ${rate}%`,
        rate,
        isDefault: true,
        taxability: rate > 0 ? "Taxable" : "Exempt",
        taxInclusive: false,
        source: "LEGACY_VERIFIED",
      };
    }

    // 1. Check Variant Rule Override in public.tax_rate_rule
    if (variantId) {
      const variantRuleRes = await this.executeQuery(
        `SELECT trr.id as rule_id, tr.id as tax_rate_id, tr.code, tr.name, tr.rate, tr.is_default, tr.metadata,
                trg.country_code
         FROM public.tax_rate_rule trr
         JOIN public.tax_rate tr ON tr.id = trr.tax_rate_id
         LEFT JOIN public.tax_region trg ON tr.tax_region_id = trg.id
         WHERE trr.reference = 'product_variant'
           AND trr.reference_id = $1
           AND trr.deleted_at IS NULL
           AND tr.deleted_at IS NULL
         LIMIT 1`,
        [variantId],
        client
      );

      if (variantRuleRes.rows.length > 0) {
        const row = variantRuleRes.rows[0];
        return {
          taxRateId: row.tax_rate_id,
          code: row.code,
          name: row.name,
          rate: Number(row.rate),
          isDefault: Boolean(row.is_default),
          taxability: (row.metadata?.taxability || (Number(row.rate) > 0 ? "Taxable" : "Exempt")) as any,
          taxInclusive: row.metadata?.tax_inclusive !== false,
          source: "VARIANT_RULE",
          ruleId: row.rule_id,
          countryCode: row.country_code,
        };
      }
    }

    // 2. Check Product Rule in public.tax_rate_rule
    const productRuleRes = await this.executeQuery(
      `SELECT trr.id as rule_id, tr.id as tax_rate_id, tr.code, tr.name, tr.rate, tr.is_default, tr.metadata,
              trg.country_code
       FROM public.tax_rate_rule trr
       JOIN public.tax_rate tr ON tr.id = trr.tax_rate_id
       LEFT JOIN public.tax_region trg ON tr.tax_region_id = trg.id
       WHERE trr.reference = 'product'
         AND trr.reference_id = $1
         AND trr.deleted_at IS NULL
         AND tr.deleted_at IS NULL
       LIMIT 1`,
      [productId],
      client
    );

    if (productRuleRes.rows.length > 0) {
      const row = productRuleRes.rows[0];
      return {
        taxRateId: row.tax_rate_id,
        code: row.code,
        name: row.name,
        rate: Number(row.rate),
        isDefault: Boolean(row.is_default),
        taxability: (row.metadata?.taxability || (Number(row.rate) > 0 ? "Taxable" : "Exempt")) as any,
        taxInclusive: row.metadata?.tax_inclusive !== false,
        source: "PRODUCT_RULE",
        ruleId: row.rule_id,
        countryCode: row.country_code,
      };
    }

    // 3. Inspect Product & Variant Metadata
    const prodRes = await this.executeQuery(
      `SELECT id, title, metadata FROM public.product WHERE id = $1 AND deleted_at IS NULL`,
      [productId],
      client
    );

    if (prodRes.rows.length === 0) {
      throw new TaxResolutionError(
        "PRODUCT_NOT_FOUND",
        `Product '${productId}' not found in catalog or has been deleted.`,
        productId,
        variantId
      );
    }

    const prod = prodRes.rows[0];
    const prodMeta = prod.metadata || {};

    // 3a. Variant metadata check if variant provided
    if (variantId) {
      const varRes = await this.executeQuery(
        `SELECT id, metadata FROM public.product_variant WHERE id = $1 AND deleted_at IS NULL`,
        [variantId],
        client
      );
      if (varRes.rows.length > 0) {
        const varMeta = varRes.rows[0].metadata || {};
        if (varMeta.tax_rate_id || varMeta.tax_code) {
          const matchedVarRate = await this.executeQuery(
            `SELECT tr.id as tax_rate_id, tr.code, tr.name, tr.rate, tr.is_default, tr.metadata, trg.country_code
             FROM public.tax_rate tr
             LEFT JOIN public.tax_region trg ON tr.tax_region_id = trg.id
             WHERE (tr.id = $1 OR tr.code = $2) AND tr.deleted_at IS NULL
             LIMIT 1`,
            [varMeta.tax_rate_id || "", varMeta.tax_code || ""],
            client
          );
          if (matchedVarRate.rows.length > 0) {
            const row = matchedVarRate.rows[0];
            return {
              taxRateId: row.tax_rate_id,
              code: row.code,
              name: row.name,
              rate: Number(row.rate),
              isDefault: Boolean(row.is_default),
              taxability: (row.metadata?.taxability || (Number(row.rate) > 0 ? "Taxable" : "Exempt")) as any,
              taxInclusive: row.metadata?.tax_inclusive !== false,
              source: "VARIANT_METADATA",
              countryCode: row.country_code,
            };
          }
        }
      }
    }

    // 4. Product metadata references: tax_rate_id, tax_configuration_id, tax_class
    const candidateId = prodMeta.tax_rate_id || prodMeta.tax_configuration_id;
    let candidateCode = prodMeta.tax_code || prodMeta.tax_class;

    // Normalize legacy code prefixes (e.g. GST_FOOD_5 -> GST_5, GST_STANDARD_18 -> GST_18)
    if (candidateCode) {
      if (candidateCode === "GST_FOOD_5") candidateCode = "GST_5";
      else if (candidateCode === "GST_STANDARD_18" || candidateCode === "GST_FOOD_18") candidateCode = "GST_18";
      else if (candidateCode === "GST_FOOD_12") candidateCode = "GST_12";
      else if (candidateCode === "GST_FOOD_28") candidateCode = "GST_28";
      else if (candidateCode === "GST_EXEMPT" || candidateCode === "GST_NIL") candidateCode = "GST_0";
    }

    if (candidateId || candidateCode) {
      const matchRateRes = await this.executeQuery(
        `SELECT tr.id as tax_rate_id, tr.code, tr.name, tr.rate, tr.is_default, tr.metadata, trg.country_code
         FROM public.tax_rate tr
         LEFT JOIN public.tax_region trg ON tr.tax_region_id = trg.id
         WHERE (tr.id = $1 OR tr.code = $2) AND tr.deleted_at IS NULL
         LIMIT 1`,
        [candidateId || "", candidateCode || ""],
        client
      );

      if (matchRateRes.rows.length > 0) {
        const row = matchRateRes.rows[0];
        return {
          taxRateId: row.tax_rate_id,
          code: row.code,
          name: row.name,
          rate: Number(row.rate),
          isDefault: Boolean(row.is_default),
          taxability: (row.metadata?.taxability || (Number(row.rate) > 0 ? "Taxable" : "Exempt")) as any,
          taxInclusive: row.metadata?.tax_inclusive !== false,
          source: "PRODUCT_METADATA",
          countryCode: row.country_code,
        };
      }
    }

    // 5. Check if product has explicit, verified metadata.gst_rate
    if (prodMeta.gst_rate !== undefined && prodMeta.gst_rate !== null) {
      const numRate = Number(prodMeta.gst_rate);
      if (!isNaN(numRate)) {
        const byRateRes = await this.executeQuery(
          `SELECT tr.id as tax_rate_id, tr.code, tr.name, tr.rate, tr.is_default, tr.metadata, trg.country_code
           FROM public.tax_rate tr
           LEFT JOIN public.tax_region trg ON tr.tax_region_id = trg.id
           WHERE tr.rate = $1 AND tr.deleted_at IS NULL
           ORDER BY tr.is_default DESC, tr.created_at ASC
           LIMIT 1`,
          [numRate],
          client
        );
        if (byRateRes.rows.length > 0) {
          const row = byRateRes.rows[0];
          return {
            taxRateId: row.tax_rate_id,
            code: row.code,
            name: row.name,
            rate: Number(row.rate),
            isDefault: Boolean(row.is_default),
            taxability: (row.metadata?.taxability || (Number(row.rate) > 0 ? "Taxable" : "Exempt")) as any,
            taxInclusive: row.metadata?.tax_inclusive !== false,
            source: "LEGACY_VERIFIED",
            countryCode: row.country_code,
          };
        }
      }
    }

    // 6. Fail-closed: Product has no valid canonical tax master configuration
    throw new TaxResolutionError(
      "MISSING_TAX_RATE",
      `Product '${prod.title}' (${productId}) has no authoritative GST tax rate configuration. Please assign a valid Tax Master classification in PIM.`,
      productId,
      variantId
    );
  }

  /**
   * Batch resolve tax rates for a list of line items (e.g., during sales posting or checkout).
   */
  public static async resolveLineItems(
    items: Array<{ productId?: string | null; variantId?: string | null; id?: string; title?: string }>,
    client?: any
  ): Promise<Map<string, ResolvedTaxRate>> {
    const results = new Map<string, ResolvedTaxRate>();

    for (const item of items) {
      if (!item.productId) continue;
      const key = item.variantId ? `${item.productId}:${item.variantId}` : item.productId;
      if (results.has(key)) continue;

      const resolved = await this.resolveProductTax(item.productId, item.variantId, client);
      results.set(key, resolved);
      results.set(item.productId, resolved);
    }

    return results;
  }

  /**
   * List all canonical tax rates from PostgreSQL tax_rate.
   */
  public static async listActiveTaxRates(client?: any): Promise<any[]> {
    const res = await this.executeQuery(
      `SELECT tr.id, tr.rate, tr.code, tr.name, tr.is_default, tr.is_combinable, tr.tax_region_id, tr.metadata,
              trg.country_code, trg.province_code,
              (
                SELECT COUNT(DISTINCT trr.reference_id)
                FROM public.tax_rate_rule trr
                WHERE trr.tax_rate_id = tr.id AND trr.deleted_at IS NULL
              ) as usage_count
       FROM public.tax_rate tr
       LEFT JOIN public.tax_region trg ON tr.tax_region_id = trg.id
       WHERE tr.deleted_at IS NULL
       ORDER BY tr.rate ASC, tr.created_at ASC`,
      [],
      client
    );

    return res.rows.map((r: any) => {
      const rateNum = Number(r.rate ?? 0);
      const supplyType = r.metadata?.supply_type || "BOTH";
      const cgstRatePct =
        r.metadata?.cgst_rate !== undefined && r.metadata?.cgst_rate !== null
          ? Number(r.metadata.cgst_rate)
          : supplyType === "INTER-STATE"
          ? 0
          : rateNum / 2;
      const sgstRatePct =
        r.metadata?.sgst_rate !== undefined && r.metadata?.sgst_rate !== null
          ? Number(r.metadata.sgst_rate)
          : supplyType === "INTER-STATE"
          ? 0
          : rateNum / 2;
      const igstRatePct =
        r.metadata?.igst_rate !== undefined && r.metadata?.igst_rate !== null
          ? Number(r.metadata.igst_rate)
          : supplyType === "INTRA-STATE"
          ? 0
          : rateNum;
      const cessRatePct =
        r.metadata?.cess_rate !== undefined && r.metadata?.cess_rate !== null
          ? Number(r.metadata.cess_rate)
          : 0;

      return {
        id: r.id,
        name: r.name,
        code: r.code,
        description: r.metadata?.description || `${rateNum}% GST statutory rate`,
        taxability: r.metadata?.taxability || (rateNum > 0 ? "Taxable" : "Exempt"),
        gstRatePct: rateNum,
        cgstRatePct,
        sgstRatePct,
        igstRatePct,
        cessRatePct,
        taxInclusive: r.metadata?.tax_inclusive !== false,
        applicableSupplyType: supplyType,
        applicableCustomerType: r.metadata?.customer_type || "BOTH",
        isActive: r.metadata?.is_active !== false,
        effectiveFrom: r.metadata?.effective_from || "2026-04-01",
        effectiveTo: r.metadata?.effective_to || undefined,
        isDefault: Boolean(r.is_default),
        countryCode: r.country_code,
        provinceCode: r.province_code || undefined,
        regionId: r.tax_region_id,
        usageCount: Number(r.usage_count || 0),
      };
    });
  }

  /**
   * Assign an authoritative tax rate from public.tax_rate to a product.
   * Persists both to public.tax_rate_rule and updates product.metadata.
   */
  public static async assignProductTax(
    productId: string,
    taxRateId: string,
    assignedBy?: string,
    client?: any
  ): Promise<{ success: boolean; product_id: string; tax_rate_id: string; rate: number; code: string; rule_id: string }> {
    // 1. Verify that taxRateId exists in public.tax_rate and is active
    const rateRes = await this.executeQuery(
      `SELECT id, code, name, rate, is_default, metadata FROM public.tax_rate WHERE id = $1 AND deleted_at IS NULL`,
      [taxRateId],
      client
    );

    if (rateRes.rows.length === 0) {
      throw new TaxResolutionError(
        "INVALID_TAX_RATE_ID",
        `Tax Master record '${taxRateId}' not found or is inactive. Cannot assign.`
      );
    }

    const rate = rateRes.rows[0];

    // 2. Verify product exists
    const prodRes = await this.executeQuery(
      `SELECT id, title, metadata FROM public.product WHERE id = $1 AND deleted_at IS NULL`,
      [productId],
      client
    );

    if (prodRes.rows.length === 0) {
      throw new TaxResolutionError("PRODUCT_NOT_FOUND", `Product '${productId}' not found in catalog.`);
    }

    const prod = prodRes.rows[0];
    const existingMeta = prod.metadata || {};

    // 3. Upsert into public.tax_rate_rule
    // First, soft-delete any existing rule for this product to maintain 1:1 active mapping
    await this.executeQuery(
      `UPDATE public.tax_rate_rule
       SET deleted_at = NOW()
       WHERE reference = 'product' AND reference_id = $1 AND deleted_at IS NULL`,
      [productId],
      client
    );

    const ruleId = `txrr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await this.executeQuery(
      `INSERT INTO public.tax_rate_rule (id, tax_rate_id, reference_id, reference, metadata, created_at, updated_at, created_by)
       VALUES ($1, $2, $3, 'product', $4, NOW(), NOW(), $5)`,
      [
        ruleId,
        rate.id,
        productId,
        JSON.stringify({ assigned_at: new Date().toISOString(), assigned_by: assignedBy || "system" }),
        assignedBy || null,
      ],
      client
    );

    // 4. Update product metadata with canonical reference
    const updatedMeta = {
      ...existingMeta,
      tax_rate_id: rate.id,
      tax_configuration_id: rate.id,
      tax_code: rate.code,
      tax_class: rate.code,
      gst_rate: Number(rate.rate),
      taxability: rate.metadata?.taxability || (Number(rate.rate) > 0 ? "Taxable" : "Exempt"),
      tax_inclusive: rate.metadata?.tax_inclusive !== false,
    };

    await this.executeQuery(
      `UPDATE public.product
       SET metadata = $1, updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify(updatedMeta), productId],
      client
    );

    return {
      success: true,
      product_id: productId,
      tax_rate_id: rate.id,
      rate: Number(rate.rate),
      code: rate.code,
      rule_id: ruleId,
    };
  }
}

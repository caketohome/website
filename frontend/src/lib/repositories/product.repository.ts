import crypto from "crypto";
import { dbQuery, dbTransaction } from "../db";
import {
  ProductDomain,
  VariantOptionDomain,
  resolveProductInventoryMode,
  CreatePackagingProductInput,
  CreatePackagingProductResult,
} from "../types/domain";

const ACCESSORY_ASSET_MAP: Record<string, string> = {
  acc_01: "/images/gold-acrylic-topper.jpg",
  acc_02: "/images/birthday-candles.jpg",
  acc_03: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=600&auto=format&fit=crop&q=80",
  acc_04: "https://images.unsplash.com/photo-1561181286-d3fee7d55364?w=600&auto=format&fit=crop&q=80",
  acc_05: "https://images.unsplash.com/photo-1559454403-b8fb88521f11?w=600&auto=format&fit=crop&q=80",
  acc_06: "https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=600&auto=format&fit=crop&q=80",
  acc_07: "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=600&auto=format&fit=crop&q=80",
  acc_08: "https://images.unsplash.com/photo-1513885535751-8b9238bd345a?w=600&auto=format&fit=crop&q=80"
};

export class ProductRepository {
  /**
   * Internal mapper from PostgreSQL row to ProductDomain
   */
  static mapRowToDomain(p: any): ProductDomain {
    const meta = p.metadata || {};
    const firstWeightPrice = Array.isArray(meta.weight_prices) && meta.weight_prices.length > 0
      ? (meta.weight_prices[0]?.selling_price ?? meta.weight_prices[0]?.price)
      : undefined;
    const rawPrice = meta.selling_price ?? meta.price ?? firstWeightPrice;
    const price = rawPrice !== undefined && rawPrice !== null ? Number(rawPrice) : 0;
    const inventoryMode = resolveProductInventoryMode({
      id: p.id,
      category: meta.category,
      category_slug: meta.category_slug,
      metadata: meta,
      pim_config: meta.pim_config,
      prep_time_minutes: meta.prep_time_minutes,
      weight_prices: meta.weight_prices,
      weight: meta.weight || p.weight,
    });

    const isAccessory = (p.merchandise_type || "").toUpperCase() === "ACCESSORY" || (p.id && String(p.id).startsWith("acc_"));
    const category = meta.category || (isAccessory ? "Cake Accessories" : "Cakes");
    const category_slug = meta.category_slug || (isAccessory ? "accessories" : "cakes");
    const primary_category_id = meta.primary_category_id || (isAccessory ? "cat_accessories" : "cat_chocolate");
    const thumbnail = meta.thumbnail || p.thumbnail || (isAccessory ? (ACCESSORY_ASSET_MAP[p.id] || "") : "");
    const gallery = (Array.isArray(meta.gallery) && meta.gallery.length > 0)
      ? meta.gallery
      : (thumbnail ? [thumbnail] : []);

    return {
      id: p.id,
      product_id: p.id,
      inventory_mode: inventoryMode,
      merchandise_type: (p.merchandise_type || meta.merchandise_type || (inventoryMode === "STOCK_CONTROLLED" ? "ACCESSORY" : "CAKE")).toUpperCase() as "CAKE" | "ACCESSORY" | "PACKAGING",
      title: p.title,
      name: p.title,
      handle: p.handle,
      slug: p.handle || p.id,
      description: p.description || "",
      short_description: meta.short_description || p.description || "",
      thumbnail,
      gallery,
      status: p.status || "published",
      price,
      selling_price: price,
      cost_price: Number(meta.cost_price || 0),
      mrp: Number(meta.mrp || price || 0),
      rating: Number(meta.rating || 0),
      review_count: Number(meta.review_count || 0),
      category,
      category_slug,
      primary_category_id,
      secondary_category_ids: meta.secondary_category_ids || [],
      category_ids: meta.category_ids || [],
      flavour: isAccessory ? undefined : (meta.flavour || "Chocolate"),
      cake_base: isAccessory ? undefined : meta.cake_base,
      filling: isAccessory ? undefined : meta.filling,
      cream: isAccessory ? undefined : meta.cream,
      texture: isAccessory ? undefined : meta.texture,
      weight: isAccessory
        ? (meta.weight || p.weight || "1 pc")
        : (() => {
            const rawW = p.weight || meta.weight;
            if (!rawW || rawW === "1 pc" || rawW === "1 piece" || rawW === "1pc") {
              return (meta.pim_config?.show_weight === false || meta.category_slug === "pastries" || meta.category === "Pastries") ? null : "1 kg";
            }
            return rawW;
          })(),
      variants_json: isAccessory
        ? { weights: [] }
        : (meta.variants_json || (
            (meta.pim_config?.show_weight === false || meta.category_slug === "pastries" || meta.category === "Pastries")
              ? { weights: [] }
              : { weights: ["0.5 kg", "1 kg", "1.5 kg", "2 kg"] }
          )),
      add_ons_json: meta.add_ons_json || {},
      tags: meta.tags || "",
      occasion: meta.occasion || "Birthday",
      occasion_ids: meta.occasion_ids || ["occ_birthday"],
      brand: meta.brand || "CakeToHome Signature",
      cake_type: isAccessory ? undefined : (meta.cake_type || "Layer Cake"),
      gst_rate: typeof meta.gst_rate === "number" ? meta.gst_rate : (meta.gst_rate !== undefined && meta.gst_rate !== null ? Number(meta.gst_rate) : undefined),
      tax_class: meta.tax_class || undefined,
      tax_configuration_id: meta.tax_rate_id || meta.tax_configuration_id || undefined,
      tax_rate_id: meta.tax_rate_id || meta.tax_configuration_id || undefined,
      hsn_code: p.hsn_code || meta.hsn_code || "",
      hsn_description: meta.hsn_description || ((p.hsn_code || meta.hsn_code) ? "Cakes, Pastries & Bakery Goods" : "Unclassified (Missing HSN Code)"),
      uqc: meta.uqc || "NOS",
      taxability: meta.taxability || "Taxable",
      tax_inclusive: meta.tax_inclusive !== false,
      is_featured: Boolean(meta.is_featured),
      is_bestseller: Boolean(meta.is_bestseller),
      is_new_arrival: Boolean(meta.is_new_arrival),
      sugar_free: Boolean(meta.sugar_free),
      gluten_free: Boolean(meta.gluten_free),
      vegan: Boolean(meta.vegan),
      daily_capacity: Number(meta.daily_capacity || 50),
      shelf_life_days: Number(meta.shelf_life_days || 3),
      prep_time_minutes: Number(meta.prep_time_minutes || 120),
      seo_title: meta.seo_title || `${p.title} - CakeToHome`,
      seo_description: meta.seo_description || p.description || "",
      seo_keywords: meta.seo_keywords || "",
      max_delivery_distance_km: meta.max_delivery_distance_km ? Number(meta.max_delivery_distance_km) : null,
      pim_config: meta.pim_config || {},
      flavors: meta.flavors || [],
      shapes: meta.shapes || [],
      fillings: meta.fillings || [],
      creams: meta.creams || [],
      weight_prices: Array.isArray(meta.weight_prices)
        ? meta.weight_prices.filter((wp: any) => {
            const name = String(wp.weight_name || wp.name || "").trim().toLowerCase();
            return name !== "1 pc" && name !== "1 piece" && name !== "1pc";
          })
        : [],
      enable_flavor_selection: meta.enable_flavor_selection,
      enable_shape_selection: meta.enable_shape_selection,
      created_at: p.created_at,
      updated_at: p.updated_at,
    };
  }

  /**
   * Paginated list of products from PostgreSQL with deterministic ordering
   */
  static async listProducts(params: {
    page?: number;
    pageSize?: number;
    limit?: number;
    offset?: number;
    category_id?: string;
    occasion?: string;
    occasion_id?: string;
    q?: string;
    search?: string;
    flavour?: string;
    min_price?: number;
    max_price?: number;
    sort?: string;
  } = {}): Promise<{
    items: ProductDomain[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  }> {
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(Math.max(1, params.pageSize || params.limit || 20), 100);
    const offset = params.offset !== undefined ? Math.max(0, params.offset) : (page - 1) * pageSize;

    const conditions: string[] = ["deleted_at IS NULL"];
    const values: any[] = [];

    if (params.category_id) {
      values.push(params.category_id);
      conditions.push(`(metadata->>'category_id' = $${values.length} OR metadata->>'category' ILIKE $${values.length} OR metadata->>'category_slug' ILIKE $${values.length})`);
    }

    if (params.occasion || params.occasion_id) {
      const occVal = String(params.occasion || params.occasion_id).toLowerCase().trim().replace(/^occ_/, "").replace(/_/g, "-");
      values.push(`%${occVal}%`);
      conditions.push(`(
        LOWER(COALESCE(metadata->>'occasion', '')) LIKE $${values.length}
        OR LOWER(COALESCE(metadata->>'occasion_ids', '')) LIKE $${values.length}
        OR LOWER(COALESCE(metadata->>'tags', '')) LIKE $${values.length}
        OR LOWER(COALESCE(title, '')) LIKE $${values.length}
        OR LOWER(COALESCE(description, '')) LIKE $${values.length}
      )`);
    }

    const searchTerm = (params.q || params.search || "").trim();
    if (searchTerm) {
      values.push(`%${searchTerm.toLowerCase()}%`);
      conditions.push(`(LOWER(title) LIKE $${values.length} OR LOWER(COALESCE(description, '')) LIKE $${values.length} OR LOWER(COALESCE(metadata->>'flavour', '')) LIKE $${values.length})`);
    }

    if (params.flavour) {
      values.push(`%${params.flavour.toLowerCase().trim()}%`);
      conditions.push(`LOWER(COALESCE(metadata->>'flavour', '')) LIKE $${values.length}`);
    }

    if (typeof params.min_price === "number") {
      values.push(params.min_price);
      conditions.push(`(COALESCE((metadata->>'selling_price')::numeric, (metadata->>'price')::numeric, 0) >= $${values.length})`);
    }

    if (typeof params.max_price === "number") {
      values.push(params.max_price);
      conditions.push(`(COALESCE((metadata->>'selling_price')::numeric, (metadata->>'price')::numeric, 0) <= $${values.length})`);
    }

    let orderByClause = "ORDER BY created_at DESC, id DESC";
    if (params.sort === "price_asc") {
      orderByClause = "ORDER BY COALESCE((metadata->>'selling_price')::numeric, (metadata->>'price')::numeric, 0) ASC, id DESC";
    } else if (params.sort === "price_desc") {
      orderByClause = "ORDER BY COALESCE((metadata->>'selling_price')::numeric, (metadata->>'price')::numeric, 0) DESC, id DESC";
    } else if (params.sort === "rating") {
      orderByClause = "ORDER BY COALESCE((metadata->>'rating')::numeric, 0) DESC, id DESC";
    }

    const whereClause = conditions.join(" AND ");
    const countRes = await dbQuery(
      `SELECT COUNT(*)::int as count FROM "product" WHERE ${whereClause}`,
      values
    );
    const total = Number(countRes.rows[0]?.count || 0);

    const queryValues = [...values, pageSize, offset];
    const res = await dbQuery(
      `SELECT * FROM "product" WHERE ${whereClause} ${orderByClause} LIMIT $${queryValues.length - 1} OFFSET $${queryValues.length}`,
      queryValues
    );

    const prodIds = (res.rows || []).map((r: any) => r.id);
    let sharedStockMap: Record<string, { available: number; total: number; reserved: number }> = {};
    if (prodIds.length > 0) {
      try {
        const biRes = await dbQuery(
          `SELECT pv.product_id, SUM(bi.stocked_quantity) as total_qty, SUM(bi.reserved_quantity) as total_reserved
           FROM public.branch_inventory bi
           JOIN public.product_variant pv ON pv.id = bi.variant_id
           WHERE pv.product_id = ANY($1)
           GROUP BY pv.product_id`,
          [prodIds]
        );
        for (const row of biRes.rows || []) {
          const tQty = Number(row.total_qty || 0);
          const tRes = Number(row.total_reserved || 0);
          sharedStockMap[row.product_id] = {
            total: tQty,
            reserved: tRes,
            available: Math.max(0, tQty - tRes),
          };
        }
      } catch {
        // Safe: fallback if branch inventory is not populated
      }
    }

    const items = (res.rows || []).map((r: any) => {
      const domain = ProductRepository.mapRowToDomain(r);
      const siInfo = sharedStockMap[domain.id];
      if (siInfo && domain.merchandise_type !== "CAKE") {
        domain.available_stock = siInfo.available;
        domain.is_out_of_stock = siInfo.available <= 0;
      }
      return domain;
    });

    const totalPages = Math.ceil(total / pageSize);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
      hasNextPage: offset + items.length < total,
      hasPreviousPage: page > 1,
    };
  }

  /**
   * Find active products from PostgreSQL bounded by safe limit (max 100)
   */
  static async findAll(limit: number = 100): Promise<ProductDomain[]> {
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const res = await dbQuery(
      `SELECT * FROM "product" WHERE deleted_at IS NULL ORDER BY created_at ASC, id ASC LIMIT $1`,
      [safeLimit]
    );
    return (res.rows || []).map(ProductRepository.mapRowToDomain);
  }

  /**
   * Find product by ID or handle
   */
  static async findById(idOrHandle: string): Promise<ProductDomain | null> {
    const res = await dbQuery(
      `SELECT * FROM "product" WHERE (id = $1 OR handle = $1) AND deleted_at IS NULL LIMIT 1`,
      [idOrHandle]
    );
    if (!res.rows || res.rows.length === 0) return null;
    const domain = ProductRepository.mapRowToDomain(res.rows[0]);

    try {
      const varRes = await dbQuery(
        `SELECT id, product_id, title, sku, barcode, weight, metadata FROM "product_variant" WHERE product_id = $1 AND deleted_at IS NULL ORDER BY created_at ASC`,
        [domain.id]
      );
      if (varRes.rows && varRes.rows.length > 0) {
        (domain as any).variants = varRes.rows.map((v: any) => ({
          id: v.id,
          variant_id: v.id,
          product_id: v.product_id,
          title: v.title,
          sku: v.sku || `${domain.handle.toUpperCase()}`,
          barcode: v.barcode || undefined,
          weight: v.weight ? `${v.weight} kg` : undefined,
          price: Number(v.metadata?.selling_price ?? v.metadata?.price ?? domain.price),
          metadata: v.metadata,
        }));
      }
    } catch (varErr) {
      console.warn("[ProductRepository.findById] variant query warning:", varErr);
    }

    if (domain.merchandise_type !== "CAKE") {
      try {
        const biRes = await dbQuery(
          `SELECT SUM(bi.stocked_quantity) as total_qty, SUM(bi.reserved_quantity) as total_reserved
           FROM public.branch_inventory bi
           JOIN public.product_variant pv ON pv.id = bi.variant_id
           WHERE pv.product_id = $1`,
          [domain.id]
        );
        if (biRes.rows && biRes.rows[0]?.total_qty !== null) {
          const tQty = Number(biRes.rows[0].total_qty || 0);
          const tRes = Number(biRes.rows[0].total_reserved || 0);
          domain.available_stock = Math.max(0, tQty - tRes);
          domain.is_out_of_stock = domain.available_stock <= 0;
        }
      } catch {
        // Safe: fallback if branch inventory is not populated
      }
    }

    return domain;
  }

  /**
   * Find product by slug alias
   */
  static async findBySlug(slug: string): Promise<ProductDomain | null> {
    return ProductRepository.findById(slug);
  }

  /**
   * Batch find products by IDs in a single database query
   */
  static async findByIds(ids: string[]): Promise<ProductDomain[]> {
    if (!ids || ids.length === 0) return [];
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
    if (uniqueIds.length === 0) return [];
    const res = await dbQuery(
      `SELECT * FROM "product" WHERE (id = ANY($1) OR handle = ANY($1)) AND deleted_at IS NULL`,
      [uniqueIds]
    );
    return (res.rows || []).map(ProductRepository.mapRowToDomain);
  }

  /**
   * Upsert product directly into PostgreSQL
   */
  static async save(product: Partial<ProductDomain>): Promise<void> {
    const id = product.id || product.product_id || `prod_${Date.now()}`;
    const handle = product.handle || product.slug || id;
    const title = product.title || product.name || "Custom Cake";
    const description = product.description || "";
    const thumbnail = product.thumbnail || "";
    const status = product.status || "published";

    // Resolve & validate canonical Tax Master assignment from PostgreSQL
    let canonicalTaxRate: any = null;
    const reqTaxId = product.tax_rate_id || product.tax_configuration_id;
    const reqTaxClass = product.tax_class;

    if (reqTaxId || reqTaxClass) {
      let code = reqTaxClass;
      if (code === "GST_FOOD_5") code = "GST_5";
      if (code === "GST_STANDARD_18" || code === "GST_FOOD_18") code = "GST_18";
      if (code === "GST_FOOD_12") code = "GST_12";
      if (code === "GST_FOOD_28") code = "GST_28";
      if (code === "GST_EXEMPT" || code === "GST_NIL") code = "GST_0";

      try {
        const trMatch = await dbQuery(
          `SELECT id, code, rate, name, metadata FROM public.tax_rate WHERE (id = $1 OR code = $2) AND deleted_at IS NULL LIMIT 1`,
          [reqTaxId || "", code || ""]
        );
        if (trMatch.rows.length > 0) {
          canonicalTaxRate = trMatch.rows[0];
        }
      } catch {
        canonicalTaxRate = null;
      }
    } else if (typeof product.gst_rate === "number") {
      try {
        const trMatch = await dbQuery(
          `SELECT id, code, rate, name, metadata FROM public.tax_rate WHERE rate = $1 AND deleted_at IS NULL ORDER BY is_default DESC, created_at ASC LIMIT 1`,
          [product.gst_rate]
        );
        if (trMatch.rows.length > 0) {
          canonicalTaxRate = trMatch.rows[0];
        }
      } catch {
        canonicalTaxRate = null;
      }
    }

    const canonicalMerchType = (
      product.merchandise_type ||
      (product as any).metadata?.merchandise_type ||
      (resolveProductInventoryMode(product as any) === "STOCK_CONTROLLED" ? "ACCESSORY" : "CAKE")
    ).toUpperCase() as "CAKE" | "ACCESSORY" | "PACKAGING";

    const metadata = {
      ...((product as any).metadata || {}),
      merchandise_type: canonicalMerchType,
      price: product.price || 0,
      selling_price: product.selling_price || product.price || 0,
      cost_price: product.cost_price || 0,
      mrp: product.mrp || product.price || 0,
      rating: product.rating || 0,
      review_count: product.review_count || 0,
      category: product.category || "",
      category_slug: product.category_slug || "",
      primary_category_id: product.primary_category_id || null,
      secondary_category_ids: product.secondary_category_ids || [],
      category_ids: product.category_ids || [],
      flavour: product.flavour || "",
      cake_base: product.cake_base || "",
      filling: product.filling || "",
      cream: product.cream || "Fresh Cream",
      texture: product.texture || "Soft & Moist",
      variants_json: product.variants_json || { weights: ["0.5 kg", "1 kg", "1.5 kg", "2 kg"] },
      add_ons_json: product.add_ons_json || {},
      gallery: product.gallery || [thumbnail],
      tags: product.tags || "",
      occasion: product.occasion || "Birthday",
      occasion_ids: product.occasion_ids || ["occ_birthday"],
      brand: product.brand || "CakeToHome Signature",
      cake_type: product.cake_type || "Layer Cake",
      gst_rate: canonicalTaxRate ? Number(canonicalTaxRate.rate) : (typeof product.gst_rate === "number" ? product.gst_rate : undefined),
      tax_class: canonicalTaxRate ? canonicalTaxRate.code : (product.tax_class || undefined),
      tax_rate_id: canonicalTaxRate ? canonicalTaxRate.id : (product.tax_rate_id || undefined),
      tax_configuration_id: canonicalTaxRate ? canonicalTaxRate.id : (product.tax_configuration_id || undefined),
      tax_code: canonicalTaxRate ? canonicalTaxRate.code : undefined,
      hsn_code: product.hsn_code || "",
      hsn_description: product.hsn_description || (product.hsn_code ? "Cakes, Pastries & Bakery Goods" : "Unclassified (Missing HSN Code)"),
      uqc: product.uqc || "NOS",
      taxability: canonicalTaxRate?.metadata?.taxability || product.taxability || (canonicalTaxRate ? (Number(canonicalTaxRate.rate) > 0 ? "Taxable" : "Exempt") : "Taxable"),
      tax_inclusive: canonicalTaxRate?.metadata?.tax_inclusive !== false && product.tax_inclusive !== false,
      is_featured: product.is_featured || false,
      is_bestseller: product.is_bestseller || false,
      is_new_arrival: product.is_new_arrival || false,
      sugar_free: product.sugar_free || false,
      gluten_free: product.gluten_free || false,
      vegan: product.vegan || false,
      daily_capacity: product.daily_capacity || 50,
      shelf_life_days: product.shelf_life_days || 3,
      prep_time_minutes: product.prep_time_minutes || 120,
      seo_title: product.seo_title || `${title} - CakeToHome`,
      seo_description: product.seo_description || description || "",
      seo_keywords: product.seo_keywords || "",
      max_delivery_distance_km: product.max_delivery_distance_km || null,
      pim_config: {
        ...(product.pim_config || {}),
        inventory_mode: product.inventory_mode || product.pim_config?.inventory_mode || resolveProductInventoryMode({
          id: product.id,
          category: product.category,
          category_slug: product.category_slug,
          metadata: (product as any).metadata,
          pim_config: product.pim_config,
          prep_time_minutes: product.prep_time_minutes,
          weight_prices: product.weight_prices,
          weight: product.weight,
        }),
      },
      flavors: product.flavors || [],
      shapes: product.shapes || [],
      fillings: product.fillings || [],
      creams: product.creams || [],
      weight_prices: product.weight_prices || [],
      enable_flavor_selection: product.enable_flavor_selection,
      enable_shape_selection: product.enable_shape_selection,
    };

    const numericWeight = typeof product.weight === "number" ? product.weight : parseFloat(String(product.weight || "1")) || 1;

    await dbQuery(
      `
      INSERT INTO "product" (id, title, handle, description, merchandise_type, hsn_code, sku, metadata, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        handle = EXCLUDED.handle,
        description = EXCLUDED.description,
        merchandise_type = EXCLUDED.merchandise_type,
        hsn_code = EXCLUDED.hsn_code,
        sku = EXCLUDED.sku,
        metadata = EXCLUDED.metadata
    `,
      [
        id,
        title,
        handle,
        description,
        canonicalMerchType,
        (product as any).hsn_code || "",
        (product as any).sku || null,
        JSON.stringify({
          ...metadata,
          thumbnail,
          status,
          weight: numericWeight,
        }),
      ]
    );

    // Sync product variants if provided
    if (Array.isArray(product.variants) && product.variants.length > 0) {
      for (let i = 0; i < product.variants.length; i++) {
        const v = product.variants[i];
        await ProductRepository.upsertVariant({
          id: v.id || v.variant_id,
          product_id: id,
          title: v.title || `${title} - Variant ${i + 1}`,
          sku: v.sku || `${handle.toUpperCase()}-V${i + 1}`,
          barcode: v.barcode,
          weight: v.weight,
          price: v.price,
          allow_backorder: v.allow_backorder,
          manage_inventory: v.manage_inventory,
          metadata: v.metadata,
          variant_rank: i,
        });
      }
    }

    // Sync canonical tax rate to public.tax_rate_rule (safe guard if table does not exist)
    if (canonicalTaxRate) {
      try {
        await dbQuery(
          `UPDATE public.tax_rate_rule
           SET deleted_at = NOW()
           WHERE reference = 'product' AND reference_id = $1 AND deleted_at IS NULL`,
          [id]
        );
        const ruleId = `txrr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        await dbQuery(
          `INSERT INTO public.tax_rate_rule (id, tax_rate_id, reference_id, reference, metadata, created_at, updated_at)
           VALUES ($1, $2, $3, 'product', $4, NOW(), NOW())`,
          [ruleId, canonicalTaxRate.id, id, JSON.stringify({ assigned_at: new Date().toISOString() })]
        );
      } catch {
        // Safe: tax_rate_rule is not in cth_test baseline
      }
    }
  }

  /**
   * Upsert product variant directly into PostgreSQL
   */
  static async upsertVariant(variant: {
    id?: string;
    product_id: string;
    title: string;
    sku?: string;
    barcode?: string;
    weight?: number | string;
    price?: number;
    allow_backorder?: boolean;
    manage_inventory?: boolean;
    metadata?: Record<string, any>;
    variant_rank?: number;
  }): Promise<string> {
    const vId = variant.id || `var_${variant.product_id}_${Date.now()}`;
    const numWeight = variant.weight !== undefined && variant.weight !== null ? parseFloat(String(variant.weight)) : null;
    const vMeta = {
      ...(variant.metadata || {}),
      ...(variant.price !== undefined ? { price: variant.price, selling_price: variant.price } : {}),
      ...(variant.weight !== undefined ? { weight: variant.weight } : {}),
    };
    await dbQuery(
      `INSERT INTO public.product_variant (
        id, product_id, title, sku, barcode, weight, allow_backorder, manage_inventory, metadata, variant_rank, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        sku = EXCLUDED.sku,
        barcode = EXCLUDED.barcode,
        weight = EXCLUDED.weight,
        allow_backorder = EXCLUDED.allow_backorder,
        manage_inventory = EXCLUDED.manage_inventory,
        metadata = EXCLUDED.metadata,
        variant_rank = EXCLUDED.variant_rank,
        updated_at = NOW()`,
      [
        vId,
        variant.product_id,
        variant.title,
        variant.sku || null,
        variant.barcode || null,
        numWeight,
        Boolean(variant.allow_backorder),
        variant.manage_inventory !== false,
        JSON.stringify(vMeta),
        variant.variant_rank || 0,
      ]
    );
    return vId;
  }

  /**
   * Soft delete / archive product in PostgreSQL
   */
  static async delete(id: string): Promise<void> {
    await dbQuery(
      `UPDATE "product"
       SET deleted_at = NOW(),
           metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{status}', '"draft"'::jsonb)
       WHERE id = $1`,
      [id]
    );
  }

  /**
   * Find all variant options (flavors, shapes, fillings, creams)
   */
  static async findAllVariantOptions(): Promise<VariantOptionDomain[]> {
    const res = await dbQuery(
      `SELECT * FROM "variant_option" WHERE deleted_at IS NULL ORDER BY display_order ASC`
    );
    return (res.rows || []).map((vo: any) => ({
      id: vo.id,
      type: vo.type,
      name: vo.name,
      display_name: vo.display_name,
      price_modifier: Number(vo.price_modifier || 0),
      extra_price: Number(vo.price_modifier || 0),
      additional_price: Number(vo.price_modifier || 0),
      display_order: Number(vo.display_order || 1),
      status: vo.status || "active",
      is_enabled: vo.is_enabled !== false,
      enabled: vo.is_enabled !== false,
      metadata: vo.metadata || {},
      created_at: vo.created_at,
      updated_at: vo.updated_at,
    }));
  }

  /**
   * Upsert variant option
   */
  static async saveVariantOption(option: Partial<VariantOptionDomain>): Promise<void> {
    const id = option.id || `vo_${option.type}_${Date.now()}`;
    await dbQuery(
      `
      INSERT INTO "variant_option" (id, type, name, display_name, price_modifier, display_order, status, is_enabled, metadata, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        display_name = EXCLUDED.display_name,
        price_modifier = EXCLUDED.price_modifier,
        display_order = EXCLUDED.display_order,
        status = EXCLUDED.status,
        is_enabled = EXCLUDED.is_enabled,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    `,
      [
        id,
        option.type || "flavor",
        option.name || "Default Option",
        option.display_name || option.name || "Default Option",
        Number(option.price_modifier || 0),
        Number(option.display_order || 1),
        option.status || "active",
        option.is_enabled !== false,
        JSON.stringify(option.metadata || {}),
      ]
    );
  }

  /**
   * Delete variant option
   */
  static async deleteVariantOption(id: string): Promise<void> {
    await dbQuery(`UPDATE "variant_option" SET deleted_at = NOW(), status = 'inactive' WHERE id = $1`, [id]);
  }

  /**
   * Atomically create a packaging master product and its default variant.
   * Enforces:
   * - merchandise_type = 'PACKAGING'
   * - mandatory title and SKU
   * - variant uniqueness (unique SKU constraint)
   * - handle uniqueness
   * - manage_inventory = true
   * - transactional atomicity (all or nothing)
   * - audit log trail in public.audit_log
   */
  static async createPackagingProductWithVariant(
    input: CreatePackagingProductInput,
    actorUserId?: string,
    externalClient?: any
  ): Promise<CreatePackagingProductResult> {
    if (!input || typeof input !== "object") {
      throw new Error("Validation error: input object is required.");
    }
    const title = (input.title || "").trim();
    if (!title) {
      throw new Error("Validation error: 'title' is required and must not be empty.");
    }
    const rawSku = (input.sku || "").trim();
    if (!rawSku) {
      throw new Error("Validation error: 'sku' is required and must not be empty.");
    }
    const sku = rawSku.toUpperCase();

    // Validate status
    const allowedStatuses = ["draft", "proposed", "published", "rejected"];
    const status = input.status ? input.status.toLowerCase() : "draft";
    if (!allowedStatuses.includes(status)) {
      throw new Error(`Validation error: invalid status '${input.status}'. Allowed: ${allowedStatuses.join(", ")}`);
    }

    // Generate or validate handle
    const handle = (input.handle || title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""))
      .trim()
      .toLowerCase();
    if (!handle) {
      throw new Error("Validation error: valid 'handle' could not be derived.");
    }

    const runner = async (client: any) => {
      // 1. Check SKU uniqueness
      const existingSku = await client.query(
        `SELECT id, product_id FROM public.product_variant WHERE sku = $1 AND deleted_at IS NULL LIMIT 1`,
        [sku]
      );
      if (existingSku.rows.length > 0) {
        const err = new Error(`DUPLICATE_SKU: SKU '${sku}' is already in use by variant '${existingSku.rows[0].id}'.`);
        (err as any).code = "DUPLICATE_SKU";
        throw err;
      }

      // 2. Check handle uniqueness
      const existingHandle = await client.query(
        `SELECT id FROM public.product WHERE handle = $1 AND deleted_at IS NULL LIMIT 1`,
        [handle]
      );
      if (existingHandle.rows.length > 0) {
        const err = new Error(`DUPLICATE_HANDLE: Handle '${handle}' is already in use by product '${existingHandle.rows[0].id}'.`);
        (err as any).code = "DUPLICATE_HANDLE";
        throw err;
      }

      // 3. Generate IDs
      const prodId = `prod_pkg_${crypto.randomBytes(8).toString("hex")}`;
      const varId = `var_pkg_${crypto.randomBytes(8).toString("hex")}`;

      // 4. Construct metadata (cost_price is explicitly non-authoritative for accounting)
      const costPrice = typeof input.cost_price === "number" ? input.cost_price : (input.cost_price ? Number(input.cost_price) : null);
      const gstRate = typeof input.gst_rate === "number" ? input.gst_rate : (input.gst_rate ? Number(input.gst_rate) : null);

      const metadata: Record<string, any> = {
        sku,
        uqc: (input.uqc || "NOS").trim().toUpperCase(),
        hsn_code: input.hsn_code ? input.hsn_code.trim() : null,
        gst_rate: gstRate,
        tax_class: input.tax_class ? input.tax_class.trim() : null,
        cost_price: costPrice, // Informational / non-authoritative
        pim_config: { inventory_mode: "STOCK_CONTROLLED" },
        category: "Packaging",
        category_slug: "packaging",
        ...(input.metadata || {}),
      };

      // 5. Insert Product
      const prodRes = await client.query(
        `
        INSERT INTO public.product (
          id, title, handle, description, status, merchandise_type,
          is_giftcard, discountable, metadata, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, 'PACKAGING',
          false, true, $6, NOW(), NOW()
        )
        RETURNING id, title, handle, status, merchandise_type, created_at;
        `,
        [prodId, title, handle, input.description?.trim() || null, status, JSON.stringify(metadata)]
      );

      const createdProduct = prodRes.rows[0];

      // 6. Insert Product Variant (Default 1:1 variant with manage_inventory = true)
      const varRes = await client.query(
        `
        INSERT INTO public.product_variant (
          id, product_id, title, sku, manage_inventory, allow_backorder,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, true, false,
          NOW(), NOW()
        )
        RETURNING id, product_id, title, sku, manage_inventory, created_at;
        `,
        [varId, prodId, `${title} - Standard`, sku]
      );

      const createdVariant = varRes.rows[0];

      // 7. Audit log trail
      const auditId = `aud_${crypto.randomBytes(12).toString("hex")}`;
      await client.query(
        `
        INSERT INTO public.audit_log (
          id, actor_id, actor_type, action, entity, entity_id, metadata, created_at, updated_at
        ) VALUES (
          $1, $2, 'staff', 'catalog.packaging_product_created', 'product', $3, $4, NOW(), NOW()
        );
        `,
        [
          auditId,
          actorUserId || "system",
          prodId,
          JSON.stringify({
            sku,
            handle,
            merchandise_type: "PACKAGING",
            variant_id: varId,
            status,
          }),
        ]
      );

      return {
        product: {
          id: createdProduct.id,
          title: createdProduct.title,
          handle: createdProduct.handle,
          merchandise_type: "PACKAGING" as const,
          status: createdProduct.status,
          created_at: createdProduct.created_at?.toISOString ? createdProduct.created_at.toISOString() : String(createdProduct.created_at),
        },
        variant: {
          id: createdVariant.id,
          product_id: createdVariant.product_id,
          title: createdVariant.title,
          sku: createdVariant.sku,
          manage_inventory: Boolean(createdVariant.manage_inventory),
          created_at: createdVariant.created_at?.toISOString ? createdVariant.created_at.toISOString() : String(createdVariant.created_at),
        },
      };
    };

    if (externalClient) {
      return runner(externalClient);
    }
    return dbTransaction(runner);
  }
}

import { dbQuery, dbTransaction } from "../db";
import { ProductDomain, VariantOptionDomain } from "../types/domain";

export class ProductRepository {
  /**
   * Find all active products from PostgreSQL
   */
  static async findAll(): Promise<ProductDomain[]> {
    const res = await dbQuery(
      `SELECT * FROM "product" WHERE deleted_at IS NULL ORDER BY created_at ASC`
    );
    return (res.rows || []).map((p: any) => {
      const meta = p.metadata || {};
      const price = Number(meta.price || meta.selling_price || 599);
      return {
        id: p.id,
        product_id: p.id,
        title: p.title,
        name: p.title,
        handle: p.handle,
        slug: p.handle || p.id,
        description: p.description || "",
        short_description: meta.short_description || p.description || "",
        thumbnail: p.thumbnail || "",
        gallery: Array.isArray(meta.gallery) ? meta.gallery : [p.thumbnail || ""],
        status: p.status || "published",
        price,
        selling_price: price,
        cost_price: Number(meta.cost_price || 350),
        mrp: Number(meta.mrp || 799),
        rating: Number(meta.rating) || 4.9,
        review_count: Number(meta.review_count) || 12,
        category: meta.category || "Cakes",
        category_slug: meta.category_slug || "cakes",
        primary_category_id: meta.primary_category_id || "cat_chocolate",
        secondary_category_ids: meta.secondary_category_ids || [],
        category_ids: meta.category_ids || [],
        flavour: meta.flavour || "Chocolate",
        cake_base: meta.cake_base || "Chocolate",
        filling: meta.filling || "Chocolate Ganache",
        cream: meta.cream || "Fresh Cream",
        texture: meta.texture || "Soft & Moist",
        weight: p.weight || "1 kg",
        variants_json: meta.variants_json || { weights: ["0.5 kg", "1 kg", "1.5 kg", "2 kg"] },
        add_ons_json: meta.add_ons_json || {},
        tags: meta.tags || "",
        occasion: meta.occasion || "Birthday",
        occasion_ids: meta.occasion_ids || ["occ_birthday"],
        brand: meta.brand || "CakeToHome Signature",
        cake_type: meta.cake_type || "Layer Cake",
        gst_rate: Number(meta.gst_rate || 5),
        tax_class: meta.tax_class || "GST_FOOD_5",
        tax_configuration_id: meta.tax_configuration_id || "txcfg_food_5",
        hsn_code: meta.hsn_code || "19059090",
        hsn_description: meta.hsn_description || "Cakes, Pastries & Bakery Goods",
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
        weight_prices: meta.weight_prices || [],
        enable_flavor_selection: meta.enable_flavor_selection,
        enable_shape_selection: meta.enable_shape_selection,
        created_at: p.created_at,
        updated_at: p.updated_at,
      };
    });
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
    const p = res.rows[0];
    const meta = p.metadata || {};
    const price = Number(meta.price || meta.selling_price || 599);
    return {
      id: p.id,
      product_id: p.id,
      title: p.title,
      name: p.title,
      handle: p.handle,
      slug: p.handle || p.id,
      description: p.description || "",
      short_description: meta.short_description || p.description || "",
      thumbnail: p.thumbnail || "",
      gallery: Array.isArray(meta.gallery) ? meta.gallery : [p.thumbnail || ""],
      status: p.status || "published",
      price,
      selling_price: price,
      cost_price: Number(meta.cost_price || 350),
      mrp: Number(meta.mrp || 799),
      rating: Number(meta.rating) || 4.9,
      review_count: Number(meta.review_count) || 12,
      category: meta.category || "Cakes",
      category_slug: meta.category_slug || "cakes",
      primary_category_id: meta.primary_category_id || "cat_chocolate",
      secondary_category_ids: meta.secondary_category_ids || [],
      category_ids: meta.category_ids || [],
      flavour: meta.flavour || "Chocolate",
      cake_base: meta.cake_base || "Chocolate",
      filling: meta.filling || "Chocolate Ganache",
      cream: meta.cream || "Fresh Cream",
      texture: meta.texture || "Soft & Moist",
      weight: p.weight || "1 kg",
      variants_json: meta.variants_json || { weights: ["0.5 kg", "1 kg", "1.5 kg", "2 kg"] },
      add_ons_json: meta.add_ons_json || {},
      tags: meta.tags || "",
      occasion: meta.occasion || "Birthday",
      occasion_ids: meta.occasion_ids || ["occ_birthday"],
      brand: meta.brand || "CakeToHome Signature",
      cake_type: meta.cake_type || "Layer Cake",
      gst_rate: Number(meta.gst_rate || 5),
      tax_class: meta.tax_class || "GST_FOOD_5",
      tax_configuration_id: meta.tax_configuration_id || "txcfg_food_5",
      hsn_code: meta.hsn_code || "19059090",
      hsn_description: meta.hsn_description || "Cakes, Pastries & Bakery Goods",
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
      weight_prices: meta.weight_prices || [],
      enable_flavor_selection: meta.enable_flavor_selection,
      enable_shape_selection: meta.enable_shape_selection,
      created_at: p.created_at,
      updated_at: p.updated_at,
    };
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

    const metadata = {
      price: product.price || product.selling_price || 599,
      selling_price: product.selling_price || product.price || 599,
      cost_price: product.cost_price || 350,
      mrp: product.mrp || 799,
      rating: product.rating || 4.9,
      review_count: product.review_count || 12,
      category: product.category || "Cakes",
      category_slug: product.category_slug || "cakes",
      primary_category_id: product.primary_category_id || "cat_chocolate",
      secondary_category_ids: product.secondary_category_ids || [],
      category_ids: product.category_ids || [],
      flavour: product.flavour || "Chocolate",
      cake_base: product.cake_base || "Chocolate",
      filling: product.filling || "Chocolate Ganache",
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
      gst_rate: product.gst_rate || 5,
      tax_class: product.tax_class || "GST_FOOD_5",
      tax_configuration_id: product.tax_configuration_id || "txcfg_food_5",
      hsn_code: product.hsn_code || "19059090",
      hsn_description: product.hsn_description || "Cakes, Pastries & Bakery Goods",
      uqc: product.uqc || "NOS",
      taxability: product.taxability || "Taxable",
      tax_inclusive: product.tax_inclusive !== false,
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
      pim_config: product.pim_config || {},
      flavors: product.flavors || [],
      shapes: product.shapes || [],
      fillings: product.fillings || [],
      creams: product.creams || [],
      weight_prices: product.weight_prices || [],
      enable_flavor_selection: product.enable_flavor_selection,
      enable_shape_selection: product.enable_shape_selection,
    };

    await dbQuery(
      `
      INSERT INTO "product" (id, title, handle, description, thumbnail, status, weight, metadata, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        handle = EXCLUDED.handle,
        description = EXCLUDED.description,
        thumbnail = EXCLUDED.thumbnail,
        status = EXCLUDED.status,
        weight = EXCLUDED.weight,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    `,
      [id, title, handle, description, thumbnail, status, product.weight || "1 kg", JSON.stringify(metadata)]
    );
  }

  /**
   * Soft delete / archive product in PostgreSQL
   */
  static async delete(id: string): Promise<void> {
    await dbQuery(`UPDATE "product" SET deleted_at = NOW(), status = 'archived' WHERE id = $1`, [id]);
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
}

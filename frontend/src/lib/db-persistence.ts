/**
 * CakeToHome — Authoritative PostgreSQL Database Persistence Layer
 *
 * Direct asynchronous persistence to PostgreSQL for all domain entities.
 * Enforces authoritative database durability.
 */

import { dbQuery, dbTransaction } from "./db";

// Default Shop ID in Medusa
const DEFAULT_SHOP_ID = "res_01KXYMAHGFPRY1G9TZKEVGAGAT";

export const SEED_MASTER_VARIANT_OPTIONS = [
  // Weights
  { id: "opt_w_01", type: "weight", name: "0.5 kg", display_name: "500 Grams", price_modifier: 0, display_order: 1 },
  { id: "opt_w_02", type: "weight", name: "1.0 kg", display_name: "1.0 Kilogram", price_modifier: 0, display_order: 2 },
  { id: "opt_w_03", type: "weight", name: "1.5 kg", display_name: "1.5 Kilograms", price_modifier: 0, display_order: 3 },
  { id: "opt_w_04", type: "weight", name: "2.0 kg", display_name: "2.0 Kilograms", price_modifier: 0, display_order: 4 },
  { id: "opt_w_05", type: "weight", name: "5.0 kg", display_name: "5.0 Kilograms (Party Size)", price_modifier: 0, display_order: 5 },

  // Shapes
  { id: "opt_s_01", type: "shape", name: "Round", display_name: "Classic Round", price_modifier: 0, display_order: 1 },
  { id: "opt_s_02", type: "shape", name: "Heart", display_name: "Romantic Heart Shape", price_modifier: 150, display_order: 2 },
  { id: "opt_s_03", type: "shape", name: "Square", display_name: "Modern Square", price_modifier: 200, display_order: 3 },
  { id: "opt_s_04", type: "shape", name: "2-Tier Designer", display_name: "Grand 2-Tier Designer", price_modifier: 2500, display_order: 4 },

  // Flavours
  { id: "opt_f_01", type: "flavour", name: "Belgian Dark Chocolate", display_name: "Belgian Dark Chocolate", price_modifier: 0, display_order: 1 },
  { id: "opt_f_02", type: "flavour", name: "Red Velvet", display_name: "Red Velvet Cream Cheese", price_modifier: 0, display_order: 2 },
  { id: "opt_f_03", type: "flavour", name: "Alphonso Mango", display_name: "Alphonso Mango Fresh Fruit", price_modifier: 0, display_order: 3 },
  { id: "opt_f_04", type: "flavour", name: "Lotus Biscoff", display_name: "Lotus Biscoff Caramel", price_modifier: 100, display_order: 4 },
  { id: "opt_f_05", type: "flavour", name: "Ferrero Rocher", display_name: "Ferrero Rocher Hazelnut", price_modifier: 150, display_order: 5 },

  // Fillings
  { id: "opt_fil_01", type: "filling", name: "Chocolate Ganache", display_name: "Rich Chocolate Ganache Layer", price_modifier: 100, display_order: 1 },
  { id: "opt_fil_02", type: "filling", name: "Nutella Spread", display_name: "Hazelnut Nutella Filling", price_modifier: 150, display_order: 2 },
  { id: "opt_fil_03", type: "filling", name: "Lotus Biscoff Crunch", display_name: "Biscoff Cookie Butter Filling", price_modifier: 250, display_order: 3 },
  { id: "opt_fil_04", type: "filling", name: "Fresh Exotic Fruits", display_name: "Exotic Fresh Fruit Chunks", price_modifier: 300, display_order: 4 },

  // Creams
  { id: "opt_c_01", type: "cream", name: "Fresh Cream", display_name: "Silky Fresh Dairy Cream", price_modifier: 0, display_order: 1 },
  { id: "opt_c_02", type: "cream", name: "Ganache", display_name: "Dark Chocolate Ganache Frosting", price_modifier: 200, display_order: 2 },
  { id: "opt_c_03", type: "cream", name: "Fondant Finish", display_name: "Smooth Sculpted Fondant", price_modifier: 300, display_order: 3 },

  // Toppers & Add-ons
  { id: "opt_top_01", type: "topper", name: "Gold Acrylic Topper", display_name: "Golden Acrylic Happy Birthday Topper", price_modifier: 99, display_order: 1 },
  { id: "opt_top_02", type: "topper", name: "Custom Name Topper", display_name: "Laser-cut Custom Name Acrylic Topper", price_modifier: 149, display_order: 2 },
  { id: "opt_add_01", type: "addon", name: "Magic Birthday Candles", display_name: "Pack of 10 Magic Re-lighting Candles", price_modifier: 49, display_order: 1 },
  { id: "opt_add_02", type: "addon", name: "Greeting Card", display_name: "Custom Handwritten Message Greeting Card", price_modifier: 99, display_order: 2 },
  { id: "opt_add_03", type: "addon", name: "Red Rose Bouquet", display_name: "Fresh Bouquet of 10 Red Roses", price_modifier: 299, display_order: 3 },
];

/**
 * Hydrates in-memory store from PostgreSQL
 */
export async function hydrateStoreFromDatabase(targetStore?: any): Promise<any> {
  targetStore = targetStore || {};
  try {
    // Ensure core schema extension tables exist
    await Promise.allSettled([
      dbQuery(`
        CREATE TABLE IF NOT EXISTS "variant_option" (
          "id" text NOT NULL,
          "type" text NOT NULL,
          "name" text NOT NULL,
          "display_name" text NOT NULL,
          "price_modifier" double precision NOT NULL DEFAULT 0,
          "display_order" integer NOT NULL DEFAULT 1,
          "status" text NOT NULL DEFAULT 'active',
          "is_enabled" boolean NOT NULL DEFAULT true,
          "metadata" jsonb NULL,
          "created_at" timestamptz NOT NULL DEFAULT now(),
          "updated_at" timestamptz NOT NULL DEFAULT now(),
          "deleted_at" timestamptz NULL,
          CONSTRAINT "variant_option_pkey" PRIMARY KEY ("id")
        );
      `),
      dbQuery(`
        CREATE TABLE IF NOT EXISTS "customer_favorite" (
          "id" text NOT NULL,
          "customer_uid" text NOT NULL,
          "product_id" text NOT NULL,
          "created_at" timestamptz NOT NULL DEFAULT now(),
          "deleted_at" timestamptz NULL,
          CONSTRAINT "customer_favorite_pkey" PRIMARY KEY ("id")
        );
      `),
      dbQuery(`
        CREATE TABLE IF NOT EXISTS "product_review" (
          "id" text NOT NULL,
          "product_id" text NOT NULL,
          "customer_uid" text NOT NULL,
          "customer_name" text NOT NULL DEFAULT 'Valued Customer',
          "order_id" text NULL,
          "order_item_id" text NULL,
          "rating" integer NOT NULL DEFAULT 5,
          "title" text NOT NULL DEFAULT '',
          "review_text" text NOT NULL DEFAULT '',
          "purchased_variant" text NULL,
          "is_verified_purchase" boolean NOT NULL DEFAULT true,
          "status" text NOT NULL DEFAULT 'APPROVED',
          "admin_response" jsonb NULL,
          "helpful_votes" integer NOT NULL DEFAULT 0,
          "created_at" timestamptz NOT NULL DEFAULT now(),
          "updated_at" timestamptz NOT NULL DEFAULT now(),
          "published_at" timestamptz NULL,
          "deleted_at" timestamptz NULL,
          CONSTRAINT "product_review_pkey" PRIMARY KEY ("id")
        );
      `),
    ]).catch(() => null);

    const [
      branchesRes,
      zonesRes,
      citiesRes,
      productsRes,
      customersRes,
      addressesRes,
      partnersRes,
      ordersRes,
      cmsPagesRes,
      cmsSectionsRes,
      offersRes,
      settingsRes,
      popupCampaignsRes,
      variantOptionsRes,
      favoritesRes,
      reviewsRes,
    ] = await Promise.all([
      dbQuery(`SELECT * FROM "branch" WHERE deleted_at IS NULL ORDER BY created_at ASC`),
      dbQuery(`SELECT * FROM "delivery_zone" WHERE deleted_at IS NULL ORDER BY priority DESC`),
      dbQuery(`SELECT * FROM "city" WHERE deleted_at IS NULL ORDER BY id ASC`),
      dbQuery(`SELECT * FROM "product" WHERE deleted_at IS NULL ORDER BY created_at ASC`),
      dbQuery(`SELECT * FROM "customer" WHERE deleted_at IS NULL ORDER BY created_at ASC`),
      dbQuery(`SELECT * FROM "customer_address" WHERE deleted_at IS NULL ORDER BY created_at ASC`),
      dbQuery(`SELECT * FROM "delivery_partner" WHERE deleted_at IS NULL ORDER BY created_at ASC`),
      dbQuery(`SELECT * FROM "order" WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 500`),
      dbQuery(`SELECT * FROM "cms_page" ORDER BY created_at ASC`),
      dbQuery(`SELECT * FROM "cms_homepage_section" ORDER BY sort_order ASC`),
      dbQuery(`SELECT * FROM "offer" WHERE deleted_at IS NULL ORDER BY created_at ASC`),
      dbQuery(`SELECT * FROM "setting" WHERE deleted_at IS NULL ORDER BY created_at ASC`),
      dbQuery(`SELECT * FROM "popup_campaigns" WHERE deleted_at IS NULL ORDER BY created_at ASC`),
      dbQuery(`SELECT * FROM "variant_option" WHERE deleted_at IS NULL ORDER BY display_order ASC`).catch(() => ({ rows: [] })),
      dbQuery(`SELECT * FROM "customer_favorite" WHERE deleted_at IS NULL ORDER BY created_at DESC`).catch(() => ({ rows: [] })),
      dbQuery(`SELECT * FROM "product_review" WHERE deleted_at IS NULL ORDER BY created_at DESC`).catch(() => ({ rows: [] })),
    ]);

    // 1. Zones Map by Branch
    const zonesByBranch = new Map<string, any[]>();
    for (const z of zonesRes.rows) {
      const bId = z.branch_id;
      if (!zonesByBranch.has(bId)) {
        zonesByBranch.set(bId, []);
      }
      zonesByBranch.get(bId)!.push({
        id: z.id,
        branch_id: z.branch_id,
        pincode: z.pincode,
        delivery_fee: Number(z.delivery_fee || 0),
        base_fee: Number(z.delivery_fee || 0),
        radius_km: Number(z.radius_km || 10),
        polygon_coordinates: Array.isArray(z.polygon_coordinates) ? z.polygon_coordinates : [],
        priority: z.priority || 10,
        estimated_delivery_minutes: z.estimated_delivery_minutes || 35,
        enabled: z.is_serviceable !== false,
        name: z.pincode ? `Pincode ${z.pincode}` : `Zone ${z.id}`,
      });
    }

    // 2. Branches — UNCONDITIONAL HYDRATION FROM POSTGRESQL
    targetStore.branches = (branchesRes.rows || []).map((b) => {
      const meta = b.metadata || {};
      const branchZones = zonesByBranch.get(b.id) || meta.delivery_zones || [];
      return {
        id: b.id,
        name: b.name,
        code: b.code || b.id,
        phone: b.phone || "+91 98765 43210",
        email: b.email || "store@caketohome.com",
        address: b.address || "Bakery Hub",
        city_id: b.city_id || "city_bbr",
        city: meta.city || "Bengaluru",
        state: meta.state || "Karnataka",
        latitude: typeof b.latitude === "number" ? b.latitude : 8.8932,
        longitude: typeof b.longitude === "number" ? b.longitude : 76.6141,
        is_open: b.is_open !== false,
        is_archived: b.is_active === false,
        status: b.is_active === false ? "archived" : "active",
        operational_status: meta.operational_status || "operational",
        extended_status: meta.extended_status || "open",
        branch_type: meta.branch_type || "main_hub",
        manager_id: meta.manager_id || null,
        manager_account: meta.manager_account || null,
        max_delivery_radius_km: Number(meta.max_delivery_radius_km || 15),
        weekly_schedule: meta.weekly_schedule || {},
        fulfillment_rules: meta.fulfillment_rules || {},
        delivery_zones: branchZones,
        deliverable_areas: meta.deliverable_areas || [meta.city || "Bengaluru"],
        capacity_settings: meta.capacity_settings || {},
        product_availability: meta.product_availability || {},
        created_at: b.created_at,
        updated_at: b.updated_at,
      };
    });

    // 3. Cities — UNCONDITIONAL HYDRATION FROM POSTGRESQL
    targetStore.cities = (citiesRes.rows || []).map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.id.replace("city_", ""),
      state: c.state || "Karnataka",
      state_code: c.state_code || "KA",
      country: "India",
      countryCode: "IN",
      timezone: "Asia/Kolkata",
      currency: "INR",
      phoneCode: "+91",
      status: c.is_active !== false ? "active" : "archived",
      is_active: c.is_active !== false,
      created_at: c.created_at,
    }));

    // 4. Products & Weight Prices Matrix — UNCONDITIONAL HYDRATION FROM POSTGRESQL
    const weightPricesList: any[] = [];
    targetStore.products = (productsRes.rows || []).map((p) => {
      const meta = p.metadata || {};
      const price = Number(meta.price || meta.selling_price || 599);
      const pId = p.id;

      // Hydrate product-scoped weight pricing matrix from authoritative metadata
      if (Array.isArray(meta.weight_prices) && meta.weight_prices.length > 0) {
        meta.weight_prices.forEach((wp: any) => {
          if (wp && wp.weight_name) {
            weightPricesList.push({
              ...wp,
              product_id: pId,
              id: wp.id || `wp_${pId}_${wp.normalized_grams || wp.weight_name}`,
            });
          }
        });
      }

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
        category: meta.category || "",
        category_slug: meta.category_slug || (meta.category ? meta.category.toLowerCase().replace(/[^a-z0-9]+/g, "-") : ""),
        primary_category_id: meta.primary_category_id || "",
        secondary_category_ids: meta.secondary_category_ids || [],
        category_ids: meta.category_ids || (meta.primary_category_id ? [meta.primary_category_id] : []),
        flavour: meta.flavour || "",
        cake_base: meta.cake_base || meta.flavour || "",
        filling: meta.filling || "",
        cream: meta.cream || "",
        texture: meta.texture || "Soft & Moist",
        weight: p.weight || (meta.weight_prices?.[0]?.weight_name || "1 kg"),
        variants_json: meta.variants_json || { weights: ["0.5 kg", "1 kg", "1.5 kg", "2 kg"] },
        add_ons_json: meta.add_ons_json || {},
        tags: meta.tags || "",
        occasion: meta.occasion || "",
        occasion_ids: meta.occasion_ids || [],
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
        max_delivery_distance_km: (meta.max_delivery_distance_km != null || meta.pim_config?.max_delivery_distance_km != null)
          ? Number(meta.max_delivery_distance_km ?? meta.pim_config?.max_delivery_distance_km)
          : null,
        pim_config: {
          ...(meta.pim_config || {}),
          max_delivery_distance_km: (meta.max_delivery_distance_km != null || meta.pim_config?.max_delivery_distance_km != null)
            ? Number(meta.max_delivery_distance_km ?? meta.pim_config?.max_delivery_distance_km)
            : null,
        },
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

    targetStore.product_weight_prices = weightPricesList;

    // 5. Variant Options (Flavors, Shapes, Fillings, Creams) from PostgreSQL
    if (variantOptionsRes.rows && variantOptionsRes.rows.length > 0) {
      targetStore.variant_options = variantOptionsRes.rows.map((vo: any) => ({
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
        created_at: vo.created_at,
        updated_at: vo.updated_at,
      }));
    } else {
      // First boot: Seed master variant options into PostgreSQL so they become durable
      targetStore.variant_options = SEED_MASTER_VARIANT_OPTIONS.map((vo) => ({
        ...vo,
        extra_price: vo.price_modifier,
        additional_price: vo.price_modifier,
        status: "active",
        is_enabled: true,
        enabled: true,
      }));
      for (const seed of SEED_MASTER_VARIANT_OPTIONS) {
        persistVariantOptionToDb(seed).catch(() => null);
      }
    }

    // 6. Addresses Map by Customer
    const addrsByCust = new Map<string, any[]>();
    for (const a of addressesRes.rows || []) {
      const cId = a.customer_id;
      if (!addrsByCust.has(cId)) {
        addrsByCust.set(cId, []);
      }
      const meta = a.metadata || {};
      addrsByCust.get(cId)!.push({
        id: a.id,
        first_name: a.first_name,
        last_name: a.last_name,
        name: `${a.first_name || ""} ${a.last_name || ""}`.trim() || "Customer",
        address_1: a.address_1,
        address_2: a.address_2 || "",
        city: a.city,
        postal_code: a.postal_code,
        pincode: a.postal_code,
        phone: a.phone || "",
        landmark: meta.landmark || "",
        latitude: meta.latitude,
        longitude: meta.longitude,
        is_default: Boolean(meta.is_default),
        type: meta.type || "HOME",
        label: meta.label || "Home",
      });
    }

    // 7. Customers — UNCONDITIONAL HYDRATION FROM POSTGRESQL
    targetStore.customers = (customersRes.rows || []).map((c) => {
      const meta = c.metadata || {};
      const custAddrs = addrsByCust.get(c.id) || meta.addresses || [];
      return {
        id: c.id,
        customer_uid: meta.customer_uid || c.id,
        first_name: c.first_name,
        last_name: c.last_name,
        name: `${c.first_name || ""} ${c.last_name || ""}`.trim() || "Valued Customer",
        full_name: `${c.first_name || ""} ${c.last_name || ""}`.trim() || "Valued Customer",
        email: c.email || "",
        phone: c.phone || "",
        normalized_phone: meta.normalized_phone || c.phone,
        role: meta.role || "CUSTOMER",
        wallet_balance: Number(meta.wallet_balance || 0),
        addresses: custAddrs,
        preferences: meta.preferences || {},
        orders_count: Number(meta.orders_count || 0),
        total_spend: Number(meta.total_spend || 0),
        created_at: c.created_at,
        updated_at: c.updated_at,
      };
    });

    // 8. Delivery Partners — UNCONDITIONAL HYDRATION FROM POSTGRESQL
    targetStore.delivery_partners = (partnersRes.rows || []).map((d) => ({
      id: d.id,
      name: `${d.first_name || ""} ${d.last_name || ""}`.trim() || "Delivery Partner",
      first_name: d.first_name,
      last_name: d.last_name,
      email: d.email,
      phone: d.phone,
      avatar_url: d.avatar_url,
      is_active: d.is_active !== false,
      status: d.is_active !== false ? "active" : "inactive",
      total_deliveries: Number(d.total_deliveries || 0),
      active_orders: Number(d.active_orders || 0),
      rating: Number(d.rating || 4.9),
      created_at: d.created_at,
    }));

    // 9. Orders — UNCONDITIONAL HYDRATION FROM POSTGRESQL
    targetStore.orders = (ordersRes.rows || []).map((o) => {
      const meta = o.metadata || {};
      return {
        id: o.id,
        order_id: o.id,
        display_id: o.display_id || o.id,
        order_number: meta.order_number || o.display_id || `ORD-${o.id.slice(-6)}`,
        customer_id: meta.customer_uid || o.email || "guest",
        customer_uid: meta.customer_uid || "guest",
        customer_name: meta.customer_name || "Valued Customer",
        customer_email: o.email || "",
        customer_phone: meta.customer_phone || "",
        total_amount: Number(o.total || 0),
        total: Number(o.total || 0),
        currency: o.currency_code || "INR",
        status: meta.bakery_status || o.status || "confirmed",
        payment_status: meta.payment_status || "captured",
        payment_method: meta.payment_method || "card",
        delivery: meta.delivery || {
          type: "standard",
          date: meta.delivery_date,
          slot: meta.delivery_slot_time,
          fee: 0,
        },
        delivery_latitude: typeof o.delivery_latitude === "number" ? o.delivery_latitude : meta.delivery_latitude,
        delivery_longitude: typeof o.delivery_longitude === "number" ? o.delivery_longitude : meta.delivery_longitude,
        branch_id: o.branch_id || meta.branch_id || "br_indiranagar",
        items: meta.items || [],
        created_at: o.created_at,
        updated_at: o.updated_at,
      };
    });

    // 10. CMS Pages & Sections — UNCONDITIONAL HYDRATION FROM POSTGRESQL
    targetStore.cms_pages = (cmsPagesRes.rows || []).map((p) => {
      let blockParsed = { sections: [], draft_config: {}, published_config: null, version_history: [] };
      if (p.blocks) {
        try {
          blockParsed = typeof p.blocks === "string" ? JSON.parse(p.blocks) : p.blocks;
        } catch {}
      }
      return {
        id: p.id,
        slug: p.slug,
        title: p.title,
        type: p.type || "landing",
        status: p.status || "draft",
        meta_title: p.meta_title || p.title,
        meta_description: p.meta_description || "",
        canonical_url: p.canonical_url || "",
        og_image: p.og_image || "",
        sections: blockParsed.sections || [],
        draft_config: blockParsed.draft_config || {},
        published_config: blockParsed.published_config || null,
        version_history: blockParsed.version_history || [],
        created_at: p.created_at,
        updated_at: p.updated_at,
        published_at: p.published_at,
      };
    });

    targetStore.cms_sections = (cmsSectionsRes.rows || []).map((s) => ({
      id: s.id,
      section_id: s.id,
      type: s.type,
      title: s.title,
      subtitle: s.subtitle,
      sort_order: s.sort_order,
      is_visible: s.is_visible !== false,
      settings: s.settings || {},
      created_at: s.created_at,
      updated_at: s.updated_at,
    }));

    // 11. Offers — UNCONDITIONAL HYDRATION FROM POSTGRESQL
    targetStore.offers = (offersRes.rows || []).map((off) => {
      const meta = off.metadata || {};
      return {
        id: off.id,
        name: off.name,
        code: off.code,
        type: off.type,
        discount_type: off.type,
        discount_value: Number(off.discount_value || 0),
        min_order: Number(off.min_order || 0),
        is_active: off.is_active !== false,
        description: off.description,
        rules: meta.rules || {},
        created_at: off.created_at,
        updated_at: off.updated_at,
      };
    });

    // 12. Settings & Authoritative Domain Configs
    targetStore.settings = (settingsRes.rows || []).map((s) => ({
      id: s.id,
      group: s.group,
      key: s.key,
      value: s.value,
      is_public: s.is_public !== false,
      created_at: s.created_at,
      updated_at: s.updated_at,
    }));

    if (settingsRes.rows && settingsRes.rows.length > 0) {
      // Authoritative Fulfillment Config Hydration
      const fulfillmentSetting = settingsRes.rows.find(
        (s) => (s.key === "config" && s.group === "fulfillment") || s.key === "fulfillment_config"
      );
      if (fulfillmentSetting && fulfillmentSetting.value) {
        try {
          const val = typeof fulfillmentSetting.value === "string" ? JSON.parse(fulfillmentSetting.value) : fulfillmentSetting.value;
          targetStore.fulfillment_config = {
            ...targetStore.fulfillment_config,
            ...val,
          };
        } catch {}
      }

      // Authoritative PIM Categories Hydration
      const categoriesSetting = settingsRes.rows.find(
        (s) => (s.key === "categories" && s.group === "pim") || s.key === "pim_categories"
      );
      if (categoriesSetting && categoriesSetting.value) {
        try {
          const val = typeof categoriesSetting.value === "string" ? JSON.parse(categoriesSetting.value) : categoriesSetting.value;
          if (Array.isArray(val) && val.length > 0) {
            targetStore.pim_categories = val;
          }
        } catch {}
      }

      // Authoritative Occasions Hydration
      const occasionsSetting = settingsRes.rows.find(
        (s) => (s.key === "occasions" && s.group === "taxonomy") || s.key === "occasions"
      );
      if (occasionsSetting && occasionsSetting.value) {
        try {
          const val = typeof occasionsSetting.value === "string" ? JSON.parse(occasionsSetting.value) : occasionsSetting.value;
          if (Array.isArray(val) && val.length > 0) {
            targetStore.occasions = val;
          }
        } catch {}
      }

      // Authoritative Accessories Hydration
      const accessoriesSetting = settingsRes.rows.find(
        (s) => (s.key === "accessories" && s.group === "catalog") || s.key === "accessories"
      );
      if (accessoriesSetting && accessoriesSetting.value) {
        try {
          const val = typeof accessoriesSetting.value === "string" ? JSON.parse(accessoriesSetting.value) : accessoriesSetting.value;
          if (Array.isArray(val) && val.length > 0) {
            targetStore.accessories = val;
          }
        } catch {}
      }

      // Authoritative Accessory Categories Hydration
      const accCategoriesSetting = settingsRes.rows.find(
        (s) => (s.key === "accessory_categories" && s.group === "catalog") || s.key === "accessory_categories"
      );
      if (accCategoriesSetting && accCategoriesSetting.value) {
        try {
          const val = typeof accCategoriesSetting.value === "string" ? JSON.parse(accCategoriesSetting.value) : accCategoriesSetting.value;
          if (Array.isArray(val) && val.length > 0) {
            targetStore.accessory_categories = val;
          }
        } catch {}
      }

      // Authoritative Cross Sell Rules Hydration
      const crossSellSetting = settingsRes.rows.find(
        (s) => (s.key === "cross_sell_rules" && s.group === "catalog") || s.key === "cross_sell_rules"
      );
      if (crossSellSetting && crossSellSetting.value) {
        try {
          const val = typeof crossSellSetting.value === "string" ? JSON.parse(crossSellSetting.value) : crossSellSetting.value;
          if (Array.isArray(val) && val.length > 0) {
            targetStore.cross_sell_rules = val;
          }
        } catch {}
      }

      // Authoritative Business Profile Hydration
      const businessProfileSetting = settingsRes.rows.find(
        (s) => (s.key === "business_profile" && s.group === "general") || s.key === "business_profile"
      );
      if (businessProfileSetting && businessProfileSetting.value) {
        try {
          const val = typeof businessProfileSetting.value === "string" ? JSON.parse(businessProfileSetting.value) : businessProfileSetting.value;
          if (val && typeof val === "object") {
            targetStore.business_profile = { ...(targetStore.business_profile || {}), ...val };
          }
        } catch {}
      }

      // Authoritative Delivery Defaults Hydration
      const deliveryDefaultsSetting = settingsRes.rows.find(
        (s) => (s.key === "defaults" && s.group === "delivery") || s.key === "delivery_defaults"
      );
      if (deliveryDefaultsSetting && deliveryDefaultsSetting.value) {
        try {
          const val = typeof deliveryDefaultsSetting.value === "string" ? JSON.parse(deliveryDefaultsSetting.value) : deliveryDefaultsSetting.value;
          if (val && typeof val === "object") {
            targetStore.delivery_defaults = { ...(targetStore.delivery_defaults || {}), ...val };
          }
        } catch {}
      }

      // Authoritative Payment Settings Hydration
      const paymentSettingsSetting = settingsRes.rows.find(
        (s) => (s.key === "settings" && s.group === "payment") || s.key === "payment_settings"
      );
      if (paymentSettingsSetting && paymentSettingsSetting.value) {
        try {
          const val = typeof paymentSettingsSetting.value === "string" ? JSON.parse(paymentSettingsSetting.value) : paymentSettingsSetting.value;
          if (val && typeof val === "object") {
            targetStore.payment_settings = { ...(targetStore.payment_settings || {}), ...val };
          }
        } catch {}
      }

      // Authoritative Invoice Settings Hydration
      const invoiceSettingsSetting = settingsRes.rows.find(
        (s) => (s.key === "settings" && s.group === "invoice") || s.key === "invoice_settings"
      );
      if (invoiceSettingsSetting && invoiceSettingsSetting.value) {
        try {
          const val = typeof invoiceSettingsSetting.value === "string" ? JSON.parse(invoiceSettingsSetting.value) : invoiceSettingsSetting.value;
          if (val && typeof val === "object") {
            targetStore.invoice_settings = { ...(targetStore.invoice_settings || {}), ...val };
          }
        } catch {}
      }
    }

    // 13. Popup Campaigns — UNCONDITIONAL HYDRATION FROM POSTGRESQL
    targetStore.popup_campaigns = (popupCampaignsRes.rows || []).map((pop) => ({
      id: pop.id,
      name: pop.name,
      title: pop.title,
      body_text: pop.body_text,
      status: pop.status,
      target_page: pop.target_page,
      start_date: pop.start_date,
      end_date: pop.end_date,
      display_rules: pop.display_rules || {},
      created_at: pop.created_at,
      updated_at: pop.updated_at,
    }));

    // 14. Customer Favorites / Wishlist — UNCONDITIONAL HYDRATION FROM POSTGRESQL
    targetStore.customer_favorites = (favoritesRes.rows || []).map((fav) => ({
      id: fav.id,
      customer_uid: fav.customer_uid,
      product_id: fav.product_id,
      created_at: fav.created_at,
    }));

    // 15. Product Reviews — UNCONDITIONAL HYDRATION FROM POSTGRESQL
    targetStore.product_reviews = (reviewsRes.rows || []).map((rev) => {
      const replyObj = rev.reply ? {
        author: "CakeToHome Bakery Chef",
        message: rev.reply,
        responded_at: rev.replied_at || rev.updated_at,
      } : (rev.admin_response ? (typeof rev.admin_response === "string" ? JSON.parse(rev.admin_response) : rev.admin_response) : null);

      return {
        id: rev.id,
        product_id: rev.product_id,
        customer_uid: rev.customer_uid || rev.customer_id || "guest",
        customer_name: rev.customer_name || "Valued Customer",
        order_id: rev.order_id || null,
        order_item_id: rev.order_item_id || null,
        rating: Number(rev.rating || 5),
        title: rev.title || "",
        review_text: rev.review_text || rev.body || "",
        purchased_variant: rev.purchased_variant || null,
        is_verified_purchase: rev.is_verified_purchase !== undefined ? rev.is_verified_purchase : (rev.verified_purchase !== false),
        status: rev.status || "APPROVED",
        admin_response: replyObj,
        helpful_votes: Number(rev.helpful_votes || 0),
        created_at: rev.created_at,
        updated_at: rev.updated_at,
        published_at: rev.published_at || rev.created_at,
      };
    });

    const summary = {
      success: true,
      branchesCount: targetStore.branches?.length || 0,
      productsCount: targetStore.products?.length || 0,
      customersCount: targetStore.customers?.length || 0,
      ordersCount: targetStore.orders?.length || 0,
      variantOptionsCount: targetStore.variant_options?.length || 0,
      weightPricesCount: targetStore.product_weight_prices?.length || 0,
      favoritesCount: targetStore.customer_favorites?.length || 0,
      reviewsCount: targetStore.product_reviews?.length || 0,
    };
    console.log(
      `[PostgreSQL Persistence] Hydrated store: ${summary.branchesCount} branches, ${summary.productsCount} products, ${summary.customersCount} customers, ${summary.ordersCount} orders, ${summary.variantOptionsCount} variant options, ${summary.favoritesCount} favorites, ${summary.reviewsCount} reviews.`
    );
    return summary;
  } catch (err: any) {
    console.error("[PostgreSQL Persistence] Failed to hydrate store from database:", err.message);
    return { success: false, branchesCount: 0, productsCount: 0, customersCount: 0, ordersCount: 0 };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ── ENTITY PERSISTENCE MUTATIONS ─────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Persists a Branch and its Delivery Zones to PostgreSQL
 */
export async function persistBranchToDb(branch: any): Promise<void> {
  const id = branch.id;
  const lat = typeof branch.latitude === "number" ? branch.latitude : 8.8932;
  const lng = typeof branch.longitude === "number" ? branch.longitude : 76.6141;

  const metadata = {
    weekly_schedule: branch.weekly_schedule || {},
    fulfillment_rules: branch.fulfillment_rules || {},
    manager_account: branch.manager_account || null,
    manager_id: branch.manager_id || null,
    max_delivery_radius_km: branch.max_delivery_radius_km || 15,
    temporary_closure: branch.temporary_closure || null,
    location_source: branch.location_source || "GPS",
    formatted_address: branch.formatted_address || branch.address || "",
    deliverable_areas: branch.deliverable_areas || [branch.city || "Bengaluru"],
    delivery_zones: branch.delivery_zones || [],
    capacity_settings: branch.capacity_settings || {},
    product_availability: branch.product_availability || {},
    operational_status: branch.operational_status || "operational",
    extended_status: branch.extended_status || "open",
    branch_type: branch.branch_type || "main_hub",
    city: branch.city || "Bengaluru",
    state: branch.state || "Karnataka",
  };

  await dbTransaction(async (client) => {
    // 1. Upsert Branch
    await client.query(
      `
      INSERT INTO "branch" ("id", "name", "code", "is_open", "phone", "email", "address", "latitude", "longitude", "shop_id", "city_id", "metadata", "created_at", "updated_at")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
      ON CONFLICT ("id") DO UPDATE SET
        "name" = EXCLUDED.name,
        "code" = EXCLUDED.code,
        "is_open" = EXCLUDED.is_open,
        "phone" = EXCLUDED.phone,
        "email" = EXCLUDED.email,
        "address" = EXCLUDED.address,
        "latitude" = EXCLUDED.latitude,
        "longitude" = EXCLUDED.longitude,
        "metadata" = EXCLUDED.metadata,
        "updated_at" = NOW()
    `,
      [
        id,
        branch.name,
        branch.code || id,
        branch.is_open !== false,
        branch.phone || "+91 98765 43210",
        branch.email || "store@caketohome.com",
        branch.address || "Main Bakery Studio",
        lat,
        lng,
        DEFAULT_SHOP_ID,
        branch.city_id || "city_bbr",
        JSON.stringify(metadata),
      ]
    );

    // 2. Sync Delivery Zones
    const zones = Array.isArray(branch.delivery_zones) ? branch.delivery_zones : [];
    for (const z of zones) {
      const zoneId = z.id || `zone_${id}_${z.pincode || Math.random().toString(36).slice(2, 7)}`;
      const fee = Number(z.delivery_fee || z.base_fee || 0);
      const radius = Number(z.radius_km || 10);
      const polygonCoords = Array.isArray(z.polygon_coordinates) ? z.polygon_coordinates : [];

      await client.query(
        `
        INSERT INTO "delivery_zone" ("id", "pincode", "branch_id", "delivery_fee", "is_serviceable", "polygon_coordinates", "radius_km", "center_latitude", "center_longitude", "priority", "estimated_delivery_minutes", "created_at", "updated_at")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
        ON CONFLICT ("id") DO UPDATE SET
          "delivery_fee" = EXCLUDED.delivery_fee,
          "is_serviceable" = EXCLUDED.is_serviceable,
          "polygon_coordinates" = EXCLUDED.polygon_coordinates,
          "radius_km" = EXCLUDED.radius_km,
          "center_latitude" = EXCLUDED.center_latitude,
          "center_longitude" = EXCLUDED.center_longitude,
          "priority" = EXCLUDED.priority,
          "estimated_delivery_minutes" = EXCLUDED.estimated_delivery_minutes,
          "updated_at" = NOW()
      `,
        [
          zoneId,
          z.pincode || (z.pincodes && z.pincodes[0]) || "560038",
          id,
          fee,
          z.enabled !== false,
          JSON.stringify(polygonCoords),
          radius,
          lat,
          lng,
          z.priority || 10,
          z.estimated_delivery_minutes || 35,
        ]
      );
    }
  });
}

/**
 * Deletes a Delivery Zone from PostgreSQL
 */
export async function deleteBranchZoneFromDb(branchId: string, zoneId: string): Promise<void> {
  await dbQuery(`DELETE FROM "delivery_zone" WHERE "id" = $1 AND "branch_id" = $2`, [zoneId, branchId]);
}

/**
 * Persists a City to PostgreSQL
 */
export async function persistCityToDb(city: any): Promise<void> {
  const id = city.id || `city_${city.slug || city.name.toLowerCase().replace(/\s+/g, "_")}`;
  await dbQuery(
    `
    INSERT INTO "city" ("id", "name", "state", "is_active", "created_at", "updated_at")
    VALUES ($1, $2, $3, $4, NOW(), NOW())
    ON CONFLICT ("id") DO UPDATE SET
      "name" = EXCLUDED.name,
      "state" = EXCLUDED.state,
      "is_active" = EXCLUDED.is_active,
      "updated_at" = NOW()
  `,
    [id, city.name, city.state || city.state_name || "Karnataka", city.is_active !== false]
  );
}

/**
 * Persists a Product to PostgreSQL with complete metadata, PIM options & weight prices
 */
export async function persistProductToDb(product: any): Promise<void> {
  const id = product.id || product.product_id;
  const numPrice = Number(product.price || product.selling_price || 599);

  const metadata = {
    price: numPrice,
    selling_price: numPrice,
    cost_price: Number(product.cost_price || 350),
    mrp: Number(product.mrp || 799),
    rating: product.rating || 4.9,
    review_count: product.review_count || 12,
    category: product.category || "Chocolate Cakes",
    category_slug: product.category_slug || "chocolate-cakes",
    primary_category_id: product.primary_category_id || "cat_chocolate",
    secondary_category_ids: product.secondary_category_ids || [],
    category_ids: product.category_ids || [],
    flavour: product.flavour || "Chocolate",
    cake_base: product.cake_base || "Chocolate",
    filling: product.filling || "Chocolate Ganache",
    cream: product.cream || "Fresh Cream",
    texture: product.texture || "Soft & Moist",
    tags: product.tags || "",
    occasion: product.occasion || "Birthday",
    occasion_ids: product.occasion_ids || ["occ_birthday"],
    brand: product.brand || "CakeToHome Signature",
    cake_type: product.cake_type || "Layer Cake",
    gst_rate: Number(product.gst_rate || 5),
    tax_class: product.tax_class || "GST_FOOD_5",
    tax_configuration_id: product.tax_configuration_id || "txcfg_food_5",
    hsn_code: product.hsn_code || "19059090",
    hsn_description: product.hsn_description || "Cakes, Pastries & Bakery Goods",
    uqc: product.uqc || "NOS",
    taxability: product.taxability || "Taxable",
    tax_inclusive: product.tax_inclusive !== false,
    is_featured: Boolean(product.is_featured),
    is_bestseller: Boolean(product.is_bestseller),
    is_new_arrival: Boolean(product.is_new_arrival),
    sugar_free: Boolean(product.sugar_free),
    gluten_free: Boolean(product.gluten_free),
    vegan: Boolean(product.vegan),
    gallery: Array.isArray(product.gallery) ? product.gallery : [],
    video_url: product.video_url || "",
    alt_text: product.alt_text || "",
    daily_capacity: Number(product.daily_capacity || 50),
    shelf_life_days: Number(product.shelf_life_days || 3),
    prep_time_minutes: Number(product.prep_time_minutes || 120),
    variants_json: product.variants_json || { weights: ["0.5 kg", "1 kg", "1.5 kg", "2 kg"] },
    add_ons_json: product.add_ons_json || {},
    seo_title: product.seo_title || `${product.title || product.name} - CakeToHome`,
    seo_description: product.seo_description || product.description || "",
    seo_keywords: product.seo_keywords || "",
    max_delivery_distance_km: (product.max_delivery_distance_km != null || product.pim_config?.max_delivery_distance_km != null)
      ? Number(product.max_delivery_distance_km ?? product.pim_config?.max_delivery_distance_km)
      : null,
    pim_config: {
      ...(product.pim_config || {}),
      max_delivery_distance_km: (product.max_delivery_distance_km != null || product.pim_config?.max_delivery_distance_km != null)
        ? Number(product.max_delivery_distance_km ?? product.pim_config?.max_delivery_distance_km)
        : null,
    },
    flavors: product.flavors || [],
    shapes: product.shapes || [],
    fillings: product.fillings || [],
    creams: product.creams || [],
    weight_prices: product.weight_prices || (product.metadata && product.metadata.weight_prices) || [],
    enable_flavor_selection: product.enable_flavor_selection,
    enable_shape_selection: product.enable_shape_selection,
  };

  await dbQuery(
    `
    INSERT INTO "product" ("id", "title", "handle", "subtitle", "description", "thumbnail", "status", "is_giftcard", "discountable", "metadata", "created_at", "updated_at")
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
    ON CONFLICT ("id") DO UPDATE SET
      "title" = EXCLUDED.title,
      "handle" = EXCLUDED.handle,
      "description" = EXCLUDED.description,
      "thumbnail" = EXCLUDED.thumbnail,
      "metadata" = EXCLUDED.metadata,
      "updated_at" = NOW()
  `,
    [
      id,
      product.title || product.name || "Gourmet Cake",
      product.handle || product.slug || id,
      product.subtitle || "",
      product.description || "",
      product.thumbnail || "",
      product.status || "published",
      false,
      true,
      JSON.stringify(metadata),
    ]
  );
}

/**
 * Persists a Master Variant Option (Flavor, Shape, Filling, Cream, Weight) to PostgreSQL
 */
export async function persistVariantOptionToDb(opt: any): Promise<void> {
  const id = opt.id || opt.flavor_id || opt.shape_id || `opt_${opt.type || "gen"}_${Date.now()}`;
  await dbQuery(
    `
    INSERT INTO "variant_option" ("id", "type", "name", "display_name", "price_modifier", "display_order", "status", "is_enabled", "metadata", "created_at", "updated_at")
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
    ON CONFLICT ("id") DO UPDATE SET
      "type" = EXCLUDED.type,
      "name" = EXCLUDED.name,
      "display_name" = EXCLUDED.display_name,
      "price_modifier" = EXCLUDED.price_modifier,
      "display_order" = EXCLUDED.display_order,
      "status" = EXCLUDED.status,
      "is_enabled" = EXCLUDED.is_enabled,
      "metadata" = EXCLUDED.metadata,
      "updated_at" = NOW()
  `,
    [
      id,
      opt.type || "flavour",
      opt.name || opt.display_name || "Option",
      opt.display_name || opt.name || "Option",
      Number(opt.price_modifier ?? opt.extra_price ?? opt.additional_price ?? 0),
      Number(opt.display_order || opt.sort_order || 1),
      opt.status || "active",
      opt.is_enabled !== false && opt.enabled !== false,
      JSON.stringify(opt.metadata || {}),
    ]
  );
}

/**
 * Deletes / archives a Variant Option from PostgreSQL
 */
export async function deleteVariantOptionFromDb(id: string): Promise<void> {
  await dbQuery(
    `UPDATE "variant_option" SET "deleted_at" = NOW(), "status" = 'archived', "is_enabled" = false WHERE "id" = $1`,
    [id]
  );
}

/**
 * Deletes a Product from PostgreSQL (Soft-delete or purge)
 */
export async function deleteProductFromDb(productId: string): Promise<void> {
  await dbQuery(`UPDATE "product" SET "deleted_at" = NOW() WHERE "id" = $1`, [productId]);
}

/**
 * Persists a Customer to PostgreSQL
 */
export async function persistCustomerToDb(customer: any): Promise<void> {
  const id = customer.id || customer.customer_uid || `cus_${Date.now()}`;
  const metadata = {
    customer_uid: customer.customer_uid || id,
    normalized_phone: customer.normalized_phone || customer.phone,
    role: customer.role || "CUSTOMER",
    wallet_balance: customer.wallet_balance || 0,
    preferences: customer.preferences || {},
    addresses: customer.addresses || [],
    orders_count: customer.orders_count || 0,
    total_spend: customer.total_spend || 0,
    date_of_birth: customer.date_of_birth || null,
  };

  await dbQuery(
    `
    INSERT INTO "customer" ("id", "first_name", "last_name", "email", "phone", "has_account", "metadata", "created_at", "updated_at")
    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
    ON CONFLICT ("id") DO UPDATE SET
      "first_name" = EXCLUDED.first_name,
      "last_name" = EXCLUDED.last_name,
      "email" = EXCLUDED.email,
      "phone" = EXCLUDED.phone,
      "metadata" = EXCLUDED.metadata,
      "updated_at" = NOW()
  `,
    [
      id,
      customer.first_name || "Valued",
      customer.last_name || "Customer",
      customer.email || `customer_${id}@caketohome.com`,
      customer.phone || "",
      customer.has_account !== false,
      JSON.stringify(metadata),
    ]
  );
}

/**
 * Persists a Customer Address to PostgreSQL
 */
export async function persistCustomerAddressToDb(customerId: string, address: any): Promise<void> {
  const addrId = address.id || `addr_${customerId}_${Date.now()}`;
  await dbQuery(
    `
    INSERT INTO "customer_address" ("id", "customer_id", "first_name", "last_name", "address_1", "address_2", "city", "postal_code", "phone", "metadata", "created_at", "updated_at")
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
    ON CONFLICT ("id") DO UPDATE SET
      "address_1" = EXCLUDED.address_1,
      "address_2" = EXCLUDED.address_2,
      "city" = EXCLUDED.city,
      "postal_code" = EXCLUDED.postal_code,
      "phone" = EXCLUDED.phone,
      "metadata" = EXCLUDED.metadata,
      "updated_at" = NOW()
  `,
    [
      addrId,
      customerId,
      address.first_name || address.name?.split(" ")[0] || "Recipient",
      address.last_name || address.name?.split(" ").slice(1).join(" ") || "",
      address.address_1 || address.address || "Delivery Address",
      address.address_2 || "",
      address.city || "Bengaluru",
      address.postal_code || address.pincode || "560038",
      address.phone || "",
      JSON.stringify({
        landmark: address.landmark || "",
        latitude: address.latitude || null,
        longitude: address.longitude || null,
        is_default: Boolean(address.is_default),
        label: address.label || address.type || "Home",
        type: address.type || "HOME",
        instructions: address.instructions || "",
      }),
    ]
  );
}

/**
 * Deletes a Customer Address from PostgreSQL
 */
export async function deleteCustomerAddressFromDb(customerId: string, addressId: string): Promise<void> {
  await dbQuery(`DELETE FROM "customer_address" WHERE "id" = $1 AND "customer_id" = $2`, [addressId, customerId]);
}

/**
 * Persists a Delivery Partner to PostgreSQL
 */
export async function persistDeliveryPartnerToDb(partner: any): Promise<void> {
  const id = partner.id || `dlp_${Date.now()}`;
  const nameParts = (partner.name || `Driver ${partner.partner_number || "01"}`).trim().split(" ");
  const firstName = partner.first_name || nameParts[0] || "Driver";
  const lastName = partner.last_name || nameParts.slice(1).join(" ") || "Rider";

  await dbQuery(
    `
    INSERT INTO "delivery_partner" ("id", "first_name", "last_name", "email", "phone", "avatar_url", "is_active", "created_at", "updated_at")
    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
    ON CONFLICT ("id") DO UPDATE SET
      "first_name" = EXCLUDED.first_name,
      "last_name" = EXCLUDED.last_name,
      "email" = EXCLUDED.email,
      "phone" = EXCLUDED.phone,
      "avatar_url" = EXCLUDED.avatar_url,
      "is_active" = EXCLUDED.is_active,
      "updated_at" = NOW()
  `,
    [
      id,
      firstName,
      lastName,
      partner.email || `rider_${id}@caketohome.com`,
      partner.phone || "+91 99887 76655",
      partner.avatar_url || null,
      partner.is_active !== false,
    ]
  );
}

/**
 * Persists an Order to PostgreSQL
 */
export async function persistOrderToDb(order: any): Promise<void> {
  const id = order.id || `ord_${Date.now()}`;
  const rawStatus = (order.status || "pending").toLowerCase();
  const validPgStatus = ["completed", "canceled", "draft", "archived", "requires_action"].includes(rawStatus)
    ? rawStatus
    : "pending";

  const numTotal = Number(order.total_amount || order.total || order.grand_total || 0);

  await dbQuery(
    `
    INSERT INTO "order" ("id", "display_id", "email", "currency_code", "status", "metadata", "created_at", "updated_at")
    VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
    ON CONFLICT ("id") DO UPDATE SET
      "status" = EXCLUDED.status,
      "metadata" = EXCLUDED.metadata,
      "updated_at" = NOW()
  `,
    [
      id,
      typeof order.display_id === "number" ? order.display_id : (parseInt(String(order.display_id || "").replace(/\D/g, "").slice(-6), 10) || 1001),
      order.email || order.customer_email || "customer@caketohome.com",
      "inr",
      validPgStatus,
      JSON.stringify({
        items: order.items || [],
        delivery: order.delivery || {},
        delivery_latitude: order.delivery_latitude || null,
        delivery_longitude: order.delivery_longitude || null,
        delivery_slot_id: order.delivery_slot_id || order.delivery?.slot_id || null,
        delivery_slot_time: order.delivery_slot_time || order.delivery?.slot_time || null,
        delivery_date: order.delivery_date || order.delivery?.date || null,
        branch_id: order.branch_id || "br_indiranagar",
        delivery_zone_id: order.delivery_zone_id || null,
        total_amount: numTotal,
        payment_method: order.payment_method || "cod",
        payment_status: order.payment_status || "pending",
        customer_uid: order.customer_uid || order.customer_id || null,
        customer_phone: order.customer_phone || order.phone || null,
        customer_name: order.customer_name || null,
        bakery_status: order.status || "confirmed",
        order_number: order.order_number || `ORD-${id.slice(-6)}`,
      }),
    ]
  );
}

/**
 * Persists a CMS Page to PostgreSQL
 */
export async function persistCmsPageToDb(page: any): Promise<void> {
  const id = page.id || `cmspg_${Date.now()}`;
  const blockData = {
    sections: page.sections || [],
    draft_config: page.draft_config || {},
    published_config: page.published_config || null,
    version_history: page.version_history || [],
  };

  await dbQuery(
    `
    INSERT INTO "cms_page" ("id", "title", "slug", "type", "status", "meta_title", "meta_description", "canonical_url", "og_image", "blocks", "created_at", "updated_at", "published_at")
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW(), $11)
    ON CONFLICT ("id") DO UPDATE SET
      "title" = EXCLUDED.title,
      "slug" = EXCLUDED.slug,
      "type" = EXCLUDED.type,
      "status" = EXCLUDED.status,
      "meta_title" = EXCLUDED.meta_title,
      "meta_description" = EXCLUDED.meta_description,
      "canonical_url" = EXCLUDED.canonical_url,
      "og_image" = EXCLUDED.og_image,
      "blocks" = EXCLUDED.blocks,
      "updated_at" = NOW(),
      "published_at" = EXCLUDED.published_at
  `,
    [
      id,
      page.title || "CMS Page",
      page.slug || id,
      page.page_type || page.type || "landing",
      page.status || "published",
      page.meta_title || page.title || "",
      page.meta_description || "",
      page.canonical_url || "",
      page.og_image || "",
      JSON.stringify(blockData),
      page.published_at ? new Date(page.published_at) : null,
    ]
  );
}

/**
 * Deletes a CMS Page from PostgreSQL
 */
export async function deleteCmsPageFromDb(pageId: string): Promise<void> {
  await dbQuery(`UPDATE "cms_page" SET "deleted_at" = NOW(), "status" = 'archived' WHERE "id" = $1 OR "slug" = $1`, [pageId]);
}

/**
 * Persists a Customer/Corporate Lead or Custom Cake Enquiry to PostgreSQL
 */
export async function persistLeadEnquiryToDb(enquiry: {
  id?: string;
  type?: string;
  name: string;
  phone: string;
  email?: string;
  details?: string;
}): Promise<string> {
  const id = enquiry.id || `enq_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS "lead_enquiry" (
      "id" VARCHAR(120) PRIMARY KEY,
      "type" VARCHAR(50) NOT NULL,
      "name" VARCHAR(255) NOT NULL,
      "phone" VARCHAR(50) NOT NULL,
      "email" VARCHAR(255),
      "details" TEXT,
      "status" VARCHAR(50) DEFAULT 'new',
      "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
  await dbQuery(
    `INSERT INTO "lead_enquiry" ("id", "type", "name", "phone", "email", "details", "created_at")
     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [
      id,
      enquiry.type || "contact_form",
      enquiry.name,
      enquiry.phone,
      enquiry.email || null,
      enquiry.details || null,
    ]
  );
  return id;
}

/**
 * Persists an Offer to PostgreSQL
 */
export async function persistOfferToDb(offer: any): Promise<void> {
  const id = offer.id || `off_${Date.now()}`;
  await dbQuery(
    `
    INSERT INTO "offer" ("id", "name", "code", "discount_type", "discount_value", "min_order_amount", "is_active", "description", "created_at", "updated_at")
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
    ON CONFLICT ("id") DO UPDATE SET
      "name" = EXCLUDED.name,
      "code" = EXCLUDED.code,
      "discount_type" = EXCLUDED.discount_type,
      "discount_value" = EXCLUDED.discount_value,
      "min_order_amount" = EXCLUDED.min_order_amount,
      "is_active" = EXCLUDED.is_active,
      "description" = EXCLUDED.description,
      "updated_at" = NOW()
  `,
    [
      id,
      offer.name || offer.title || offer.code || "Promo Offer",
      (offer.code || `OFFER_${Date.now()}`).toUpperCase(),
      offer.discount_type || offer.type || "flat",
      Number(offer.discount_value ?? offer.amount ?? offer.value ?? 100),
      Number(offer.min_order_amount ?? offer.min_order ?? offer.min_order_value ?? 499),
      offer.is_active !== false,
      offer.description || "",
    ]
  );
}


/**
 * Persists a Setting to PostgreSQL
 */
export async function persistSettingToDb(
  groupOrSetting: string | { group?: string; key: string; value: any; is_public?: boolean },
  key?: string,
  value?: any,
  isPublic: boolean = true
): Promise<void> {
  let g = "general";
  let k = "";
  let v: any = null;

  if (typeof groupOrSetting === "object" && groupOrSetting !== null) {
    g = groupOrSetting.group || "general";
    k = groupOrSetting.key;
    v = groupOrSetting.value;
  } else {
    g = groupOrSetting || "general";
    k = key || "";
    v = value;
  }

  const id = `set_${g}_${k}`;
  const strVal = typeof v === "string" ? v : JSON.stringify(v);
  const isJson = typeof v === "object" && v !== null;

  await dbQuery(
    `
    INSERT INTO "setting" ("id", "group", "key", "value", "is_json", "is_secret", "created_at", "updated_at")
    VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
    ON CONFLICT ("id") DO UPDATE SET
      "value" = EXCLUDED.value,
      "is_json" = EXCLUDED.is_json,
      "updated_at" = NOW()
  `,
    [id, g, k, strVal, isJson, false]
  );
}

/**
 * Persists a Popup Campaign to PostgreSQL
 */
export async function persistPopupCampaignToDb(campaign: any): Promise<void> {
  const id = campaign.id || `pop_${Date.now()}`;
  await dbQuery(
    `
    INSERT INTO "popup_campaigns" ("id", "name", "title", "body_text", "status", "target_page", "start_date", "end_date", "display_rules", "created_at", "updated_at")
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
    ON CONFLICT ("id") DO UPDATE SET
      "name" = EXCLUDED.name,
      "title" = EXCLUDED.title,
      "body_text" = EXCLUDED.body_text,
      "status" = EXCLUDED.status,
      "target_page" = EXCLUDED.target_page,
      "display_rules" = EXCLUDED.display_rules,
      "updated_at" = NOW()
  `,
    [
      id,
      campaign.name || "Campaign",
      campaign.title || "Special Offer",
      campaign.body_text || "",
      campaign.status || "active",
      campaign.target_page || "all",
      campaign.start_date ? new Date(campaign.start_date) : new Date(),
      campaign.end_date ? new Date(campaign.end_date) : null,
      JSON.stringify(campaign.display_rules || {}),
    ]
  );
}

/**
 * Deletes / archives an Offer from PostgreSQL
 */
export async function deleteOfferFromDb(offerId: string): Promise<void> {
  await dbQuery(`UPDATE "offer" SET "deleted_at" = NOW(), "is_active" = false WHERE "id" = $1 OR "code" = $1`, [offerId]);
}

/**
 * Deletes / archives a Popup Campaign from PostgreSQL
 */
export async function deletePopupCampaignFromDb(id: string): Promise<void> {
  await dbQuery(`UPDATE "popup_campaigns" SET "deleted_at" = NOW(), "status" = 'archived' WHERE "id" = $1`, [id]);
}

/**
 * Persists a Customer Favorite to PostgreSQL
 */
export async function persistCustomerFavoriteToDb(favorite: any): Promise<void> {
  const id = favorite.id || `fav_${favorite.customer_uid}_${favorite.product_id}`;
  await dbQuery(
    `
    INSERT INTO "customer_favorite" ("id", "customer_uid", "product_id", "created_at")
    VALUES ($1, $2, $3, $4)
    ON CONFLICT ("id") DO UPDATE SET
      "deleted_at" = NULL
  `,
    [id, favorite.customer_uid, favorite.product_id, favorite.created_at ? new Date(favorite.created_at) : new Date()]
  );
}

/**
 * Deletes / removes a Customer Favorite from PostgreSQL
 */
export async function deleteCustomerFavoriteFromDb(customerUid: string, productId: string): Promise<void> {
  await dbQuery(
    `DELETE FROM "customer_favorite" WHERE ("customer_uid" = $1 AND "product_id" = $2) OR "id" = $3`,
    [customerUid, productId, `fav_${customerUid}_${productId}`]
  );
}

/**
 * Persists a Product Review to PostgreSQL
 */
export async function persistProductReviewToDb(review: any): Promise<void> {
  const id = review.id || `rev_${Date.now()}`;
  const customerId = review.customer_uid || review.customer_id || "guest";
  const bodyText = review.review_text || review.body || "";
  const replyText = review.admin_response?.message || review.reply || null;
  const repliedAt = review.admin_response?.responded_at ? new Date(review.admin_response.responded_at) : null;
  const isVerified = review.is_verified_purchase !== false && review.verified_purchase !== false;

  await dbQuery(
    `
    INSERT INTO "product_review" (
      "id", "product_id", "customer_id", "customer_name",
      "rating", "title", "body",
      "status", "reply", "replied_at", "verified_purchase", "created_at", "updated_at"
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
    ON CONFLICT ("id") DO UPDATE SET
      "rating" = EXCLUDED.rating,
      "title" = EXCLUDED.title,
      "body" = EXCLUDED.body,
      "status" = EXCLUDED.status,
      "reply" = EXCLUDED.reply,
      "replied_at" = EXCLUDED.replied_at,
      "updated_at" = NOW()
  `,
    [
      id,
      review.product_id,
      customerId,
      review.customer_name || "Valued Customer",
      Number(review.rating || 5),
      review.title || "",
      bodyText,
      review.status || "APPROVED",
      replyText,
      repliedAt,
      isVerified,
      review.created_at ? new Date(review.created_at) : new Date(),
    ]
  );
}

/**
 * Deletes / archives a Product Review from PostgreSQL
 */
export async function deleteProductReviewFromDb(id: string): Promise<void> {
  await dbQuery(`UPDATE "product_review" SET "deleted_at" = NOW(), "status" = 'HIDDEN' WHERE "id" = $1`, [id]);
}




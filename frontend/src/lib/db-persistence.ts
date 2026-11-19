/**
 * CakeToHome — Authoritative PostgreSQL Database Persistence Layer
 *
 * Direct asynchronous persistence to PostgreSQL for all domain entities.
 * Enforces authoritative database durability.
 */

import { dbQuery, dbTransaction } from "./db";
import { externalizeInlineImages } from "./repositories/cms.repository";

// Default Shop ID in Medusa
const DEFAULT_SHOP_ID = "res_01KXYMAHGFPRY1G9TZKEVGAGAT";

export const SEED_MASTER_VARIANT_OPTIONS = [
  // Weights
  { id: "opt_w_01", type: "weight", name: "0.5 kg", display_name: "500 Grams", price_modifier: 0, display_order: 1 },
  { id: "opt_w_02", type: "weight", name: "1.0 kg", display_name: "1.0 Kilogram", price_modifier: 0, display_order: 2 },
  { id: "opt_w_03", type: "weight", name: "1.5 kg", display_name: "1.5 Kilograms", price_modifier: 0, display_order: 3 },
  { id: "opt_w_04", type: "weight", name: "2.0 kg", display_name: "2.0 Kilograms", price_modifier: 0, display_order: 4 },
  { id: "opt_w_05", type: "weight", name: "5.0 kg", display_name: "5.0 Kilograms (Party Size)", price_modifier: 0, display_order: 5 },



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
      popupVersionsRes,
      variantOptionsRes,
      favoritesRes,
      reviewsRes,
      branchInventoryRes,
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
      dbQuery(`SELECT * FROM "popup_versions" ORDER BY version_number DESC`).catch(() => ({ rows: [] })),
      dbQuery(`SELECT * FROM "variant_option" WHERE deleted_at IS NULL ORDER BY display_order ASC`).catch(() => ({ rows: [] })),
      dbQuery(`SELECT * FROM "customer_favorite" WHERE deleted_at IS NULL ORDER BY created_at DESC`).catch(() => ({ rows: [] })),
      dbQuery(`SELECT * FROM "product_review" WHERE deleted_at IS NULL ORDER BY created_at DESC`).catch(() => ({ rows: [] })),
      dbQuery(`SELECT * FROM "branch_inventory" WHERE deleted_at IS NULL ORDER BY created_at ASC`).catch(() => ({ rows: [] })),
    ]);

    // Real GST registrations (no built-in demo GSTINs)
    try {
      const gstRes = await dbQuery(`SELECT * FROM public.gst_registration ORDER BY created_at ASC`);
      const STATE_BY_CODE: Record<string, string> = { "29": "Karnataka", "32": "Kerala", "33": "Tamil Nadu", "27": "Maharashtra", "36": "Telangana", "07": "Delhi" };
      (targetStore as any).gst_registrations = gstRes.rows.map((g: any) => {
        const meta = g.metadata || {};
        const stateCode = String(g.state_code || String(g.gstin || "").slice(0, 2));
        const state = meta.state || STATE_BY_CODE[stateCode] || "";
        return {
          id: g.id,
          gstin: g.gstin,
          legal_name: g.legal_name || "",
          trade_name: meta.trade_name || g.legal_name || "",
          registration_type: g.registration_type || "REGULAR",
          state,
          state_code: stateCode,
          effective_from: g.effective_from || undefined,
          effective_to: g.effective_to || null,
          status: g.is_active === false ? "inactive" : "active",
          address: meta.address || { line1: "", city: "", state, state_code: stateCode, pincode: "" },
          verification_status: meta.verification_status || "PENDING",
          verification_source: meta.verification_source || "Manual",
          last_verified_at: meta.last_verified_at || null,
          created_at: g.created_at,
        };
      });
    } catch {}

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

    // 1.b Inventory Map by Branch
    const inventoryByBranch = new Map<string, Record<string, any>>();
    for (const inv of branchInventoryRes.rows || []) {
      const bId = inv.branch_id;
      if (!inventoryByBranch.has(bId)) {
        inventoryByBranch.set(bId, {});
      }
      const bMap = inventoryByBranch.get(bId)!;
      const invObj = {
        current_stock: Number(inv.quantity || 0),
        reserved_stock: Number(inv.reserved || 0),
        available_stock: Math.max(0, Number(inv.quantity || 0) - Number(inv.reserved || 0)),
        low_stock_threshold: 5,
        reorder_level: 10,
      };
      if (inv.product_id) bMap[inv.product_id] = invObj;
      if (inv.variant_id) bMap[inv.variant_id] = invObj;
    }

    // 2. Branches — UNCONDITIONAL HYDRATION FROM POSTGRESQL
    targetStore.branches = (branchesRes.rows || []).map((b) => {
      const meta = b.metadata || {};
      // Full zone config (distance brackets, charges) lives in metadata; table rows are the legacy copy
      const branchZones = Array.isArray(meta.delivery_zones) ? meta.delivery_zones : (zonesByBranch.get(b.id) || []);
      return {
        id: b.id,
        name: b.name,
        code: b.code || b.id,
        phone: b.phone || "",
        email: b.email || "",
        address: b.address || "",
        city_id: b.city_id || "city_bbr",
        city: meta.city || "Bengaluru",
        state: meta.state || "Karnataka",
        latitude: toCoord(b.latitude),
        longitude: toCoord(b.longitude),
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
        cake_fulfilment: meta.cake_fulfilment || {},
        accessory_inventory: inventoryByBranch.get(b.id) || meta.accessory_inventory || {},
        created_at: b.created_at,
        updated_at: b.updated_at,
      };
    });

    // 3. Cities — UNCONDITIONAL HYDRATION FROM POSTGRESQL
    targetStore.cities = (citiesRes.rows || []).map((c) => {
      const stateName = c.state || "Karnataka";
      const isKerala = stateName.toLowerCase().includes("kerala") || c.id === "city_klm" || c.id === "city_koc";
      const stateId = isKerala ? "state_kl" : "state_ka";
      const stateCode = isKerala ? "KL" : "KA";
      return {
        id: c.id,
        name: c.name,
        slug: c.id.replace("city_", ""),
        state: stateName,
        state_id: stateId,
        state_code: stateCode,
        stateCode: stateCode,
        country: "India",
        countryCode: "IN",
        timezone: "Asia/Kolkata",
        currency: "INR",
        phoneCode: "+91",
        status: c.is_active !== false ? "active" : "archived",
        is_active: c.is_active !== false,
        created_at: c.created_at,
      };
    });

    // 4. Products & Weight Prices Matrix — UNCONDITIONAL HYDRATION FROM POSTGRESQL
    const weightPricesList: any[] = [];
    targetStore.products = (productsRes.rows || []).map((p) => {
      const meta = p.metadata || {};
      const firstWeightPrice = Array.isArray(meta.weight_prices) && meta.weight_prices.length > 0
        ? (meta.weight_prices[0]?.selling_price ?? meta.weight_prices[0]?.price)
        : undefined;
      const rawPrice = meta.selling_price ?? meta.price ?? firstWeightPrice;
      const price = rawPrice !== undefined && rawPrice !== null ? Number(rawPrice) : 0;
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
        thumbnail: meta.thumbnail || p.thumbnail || "",
        gallery: (() => { const t = meta.thumbnail || p.thumbnail || ""; return (Array.isArray(meta.gallery) && meta.gallery.length > 0) ? meta.gallery : (t ? [t] : []); })(),
        status: meta.status || p.status || "published",
        price,
        selling_price: price,
        cost_price: Number(meta.cost_price || 350),
        mrp: Number(meta.mrp || 799),
        rating: Number(meta.rating) || 0,
        review_count: Number(meta.review_count) || 0,
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
        gst_rate: typeof meta.gst_rate === "number" ? meta.gst_rate : (meta.gst_rate ? Number(meta.gst_rate) : undefined),
        tax_class: meta.tax_class || undefined,
        tax_configuration_id: meta.tax_rate_id || meta.tax_configuration_id || undefined,
        tax_rate_id: meta.tax_rate_id || meta.tax_configuration_id || undefined,
        hsn_code: meta.hsn_code || "",
        hsn_description: meta.hsn_description || (meta.hsn_code ? "Cakes, Pastries & Bakery Goods" : "Unclassified (Missing HSN Code)"),
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
        search_keywords: meta.search_keywords || "",
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

    // 8. Delivery Partners — HYDRATION FROM POSTGRESQL + PRESERVE IN-MEMORY
    const dbPartnerMap = new Map<string, any>((partnersRes.rows || []).map((d) => {
      const meta = d.metadata && typeof d.metadata === "object" ? d.metadata : {};
      const fullName = `${d.first_name || ""} ${d.last_name || ""}`.trim() || meta.full_name || "Delivery Partner";
      return [
        d.id,
        {
          ...meta,
          id: d.id,
          name: fullName,
          full_name: fullName,
          first_name: d.first_name,
          last_name: d.last_name,
          email: d.email ?? meta.email,
          phone: d.phone ?? meta.phone,
          avatar_url: d.avatar_url,
          is_active: d.is_active !== false,
          status: meta.status || (d.is_active !== false ? "active" : "inactive"),
          total_deliveries: Number(meta.total_deliveries || 0),
          rating: Number(meta.rating || 5),
          created_at: d.created_at,
        },
      ];
    }));
    for (const existing of targetStore.delivery_partners || []) {
      if (existing && existing.id && !dbPartnerMap.has(existing.id)) {
        dbPartnerMap.set(existing.id, existing);
      }
    }
    targetStore.delivery_partners = Array.from(dbPartnerMap.values());

    // 9. Orders — HYDRATION FROM POSTGRESQL + PRESERVE IN-MEMORY UNPERSISTED
    const dbOrderIds = new Set((ordersRes.rows || []).map((o) => o.id));
    const unpersistedLocalOrders = (targetStore.orders || []).filter((o: any) => o && !dbOrderIds.has(o.id));
    const dbOrders = (ordersRes.rows || []).map((o) => {
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
        delivery_otp: meta.delivery_otp || meta.delivery?.delivery_otp || null,
        pickup_otp: meta.pickup_otp || meta.delivery?.pickup_otp || null,
        delivery_partner_id: meta.delivery_partner_id || meta.delivery?.delivery_partner_id || null,
        delivery_status: meta.delivery_status || (meta.delivery && meta.delivery.delivery_status) || "pending",
        invoice_number: meta.invoice_number || null,
        invoice_id: meta.invoice_id || null,
        accounting_voucher_id: meta.accounting_voucher_id || null,
        branch_id: o.branch_id || meta.branch_id || null,
        items: meta.items || [],
        created_at: o.created_at,
        updated_at: o.updated_at,
      };
    });
    targetStore.orders = [...unpersistedLocalOrders, ...dbOrders];

    targetStore.cms_pages = (cmsPagesRes.rows || []).map((p) => {
      let blockParsed: any = { sections: [], draft_config: {}, published_config: null, version_history: [] };
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
        subheading: blockParsed.subheading || "",
        h1: blockParsed.h1 || "",
        intro_content: blockParsed.intro_content || "",
        breadcrumb_title: blockParsed.breadcrumb_title || "",
        announcement_bar: blockParsed.announcement_bar || null,
        header_config: blockParsed.header_config || null,
        visibility_rules: blockParsed.visibility_rules || null,
        robots_tag: blockParsed.robots_tag || "index, follow",
        keywords: blockParsed.keywords || "",
        og_title: blockParsed.og_title || "",
        og_description: blockParsed.og_description || "",
        og_type: blockParsed.og_type || "website",
        twitter_card: blockParsed.twitter_card || "summary_large_image",
        twitter_title: blockParsed.twitter_title || "",
        twitter_description: blockParsed.twitter_description || "",
        twitter_image: blockParsed.twitter_image || "",
        structured_data_type: blockParsed.structured_data_type || "WebPage",
        sitemap_include: blockParsed.sitemap_include ?? true,
        sitemap_priority: blockParsed.sitemap_priority || "0.7",
        sitemap_changefreq: blockParsed.sitemap_changefreq || "weekly",
        nav_location: blockParsed.nav_location || "none",
        hide_from_nav: blockParsed.hide_from_nav ?? false,
        sections: blockParsed.sections || [],
        theme: blockParsed.theme || null,
        draft_config: blockParsed.draft_config || {},
        published_config: blockParsed.published_config || null,
        version_history: blockParsed.version_history || [],
        created_at: p.created_at,
        updated_at: p.updated_at,
        published_at: p.published_at,
      };
    });

    targetStore.cms_sections = (cmsSectionsRes.rows || []).map((s) => {
      let cfg: any = {};
      if (s.config) {
        try {
          cfg = typeof s.config === "string" ? JSON.parse(s.config) : s.config;
        } catch {}
      } else if (s.settings) {
        cfg = s.settings;
      }
      return {
        id: s.id,
        section_id: s.id,
        type: s.section_type || s.type || "custom",
        section_type: s.section_type || s.type || "custom",
        title: s.title || cfg?.title || "",
        subtitle: s.subtitle || cfg?.subtitle || "",
        sort_order: s.sort_order ?? 0,
        is_visible: s.is_active !== false && s.is_visible !== false,
        is_active: s.is_active !== false,
        settings: cfg,
        config: cfg,
        created_at: s.created_at,
        updated_at: s.updated_at,
      };
    });

    // 11. Offers — UNCONDITIONAL HYDRATION FROM POSTGRESQL
    const parseField = (val: any) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      if (typeof val === "string") {
        try {
          const parsed = JSON.parse(val);
          return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          return val.includes(",") ? val.split(",").map((s) => s.trim()) : [val];
        }
      }
      return val;
    };
    const parseObj = (val: any) => {
      if (!val) return {};
      if (typeof val === "object") return val;
      if (typeof val === "string") {
        try { return JSON.parse(val); } catch { return {}; }
      }
      return {};
    };

    targetStore.offers = (offersRes.rows || []).map((off: any) => {
      const meta = parseObj(off.metadata);
      return {
        id: off.id,
        name: off.name,
        code: off.code,
        type: off.type || "percentage",
        status: off.status || "active",
        priority: Number(off.priority) || 0,
        starts_at: off.starts_at ? new Date(off.starts_at).toISOString() : null,
        ends_at: off.ends_at ? new Date(off.ends_at).toISOString() : null,
        start_time: off.start_time,
        end_time: off.end_time,
        timezone: off.timezone || "Asia/Kolkata",
        never_expires: Boolean(off.never_expires),
        usage_limit: off.usage_limit !== null && off.usage_limit !== undefined ? Number(off.usage_limit) : null,
        per_customer_limit: off.per_customer_limit !== null && off.per_customer_limit !== undefined ? Number(off.per_customer_limit) : null,
        daily_limit: off.daily_limit !== null && off.daily_limit !== undefined ? Number(off.daily_limit) : null,
        monthly_limit: off.monthly_limit !== null && off.monthly_limit !== undefined ? Number(off.monthly_limit) : null,
        is_stackable: Boolean(off.is_stackable),
        is_public: off.is_public !== false,
        auto_apply: Boolean(off.auto_apply),
        delivery_mode: off.delivery_mode || "all",
        allowed_payment_methods: parseField(off.allowed_payment_methods),
        min_order_value: Number(off.min_order_value) || 0,
        max_discount_value: off.max_discount_value !== null && off.max_discount_value !== undefined ? Number(off.max_discount_value) : null,
        min_quantity: Number(off.min_quantity) || 1,
        description: off.description || "",
        applicable_branches: parseField(off.applicable_branches),
        applicable_cities: parseField(off.applicable_cities),
        applicable_pincodes: parseField(off.applicable_pincodes),
        excluded_pincodes: parseField(off.excluded_pincodes),
        applicable_products: parseField(off.applicable_products),
        applicable_categories: parseField(off.applicable_categories),
        applicable_flavors: parseField(off.applicable_flavors),
        applicable_shapes: parseField(off.applicable_shapes),
        applicable_weights: parseField(off.applicable_weights),
        customer_eligibility: off.customer_eligibility || "all",
        allowed_customer_ids: parseField(off.allowed_customer_ids),
        allowed_phones: parseField(off.allowed_phones),
        allowed_emails: parseField(off.allowed_emails),
        customer_tags: parseField(off.customer_tags),
        exclude_discounted_items: Boolean(off.exclude_discounted_items),
        exclude_flash_sales: Boolean(off.exclude_flash_sales),
        approval_status: off.approval_status || "approved",
        created_by: off.created_by || "system",
        approved_by: off.approved_by,
        total_redemptions: Number(off.total_redemptions) || 0,
        total_discount_given: Number(off.total_discount_given) || 0,
        total_revenue_generated: Number(off.total_revenue_generated) || 0,
        metadata: meta,
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

    // Staff access control (access profiles, staff logins, assignments): load saved state, then save on every change.
    try {
      const { StaffAccessControl } = await import("./staff-access-control");
      const accessRow = (settingsRes.rows || []).find((s: any) => s.group === "access" && s.key === "store");
      if (accessRow?.value) {
        StaffAccessControl.loadState(typeof accessRow.value === "string" ? JSON.parse(accessRow.value) : accessRow.value);
      }
      StaffAccessControl.setChangeHook((state) => {
        persistSettingToDb("access", "store", state, false).catch((e: any) =>
          console.error("[StaffAccessControl] save failed:", e?.message)
        );
      });
    } catch (e: any) {
      console.error("[StaffAccessControl] hydrate failed:", e?.message);
    }

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

      // Operating hours, holidays and product fulfillment rules (saved as fulfillment settings)
      for (const [key, storeKey] of [
        ["operating_hours", "operating_hours"],
        ["holidays", "holidays"],
        ["product_rules", "product_fulfillment_rules"],
      ] as const) {
        const row = settingsRes.rows.find((s) => s.group === "fulfillment" && s.key === key);
        if (row && row.value) {
          try {
            const val = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
            if (Array.isArray(val)) targetStore[storeKey] = val;
          } catch {}
        }
      }

      // Authoritative PIM Categories Hydration
      const categoriesSetting = settingsRes.rows.find(
        (s) => (s.key === "categories" && s.group === "pim") || s.key === "pim_categories"
      );
      if (categoriesSetting && categoriesSetting.value) {
        try {
          const val = typeof categoriesSetting.value === "string" ? JSON.parse(categoriesSetting.value) : categoriesSetting.value;
          if (Array.isArray(val)) {
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
          if (Array.isArray(val)) {
            targetStore.occasions = val;
          }
        } catch {}
      }

      // Authoritative Accessories Hydration directly from PostgreSQL product records
      const pgAccessories = (productsRes.rows || [])
        .filter((p: any) => {
          const meta = p.metadata || {};
          return meta.pim_config?.inventory_mode === "STOCK_CONTROLLED" || meta.category_slug === "accessories" || p.id?.startsWith("acc_");
        })
        .map((p: any) => {
          const meta = p.metadata || {};
          return {
            id: p.id,
            sku: meta.sku || p.handle || p.id,
            barcode: meta.barcode || "",
            name: p.title,
            category_id: meta.primary_category_id || "cat_acc_cake",
            category_name: meta.category || "Cake Accessories",
            price: Number(meta.selling_price || meta.price || 0),
            cost_price: Number(meta.cost_price || 0),
            mrp: Number(meta.mrp || 0),
            stock: 0, // Relational stock belongs strictly to branch_inventory
            low_stock_threshold: Number(meta.low_stock_threshold || 5),
            gst_rate: Number(meta.gst_rate || 18),
            thumbnail: meta.thumbnail || p.thumbnail || "",
            images: (() => { const t = meta.thumbnail || p.thumbnail || ""; return (Array.isArray(meta.gallery) && meta.gallery.length > 0) ? meta.gallery : (t ? [t] : []); })(),
            description: p.description || "",
            status: meta.status || p.status || "active",
            weight: p.weight || "50g",
            created_at: p.created_at,
            updated_at: p.updated_at,
          };
        });

      if (pgAccessories.length > 0) {
        targetStore.accessories = pgAccessories;
      } else {
        const accessoriesSetting = settingsRes.rows.find(
          (s) => (s.key === "accessories" && s.group === "catalog") || s.key === "accessories"
        );
        if (accessoriesSetting && accessoriesSetting.value) {
          try {
            const val = typeof accessoriesSetting.value === "string" ? JSON.parse(accessoriesSetting.value) : accessoriesSetting.value;
            if (Array.isArray(val)) {
              targetStore.accessories = val;
            }
          } catch {}
        }
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
          if (Array.isArray(val)) {
            targetStore.cross_sell_rules = val;
          }
        } catch {}
      }

      // Business profile = public.company (Settings → Business Profile). Single source for invoices & pages.
      try {
        const { getCompanyProfile, invalidateCompanyProfile } = await import("./company-profile");
        invalidateCompanyProfile();
        targetStore.business_profile = await getCompanyProfile();
      } catch (e: any) {
        console.warn("[PostgreSQL Persistence] company profile load failed:", e?.message);
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

    // 13. Popup Campaigns & Versions — UNCONDITIONAL HYDRATION FROM POSTGRESQL
    const versionsByCampaignId = new Map<string, any[]>();
    for (const v of popupVersionsRes.rows || []) {
      const cId = v.popup_campaign_id;
      if (!versionsByCampaignId.has(cId)) versionsByCampaignId.set(cId, []);
      versionsByCampaignId.get(cId)!.push({
        id: v.id,
        popup_campaign_id: v.popup_campaign_id,
        version_number: v.version_number,
        content: v.content_json || {},
        design: v.design_json || {},
        trigger: v.trigger_json || {},
        audience: v.audience_json || {},
        frequency: v.frequency_json || {},
        schedule: v.schedule_json || {},
        cta: v.cta_json || {},
        media: v.media_json || {},
        rules: v.rules_json || [],
        created_at: v.created_at,
        published_at: v.published_at,
      });
    }

    targetStore.popup_campaigns = (popupCampaignsRes.rows || []).map((pop) => {
      const vers = versionsByCampaignId.get(pop.id) || [];
      const latestVer = vers[0] || null;
      return {
        id: pop.id,
        name: pop.name,
        slug: pop.slug || pop.id,
        description: pop.description || "",
        popup_type: pop.popup_type || "PROMOTIONAL",
        status: pop.status || "draft",
        priority: Number(pop.priority) || 100,
        enabled: pop.enabled !== false,
        start_at: pop.start_at,
        end_at: pop.end_at,
        timezone: pop.timezone || "Asia/Kolkata",
        current_version: pop.status === "published" ? latestVer : undefined,
        draft_version: latestVer || undefined,
        created_at: pop.created_at,
        updated_at: pop.updated_at,
      };
    });

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
    // Once per server start: copy any media still stored outside S3 into S3, then reload so pages use the S3 links.
    const gAny = globalThis as any;
    if (!gAny.__cthMediaToS3Started && process.env.AWS_S3_BUCKET_NAME && process.env.MEDIA_MIGRATION_DISABLED !== "true") {
      gAny.__cthMediaToS3Started = true;
      const store = targetStore;
      import("./media/s3-only")
        .then(({ moveExternalMediaToS3 }) => moveExternalMediaToS3())
        .then(async (r) => {
          if (r.rows || r.errors.length) console.log(`[media] moved ${r.moved} file(s) to S3, updated ${r.rows} row(s)`, r.errors.slice(0, 5));
          if (r.rows) await hydrateStoreFromDatabase(store);
        })
        .catch((e) => console.error("[media] move to S3 failed:", e?.message));
    }
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
const toCoord = (v: any): number | null => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

export async function persistBranchToDb(branch: any): Promise<void> {
  if (!process.env.DATABASE_URL || process.env.SKIP_DB_PERSISTENCE === "true") {
    return;
  }
  const id = branch.id;
  const lat = toCoord(branch.latitude);
  const lng = toCoord(branch.longitude);

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
    product_availability: branch.product_availability || branch.metadata?.product_availability || {},
    cake_fulfilment: branch.cake_fulfilment || branch.metadata?.cake_fulfilment || {},
    accessory_inventory: branch.accessory_inventory || branch.metadata?.accessory_inventory || {},
    operational_status: branch.operational_status || "operational",
    extended_status: branch.extended_status || "open",
    branch_type: branch.branch_type || "main_hub",
    city: branch.city || (branch.city_id === "city_klm" ? "Kollam" : "Bengaluru"),
    city_id: branch.city_id || (branch.city?.toLowerCase() === "kollam" ? "city_klm" : "city_bbr"),
    state: branch.state || (branch.city_id === "city_klm" ? "Kerala" : "Karnataka"),
    state_id: branch.state_id || (branch.state?.toLowerCase().includes("kerala") || branch.city_id === "city_klm" ? "state_kl" : "state_ka"),
    state_code: branch.state_code || (branch.state?.toLowerCase().includes("kerala") || branch.city_id === "city_klm" ? "KL" : "KA"),
    pincode: branch.pincode || "",
  };

  const resolvedCityId = branch.city_id || (branch.city?.toLowerCase() === "kollam" ? "city_klm" : "city_bbr");

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
        "city_id" = EXCLUDED.city_id,
        "metadata" = EXCLUDED.metadata,
        "updated_at" = NOW()
    `,
      [
        id,
        branch.name,
        branch.code || id,
        branch.is_open !== false,
        branch.phone || null,
        branch.email || null,
        branch.address || null,
        lat,
        lng,
        DEFAULT_SHOP_ID,
        resolvedCityId,
        JSON.stringify(metadata),
      ]
    );

    // 2. Sync Delivery Zones in 1 batch query (N queries -> 1 query)
    const zones = Array.isArray(branch.delivery_zones) ? branch.delivery_zones : [];
    if (zones.length > 0) {
      const values: any[] = [];
      const valuePlaceholders: string[] = [];

      zones.forEach((z: any, index: number) => {
        const zoneId = z.id || `zone_${id}_${z.pincode || Math.random().toString(36).slice(2, 7)}_${index}`;
        const fee = Number(z.delivery_fee || z.base_fee || z.delivery_charge || 0);
        const radius = Number(z.radius_km || 10);
        const polygonCoords = Array.isArray(z.polygon_coordinates) ? z.polygon_coordinates : [];
        const offset = index * 11;

        valuePlaceholders.push(
          `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, NOW(), NOW())`
        );
        values.push(
          zoneId,
          z.pincode || (z.pincodes && z.pincodes[0]) || null,
          id,
          fee,
          z.enabled !== false,
          JSON.stringify(polygonCoords),
          radius,
          lat,
          lng,
          z.priority || 10,
          z.estimated_delivery_minutes || 35
        );
      });

      await client.query(
        `
        INSERT INTO "delivery_zone" ("id", "pincode", "branch_id", "delivery_fee", "is_serviceable", "polygon_coordinates", "radius_km", "center_latitude", "center_longitude", "priority", "estimated_delivery_minutes", "created_at", "updated_at")
        VALUES ${valuePlaceholders.join(", ")}
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
        values
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
  const numPrice = Number(product.price || product.selling_price || 0);

  const metadata = {
    price: numPrice,
    selling_price: numPrice,
    cost_price: Number(product.cost_price || 0),
    mrp: Number(product.mrp || numPrice),
    rating: Number(product.rating || 0),
    review_count: Number(product.review_count || 0),
    category: product.category || "",
    category_slug: product.category_slug || "",
    primary_category_id: product.primary_category_id || null,
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
    gst_rate: typeof product.gst_rate === "number" ? product.gst_rate : (product.gst_rate ? Number(product.gst_rate) : undefined),
    tax_class: product.tax_class || undefined,
    tax_configuration_id: product.tax_rate_id || product.tax_configuration_id || undefined,
    tax_rate_id: product.tax_rate_id || product.tax_configuration_id || undefined,
    hsn_code: product.hsn_code || "",
    sku: (product as any).sku || (product.metadata && (product.metadata as any).sku) || "",
    hsn_description: product.hsn_description || (product.hsn_code ? "Cakes, Pastries & Bakery Goods" : "Unclassified (Missing HSN Code)"),
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
    search_keywords: product.search_keywords || "",
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
    merchandise_type: (product.merchandise_type || (product.metadata && product.metadata.merchandise_type) || "CAKE").toUpperCase(),
  };
  const merchType = metadata.merchandise_type;

  await dbQuery(
    `
    INSERT INTO "product" ("id", "title", "handle", "description", "metadata", "merchandise_type", "hsn_code", "sku", "created_at")
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    ON CONFLICT ("id") DO UPDATE SET
      "title" = EXCLUDED.title,
      "handle" = EXCLUDED.handle,
      "description" = EXCLUDED.description,
      "metadata" = EXCLUDED.metadata,
      "merchandise_type" = EXCLUDED.merchandise_type,
      "hsn_code" = EXCLUDED.hsn_code
  `,
    [
      id,
      product.title || product.name || "Gourmet Cake",
      product.handle || product.slug || id,
      product.description || "",
      JSON.stringify({ ...metadata, thumbnail: product.thumbnail || "", status: product.status || "published" }),
      merchType,
      (product as any).hsn_code || metadata.hsn_code || "",
      (product as any).sku || metadata.sku || id,
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
  if (!process.env.DATABASE_URL || process.env.SKIP_DB_PERSISTENCE === "true") {
    return;
  }
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
  if (!process.env.DATABASE_URL || process.env.SKIP_DB_PERSISTENCE === "true") {
    return;
  }
  const id = partner.id || `dlp_${Date.now()}`;
  const nameParts = (partner.name || `Driver ${partner.partner_number || "01"}`).trim().split(" ");
  const firstName = partner.first_name || nameParts[0] || "Driver";
  const lastName = partner.last_name || nameParts.slice(1).join(" ") || "Rider";

  await dbQuery(
    `
    INSERT INTO "delivery_partner" ("id", "first_name", "last_name", "email", "phone", "avatar_url", "is_active", "metadata", "created_at", "updated_at")
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW(), NOW())
    ON CONFLICT ("id") DO UPDATE SET
      "first_name" = EXCLUDED.first_name,
      "last_name" = EXCLUDED.last_name,
      "email" = EXCLUDED.email,
      "phone" = EXCLUDED.phone,
      "avatar_url" = EXCLUDED.avatar_url,
      "is_active" = EXCLUDED.is_active,
      "metadata" = EXCLUDED.metadata,
      "deleted_at" = NULL,
      "updated_at" = NOW()
  `,
    [
      id,
      firstName,
      lastName,
      partner.email || null,
      partner.phone || null,
      partner.avatar_url || partner.profile_photo || null,
      partner.is_active !== false && !["inactive", "suspended"].includes(String(partner.status || "").toLowerCase()),
      JSON.stringify(partner),
    ]
  );
}

/** Soft-deletes a delivery partner row in PostgreSQL. */
export async function deleteDeliveryPartnerFromDb(id: string): Promise<void> {
  if (!process.env.DATABASE_URL || process.env.SKIP_DB_PERSISTENCE === "true") return;
  await dbQuery(
    `UPDATE "delivery_partner" SET "deleted_at" = NOW(), "is_active" = false, "updated_at" = NOW() WHERE "id" = $1`,
    [id]
  );
}

/**
 * Persists an Order to PostgreSQL
 */
export async function persistOrderToDb(order: any): Promise<void> {
  if ((!process.env.DATABASE_URL && !process.env.TEST_DATABASE_URL) || process.env.SKIP_DB_PERSISTENCE === "true") {
    return;
  }
  const id = order.id || `ord_${Date.now()}`;
  const rawStatus = (order.status || "pending").toLowerCase();
  const validPgStatus = ["completed", "canceled", "draft", "archived", "requires_action"].includes(rawStatus)
    ? rawStatus
    : "pending";

  const numTotal = Number(order.total_amount || order.total || order.grand_total || 0);
  const customerId = order.customer_id || order.customer_uid || null;
  const items = Array.isArray(order.items) && order.items.length > 0
    ? order.items
    : Array.isArray(order.metadata?.items) && order.metadata.items.length > 0
    ? order.metadata.items
    : [];

  await dbTransaction(async (client) => {
    // 1. Upsert Order
    await client.query(
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
          ...(order.metadata || {}),
          items,
          delivery: (() => {
            const d = order.delivery || order.metadata?.delivery || {};
            if (d && typeof d === 'object') {
              const { order: _o, ...rest } = d;
              return rest;
            }
            return {};
          })(),
          delivery_latitude: order.delivery_latitude || null,
          delivery_longitude: order.delivery_longitude || null,
          delivery_slot_id: order.delivery_slot_id || order.delivery?.slot_id || null,
          delivery_slot_time: order.delivery_slot_time || order.delivery?.slot_time || null,
          delivery_date: order.delivery_date || order.delivery?.date || null,
          branch_id: order.branch_id || null,
          delivery_zone_id: order.delivery_zone_id || null,
          total_amount: numTotal,
          payment_method: order.payment_method || "cod",
          payment_status: order.payment_status || "pending",
          customer_uid: order.customer_uid || order.customer_id || null,
          customer_phone: order.customer_phone || order.phone || null,
          customer_name: order.customer_name || null,
          bakery_status: order.status || "confirmed",
          order_number: order.order_number || `ORD-${id.slice(-6)}`,
          delivery_address: order.delivery_address || order.delivery?.address || order.metadata?.delivery_address || null,
          delivery_state: order.delivery_state || order.state || order.delivery?.state || order.metadata?.delivery_state || null,
          delivery_city: order.delivery_city || order.city || order.delivery?.city || order.metadata?.delivery_city || null,
          delivery_pincode: order.delivery_pincode || order.pincode || order.delivery?.pincode || order.metadata?.delivery_pincode || null,
          state: order.delivery_state || order.state || order.metadata?.state || null,
          city: order.delivery_city || order.city || order.metadata?.city || null,
          pincode: order.delivery_pincode || order.pincode || order.metadata?.pincode || null,
          invoice_number: order.invoice_number || order.metadata?.invoice_number || null,
          invoice_id: order.invoice_id || order.metadata?.invoice_id || null,
          accounting_voucher_id: order.accounting_voucher_id || order.metadata?.accounting_voucher_id || null,
          delivery_otp: order.delivery_otp || order.delivery?.delivery_otp || order.metadata?.delivery_otp || null,
          pickup_otp: order.pickup_otp || order.delivery?.pickup_otp || order.metadata?.pickup_otp || null,
          delivery_partner_id: order.delivery_partner_id || order.delivery?.delivery_partner_id || order.metadata?.delivery_partner_id || null,
          delivery_status: order.delivery_status || order.delivery?.delivery_status || order.metadata?.delivery_status || "pending",
          is_ledger_eligible: order.is_ledger_eligible !== false,
        }),
      ]
    );

    // 2. Persist Relational Order Lines Atomically
    if (items.length > 0) {
      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        const lineItemId = item.line_item_id || item.id || `oli_${id}_${idx}`;
        const orderItemId = item.order_item_id || `oi_${id}_${idx}`;
        const unitPrice = Number(item.unit_price ?? item.price ?? item.selling_price ?? 0);
        const qty = Number(item.quantity || 1);
        const title = item.title || item.product_name || item.name || "Custom Cake";
        const variantId = item.variant_id || null;
        const productId = item.product_id || null;
        const sku = item.sku || item.variant_sku || null;

        // Upsert into order_line_item
        await client.query(
          `
          INSERT INTO public.order_line_item (
            "id", "totals_id", "title", "thumbnail", "variant_id", "product_id",
            "product_title", "variant_sku", "requires_shipping", "is_discountable",
            "is_tax_inclusive", "compare_at_unit_price", "raw_compare_at_unit_price",
            "unit_price", "raw_unit_price", "metadata", "created_at", "updated_at"
          ) VALUES (
            $1, NULL, $2, $3, $4, $5, $2, $6, TRUE, TRUE, FALSE,
            $7, $8, $7, $8, $9, NOW(), NOW()
          )
          ON CONFLICT ("id") DO UPDATE SET
            "title" = EXCLUDED.title,
            "unit_price" = EXCLUDED.unit_price,
            "raw_unit_price" = EXCLUDED.raw_unit_price,
            "metadata" = EXCLUDED.metadata,
            "updated_at" = NOW();
        `,
          [
            lineItemId,
            title,
            item.thumbnail || null,
            variantId,
            productId,
            sku,
            unitPrice,
            JSON.stringify({ value: String(unitPrice), precision: 20 }),
            JSON.stringify({
              variant_name: item.variant_name || item.weight || null,
              discount: Number(item.discount || 0),
              tax_rate: Number(item.tax_rate ?? item.gst_rate_pct ?? 5),
              tax_amount: Number(item.tax_amount || 0),
              total_line_amount: Number(item.total_line_amount ?? item.total ?? (unitPrice * qty)),
              customization: item.customization || {},
              merchandise_type: item.merchandise_type || null,
            }),
          ]
        );

        // Upsert into order_item
        await client.query(
          `
          INSERT INTO public.order_item (
            "id", "order_id", "version", "item_id", "quantity", "raw_quantity",
            "fulfilled_quantity", "shipped_quantity",
            "return_requested_quantity", "return_received_quantity",
            "return_dismissed_quantity", "written_off_quantity",
            "unit_price", "raw_unit_price", "metadata", "created_at", "updated_at"
          ) VALUES (
            $1, $2, 1, $3, $4, $5,
            0, 0,
            0, 0,
            0, 0,
            $6, $7, $8, NOW(), NOW()
          )
          ON CONFLICT ("id") DO UPDATE SET
            "quantity" = EXCLUDED.quantity,
            "raw_quantity" = EXCLUDED.raw_quantity,
            "unit_price" = EXCLUDED.unit_price,
            "raw_unit_price" = EXCLUDED.raw_unit_price,
            "metadata" = EXCLUDED.metadata,
            "updated_at" = NOW();
        `,
          [
            orderItemId,
            id,
            lineItemId,
            qty,
            JSON.stringify({ value: String(qty), precision: 20 }),
            unitPrice,
            JSON.stringify({ value: String(unitPrice), precision: 20 }),
            JSON.stringify({
              line_total: Number(item.total_line_amount ?? item.total ?? (unitPrice * qty)),
            }),
          ]
        );

        // Link totals_id
        await client.query(`UPDATE public.order_line_item SET "totals_id" = $1 WHERE "id" = $2;`, [orderItemId, lineItemId]);
      }
    }
  });
}

/**
 * Persists a CMS Page to PostgreSQL
 */
export async function persistCmsPageToDb(page: any): Promise<void> {
  const id = page.id || `cmspg_${Date.now()}`;
  const blockData = {
    subheading: page.subheading !== undefined ? page.subheading : "",
    h1: page.h1 !== undefined ? page.h1 : "",
    intro_content: page.intro_content !== undefined ? page.intro_content : "",
    breadcrumb_title: page.breadcrumb_title !== undefined ? page.breadcrumb_title : "",
    announcement_bar: page.announcement_bar || null,
    header_config: page.header_config || null,
    visibility_rules: page.visibility_rules || null,
    robots_tag: page.robots_tag || "index, follow",
    keywords: page.keywords || "",
    og_title: page.og_title || "",
    og_description: page.og_description || "",
    og_type: page.og_type || "website",
    twitter_card: page.twitter_card || "summary_large_image",
    twitter_title: page.twitter_title || "",
    twitter_description: page.twitter_description || "",
    twitter_image: page.twitter_image || "",
    structured_data_type: page.structured_data_type || "WebPage",
    sitemap_include: page.sitemap_include ?? true,
    sitemap_priority: page.sitemap_priority || "0.7",
    sitemap_changefreq: page.sitemap_changefreq || "weekly",
    nav_location: page.nav_location || "none",
    hide_from_nav: page.hide_from_nav ?? false,
    sections: page.sections || [],
    theme: page.theme || page.published_config?.theme || page.draft_config?.theme || null,
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
      JSON.stringify(await externalizeInlineImages(blockData)),
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
function toTextCol(val: any): string | null {
  if (val === undefined || val === null) return null;
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

export async function persistOfferToDb(offer: any): Promise<void> {
  const id = offer.id || `off_${Date.now()}`;
  const code = (offer.code || `OFFER_${Date.now()}`).toUpperCase().trim();
  const meta = typeof offer.metadata === "object" ? offer.metadata : (offer.discount_value !== undefined ? { discount_value: offer.discount_value } : {});

  await dbQuery(
    `
    INSERT INTO "offer" (
      "id", "name", "code", "type", "status", "priority",
      "starts_at", "ends_at", "usage_limit", "per_customer_limit", "is_stackable",
      "description", "conditions", "rewards", "is_public", "branch_ids",
      "customer_segments", "metadata", "total_redemptions", "start_time", "end_time",
      "timezone", "never_expires", "daily_limit", "monthly_limit", "auto_apply",
      "delivery_mode", "allowed_payment_methods", "min_order_value", "max_discount_value",
      "min_quantity", "applicable_branches", "applicable_cities", "applicable_pincodes",
      "excluded_pincodes", "applicable_products", "applicable_categories", "applicable_flavors",
      "applicable_shapes", "applicable_weights", "customer_eligibility", "allowed_customer_ids",
      "allowed_phones", "allowed_emails", "customer_tags", "exclude_discounted_items",
      "exclude_flash_sales", "approval_status", "created_by", "approved_by",
      "total_discount_given", "total_revenue_generated", "created_at", "updated_at"
    )
    VALUES (
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9, $10, $11,
      $12, $13, $14, $15, $16,
      $17, $18, $19, $20, $21,
      $22, $23, $24, $25, $26,
      $27, $28, $29, $30,
      $31, $32, $33, $34,
      $35, $36, $37, $38,
      $39, $40, $41, $42,
      $43, $44, $45, $46,
      $47, $48, $49, $50,
      $51, $52, NOW(), NOW()
    )
    ON CONFLICT ("id") DO UPDATE SET
      "name" = EXCLUDED.name,
      "code" = EXCLUDED.code,
      "type" = EXCLUDED.type,
      "status" = EXCLUDED.status,
      "priority" = EXCLUDED.priority,
      "starts_at" = EXCLUDED.starts_at,
      "ends_at" = EXCLUDED.ends_at,
      "usage_limit" = EXCLUDED.usage_limit,
      "per_customer_limit" = EXCLUDED.per_customer_limit,
      "is_stackable" = EXCLUDED.is_stackable,
      "description" = EXCLUDED.description,
      "conditions" = EXCLUDED.conditions,
      "rewards" = EXCLUDED.rewards,
      "is_public" = EXCLUDED.is_public,
      "branch_ids" = EXCLUDED.branch_ids,
      "customer_segments" = EXCLUDED.customer_segments,
      "metadata" = EXCLUDED.metadata,
      "total_redemptions" = EXCLUDED.total_redemptions,
      "start_time" = EXCLUDED.start_time,
      "end_time" = EXCLUDED.end_time,
      "timezone" = EXCLUDED.timezone,
      "never_expires" = EXCLUDED.never_expires,
      "daily_limit" = EXCLUDED.daily_limit,
      "monthly_limit" = EXCLUDED.monthly_limit,
      "auto_apply" = EXCLUDED.auto_apply,
      "delivery_mode" = EXCLUDED.delivery_mode,
      "allowed_payment_methods" = EXCLUDED.allowed_payment_methods,
      "min_order_value" = EXCLUDED.min_order_value,
      "max_discount_value" = EXCLUDED.max_discount_value,
      "min_quantity" = EXCLUDED.min_quantity,
      "applicable_branches" = EXCLUDED.applicable_branches,
      "applicable_cities" = EXCLUDED.applicable_cities,
      "applicable_pincodes" = EXCLUDED.applicable_pincodes,
      "excluded_pincodes" = EXCLUDED.excluded_pincodes,
      "applicable_products" = EXCLUDED.applicable_products,
      "applicable_categories" = EXCLUDED.applicable_categories,
      "applicable_flavors" = EXCLUDED.applicable_flavors,
      "applicable_shapes" = EXCLUDED.applicable_shapes,
      "applicable_weights" = EXCLUDED.applicable_weights,
      "customer_eligibility" = EXCLUDED.customer_eligibility,
      "allowed_customer_ids" = EXCLUDED.allowed_customer_ids,
      "allowed_phones" = EXCLUDED.allowed_phones,
      "allowed_emails" = EXCLUDED.allowed_emails,
      "customer_tags" = EXCLUDED.customer_tags,
      "exclude_discounted_items" = EXCLUDED.exclude_discounted_items,
      "exclude_flash_sales" = EXCLUDED.exclude_flash_sales,
      "approval_status" = EXCLUDED.approval_status,
      "created_by" = EXCLUDED.created_by,
      "approved_by" = EXCLUDED.approved_by,
      "total_discount_given" = EXCLUDED.total_discount_given,
      "total_revenue_generated" = EXCLUDED.total_revenue_generated,
      "updated_at" = NOW()
  `,
    [
      id,
      offer.name || offer.title || code,
      code,
      offer.type || offer.discount_type || "percentage",
      offer.status || "active",
      Number(offer.priority) || 0,
      offer.starts_at ? new Date(offer.starts_at) : null,
      offer.ends_at ? new Date(offer.ends_at) : null,
      offer.usage_limit ? Number(offer.usage_limit) : null,
      offer.per_customer_limit !== undefined && offer.per_customer_limit !== null ? Number(offer.per_customer_limit) : 1,
      Boolean(offer.is_stackable),
      offer.description || "",
      toTextCol(offer.conditions),
      toTextCol(offer.rewards),
      offer.is_public !== false,
      toTextCol(offer.branch_ids),
      toTextCol(offer.customer_segments),
      toTextCol(meta),
      Number(offer.total_redemptions) || 0,
      offer.start_time || null,
      offer.end_time || null,
      offer.timezone || "Asia/Kolkata",
      Boolean(offer.never_expires),
      offer.daily_limit ? Number(offer.daily_limit) : null,
      offer.monthly_limit ? Number(offer.monthly_limit) : null,
      Boolean(offer.auto_apply),
      offer.delivery_mode || "all",
      toTextCol(offer.allowed_payment_methods || ["cash", "card", "upi", "wallet", "cod", "online"]),
      Number(offer.min_order_value ?? offer.min_order ?? offer.min_order_amount ?? 0),
      offer.max_discount_value !== undefined && offer.max_discount_value !== null ? Number(offer.max_discount_value) : null,
      Number(offer.min_quantity) || 1,
      toTextCol(offer.applicable_branches || ["all"]),
      toTextCol(offer.applicable_cities || ["all"]),
      toTextCol(offer.applicable_pincodes || ["all"]),
      toTextCol(offer.excluded_pincodes || []),
      toTextCol(offer.applicable_products || []),
      toTextCol(offer.applicable_categories || []),
      toTextCol(offer.applicable_flavors || []),
      toTextCol(offer.applicable_shapes || []),
      toTextCol(offer.applicable_weights || []),
      offer.customer_eligibility || "all",
      toTextCol(offer.allowed_customer_ids || []),
      toTextCol(offer.allowed_phones || []),
      toTextCol(offer.allowed_emails || []),
      toTextCol(offer.customer_tags || []),
      Boolean(offer.exclude_discounted_items),
      Boolean(offer.exclude_flash_sales),
      offer.approval_status || "approved",
      offer.created_by || "usr_super_admin",
      offer.approved_by || null,
      Number(offer.total_discount_given) || 0,
      Number(offer.total_revenue_generated) || 0,
    ]
  );
}

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
    g = (groupOrSetting as string) || "general";
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
  const slug = (campaign.slug || campaign.name || `popup-${Date.now()}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  // 1. Persist to popup_campaigns
  await dbQuery(
    `
    INSERT INTO "popup_campaigns" ("id", "name", "slug", "description", "popup_type", "status", "priority", "enabled", "start_at", "end_at", "timezone", "created_at", "updated_at")
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
    ON CONFLICT ("id") DO UPDATE SET
      "name" = EXCLUDED.name,
      "slug" = EXCLUDED.slug,
      "description" = EXCLUDED.description,
      "popup_type" = EXCLUDED.popup_type,
      "status" = EXCLUDED.status,
      "priority" = EXCLUDED.priority,
      "enabled" = EXCLUDED.enabled,
      "start_at" = EXCLUDED.start_at,
      "end_at" = EXCLUDED.end_at,
      "timezone" = EXCLUDED.timezone,
      "updated_at" = NOW()
  `,
    [
      id,
      campaign.name || "Special Campaign",
      slug,
      campaign.description || "",
      campaign.popup_type || "PROMOTIONAL",
      campaign.status || "draft",
      Number(campaign.priority) || 100,
      campaign.enabled !== false,
      campaign.start_at ? new Date(campaign.start_at) : null,
      campaign.end_at ? new Date(campaign.end_at) : null,
      campaign.timezone || "Asia/Kolkata",
    ]
  );

  // 2. Persist to popup_versions
  const version = campaign.current_version || campaign.draft_version || {};
  const versionId = version.id || `ver_${id}_${Date.now()}`;
  const versionNumber = Number(version.version_number) || 1;

  const contentJson = version.content || {
    headline: campaign.title || campaign.name || "Special Celebration Offer",
    description: campaign.body_text || "",
    primaryButton: { label: "Claim Offer", action: "OPEN_CART" },
  };
  const designJson = version.design || {
    desktopLayout: "CENTER_MODAL",
    tabletLayout: "CENTER_MODAL",
    mobileLayout: "BOTTOM_SHEET",
    width: 520,
    borderRadius: 20,
    backdropOpacity: 0.6,
    animation: "SLIDE_UP",
  };
  const triggerJson = version.trigger || { exitIntent: true, timeOnPageSeconds: 3 };
  const audienceJson = version.audience || { customerStatus: ["all"], devices: ["mobile", "tablet", "desktop"] };
  const frequencyJson = version.frequency || { scope: "session", maxShows: 1, cooldownSeconds: 86400 };
  const scheduleJson = version.schedule || { startAt: campaign.start_at || null, endAt: campaign.end_at || null, timezone: "Asia/Kolkata" };
  const ctaJson = version.cta || version.content?.primaryButton || { label: "Claim Offer", action: "OPEN_CART" };
  const mediaJson = version.media || { source: "NO_IMAGE" };
  const rulesJson = version.rules || [];

  await dbQuery(
    `
    INSERT INTO "popup_versions" (
      "id", "popup_campaign_id", "version_number",
      "content_json", "design_json", "trigger_json", "audience_json",
      "frequency_json", "schedule_json", "cta_json", "media_json", "rules_json",
      "created_at", "published_at"
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), $13)
    ON CONFLICT ("id") DO UPDATE SET
      "version_number" = EXCLUDED.version_number,
      "content_json" = EXCLUDED.content_json,
      "design_json" = EXCLUDED.design_json,
      "trigger_json" = EXCLUDED.trigger_json,
      "audience_json" = EXCLUDED.audience_json,
      "frequency_json" = EXCLUDED.frequency_json,
      "schedule_json" = EXCLUDED.schedule_json,
      "cta_json" = EXCLUDED.cta_json,
      "media_json" = EXCLUDED.media_json,
      "rules_json" = EXCLUDED.rules_json,
      "published_at" = EXCLUDED.published_at
  `,
    [
      versionId,
      id,
      versionNumber,
      JSON.stringify(contentJson),
      JSON.stringify(designJson),
      JSON.stringify(triggerJson),
      JSON.stringify(audienceJson),
      JSON.stringify(frequencyJson),
      JSON.stringify(scheduleJson),
      JSON.stringify(ctaJson),
      JSON.stringify(mediaJson),
      JSON.stringify(rulesJson),
      campaign.status === "published" ? new Date() : null,
    ]
  );
}

/**
 * Deletes / archives an Offer from PostgreSQL
 */
export async function deleteOfferFromDb(offerId: string): Promise<void> {
  await dbQuery(`UPDATE "offer" SET "deleted_at" = NOW(), "status" = 'archived' WHERE "id" = $1 OR "code" = $1`, [offerId]);
}

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




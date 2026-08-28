/**
 * CakeToHome — Authoritative PostgreSQL Database Persistence Layer
 *
 * Direct asynchronous persistence to PostgreSQL for all domain entities.
 * Enforces authoritative database durability.
 */

import { dbQuery, dbTransaction } from "./db";

// Default Shop ID in Medusa
const DEFAULT_SHOP_ID = "res_01KXYMAHGFPRY1G9TZKEVGAGAT";

/**
 * Hydrates in-memory store from PostgreSQL
 */
export async function hydrateStoreFromDatabase(targetStore: any): Promise<boolean> {
  try {
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

    // 2. Branches
    if (branchesRes.rows.length > 0) {
      targetStore.branches = branchesRes.rows.map((b) => {
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
    }

    // 3. Cities
    if (citiesRes.rows.length > 0) {
      targetStore.cities = citiesRes.rows.map((c) => ({
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
    }

    // 4. Products
    if (productsRes.rows.length > 0) {
      targetStore.products = productsRes.rows.map((p) => {
        const meta = p.metadata || {};
        const price = Number(meta.price || meta.selling_price || 599);
        return {
          id: p.id,
          product_id: p.id,
          title: p.title,
          name: p.title,
          handle: p.handle,
          description: p.description || "",
          thumbnail: p.thumbnail || "",
          status: p.status || "published",
          price,
          selling_price: price,
          rating: Number(meta.rating) || 4.9,
          review_count: Number(meta.review_count) || 12,
          category: meta.category || "Chocolate Cakes",
          category_slug: meta.category_slug || "chocolate-cakes",
          primary_category_id: meta.primary_category_id || "cat_chocolate",
          category_ids: meta.category_ids || [],
          flavour: meta.flavour || "Chocolate",
          weight: p.weight || "1 kg",
          variants_json: meta.variants_json || { weights: ["0.5 kg", "1 kg", "1.5 kg", "2 kg"] },
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
          enable_flavor_selection: meta.enable_flavor_selection,
          enable_shape_selection: meta.enable_shape_selection,
          created_at: p.created_at,
          updated_at: p.updated_at,
        };
      });
    }

    // 5. Addresses Map by Customer
    const addrsByCust = new Map<string, any[]>();
    for (const a of addressesRes.rows) {
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

    // 6. Customers
    if (customersRes.rows.length > 0) {
      targetStore.customers = customersRes.rows.map((c) => {
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
    }

    // 7. Delivery Partners
    if (partnersRes.rows.length > 0) {
      targetStore.delivery_partners = partnersRes.rows.map((d) => ({
        id: d.id,
        name: `${d.first_name || ""} ${d.last_name || ""}`.trim() || "Delivery Partner",
        first_name: d.first_name,
        last_name: d.last_name,
        email: d.email,
        phone: d.phone,
        avatar_url: d.avatar_url,
        is_active: d.is_active !== false,
        status: d.is_active !== false ? "active" : "inactive",
        created_at: d.created_at,
        updated_at: d.updated_at,
      }));
    }

    // 8. Orders
    if (ordersRes.rows.length > 0) {
      targetStore.orders = ordersRes.rows.map((o) => {
        const meta = o.metadata || {};
        return {
          id: o.id,
          display_id: o.display_id,
          order_number: meta.order_number || `ORD-${o.display_id || o.id.slice(-6)}`,
          email: o.email,
          status: meta.bakery_status || o.status || "confirmed",
          pg_status: o.status,
          total: Number(meta.total_amount || o.total || 0),
          total_amount: Number(meta.total_amount || o.total || 0),
          customer_uid: meta.customer_uid || o.customer_id,
          customer_id: o.customer_id,
          customer_phone: meta.customer_phone || o.email,
          customer_name: meta.customer_name || "Valued Customer",
          branch_id: meta.branch_id || "br_indiranagar",
          items: meta.items || [],
          delivery: meta.delivery || {},
          delivery_latitude: meta.delivery_latitude,
          delivery_longitude: meta.delivery_longitude,
          delivery_slot_id: meta.delivery_slot_id,
          delivery_slot_time: meta.delivery_slot_time,
          delivery_type: meta.delivery_type || "standard",
          delivery_partner_id: meta.delivery_partner_id || null,
          payment_method: meta.payment_method || "COD",
          payment_status: meta.payment_status || "pending",
          created_at: o.created_at,
          updated_at: o.updated_at,
        };
      });
    }

    // 9. CMS Pages
    if (cmsPagesRes.rows.length > 0) {
      targetStore.cms_pages = cmsPagesRes.rows.map((p) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        page_type: p.page_type,
        status: p.status,
        meta_title: p.meta_title,
        meta_description: p.meta_description,
        sections: p.sections || [],
        draft_config: p.draft_config || {},
        published_config: p.published_config || {},
        version_history: p.version_history || [],
        created_at: p.created_at,
        updated_at: p.updated_at,
        published_at: p.published_at,
      }));
    }

    // 10. Offers
    if (offersRes.rows.length > 0) {
      targetStore.offers = offersRes.rows.map((off) => ({
        id: off.id,
        name: off.name,
        code: off.code,
        type: off.type,
        discount_value: Number(off.discount_value),
        min_order: Number(off.min_order),
        is_active: off.is_active !== false,
        description: off.description,
        metadata: off.metadata || {},
        created_at: off.created_at,
        updated_at: off.updated_at,
      }));
    }

    // 11. Settings
    if (settingsRes.rows.length > 0) {
      targetStore.settings = settingsRes.rows.map((s) => ({
        id: s.id,
        group: s.group,
        key: s.key,
        value: s.value,
        is_public: s.is_public !== false,
        created_at: s.created_at,
        updated_at: s.updated_at,
      }));

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
    }

    // 12. Popup Campaigns
    if (popupCampaignsRes.rows.length > 0) {
      targetStore.popup_campaigns = popupCampaignsRes.rows.map((pop) => ({
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
    }

    console.log(
      `[PostgreSQL Persistence] Hydrated store: ${targetStore.branches?.length || 0} branches, ${targetStore.products?.length || 0} products, ${targetStore.customers?.length || 0} customers, ${targetStore.orders?.length || 0} orders.`
    );
    return true;
  } catch (err: any) {
    console.error("[PostgreSQL Persistence] Failed to hydrate store from database:", err.message);
    return false;
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

    // 2. Upsert Delivery Zones
    const zones = Array.isArray(branch.delivery_zones) ? branch.delivery_zones : [];
    for (const z of zones) {
      const zoneId = z.id || `zone_${id}_${Date.now()}`;
      const fee = Number(z.delivery_fee ?? z.delivery_charge ?? z.base_fee ?? 0);
      const radius = Number(z.radius_km || branch.max_delivery_radius_km || 10);
      const polygonCoords = Array.isArray(z.polygon_coordinates) ? z.polygon_coordinates : [];

      await client.query(
        `
        INSERT INTO "delivery_zone" ("id", "pincode", "branch_id", "delivery_fee", "is_serviceable", "polygon_coordinates", "radius_km", "center_latitude", "center_longitude", "priority", "estimated_delivery_minutes", "created_at", "updated_at")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
        ON CONFLICT ("id") DO UPDATE SET
          "branch_id" = EXCLUDED.branch_id,
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
 * Persists a Product to PostgreSQL
 */
export async function persistProductToDb(product: any): Promise<void> {
  const id = product.id || product.product_id;
  const numPrice = Number(product.price || product.selling_price || 599);

  const metadata = {
    price: numPrice,
    selling_price: numPrice,
    rating: product.rating || 4.9,
    review_count: product.review_count || 12,
    category: product.category || "Chocolate Cakes",
    category_slug: product.category_slug || "chocolate-cakes",
    primary_category_id: product.primary_category_id || "cat_chocolate",
    category_ids: product.category_ids || [],
    flavour: product.flavour || "Chocolate",
    variants_json: product.variants_json || { weights: ["0.5 kg", "1 kg", "1.5 kg", "2 kg"] },
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
  await dbQuery(
    `
    INSERT INTO "cms_page" ("id", "title", "slug", "page_type", "status", "meta_title", "meta_description", "draft_config", "published_config", "sections", "version_history", "created_at", "updated_at", "published_at")
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW(), $12)
    ON CONFLICT ("id") DO UPDATE SET
      "title" = EXCLUDED.title,
      "slug" = EXCLUDED.slug,
      "page_type" = EXCLUDED.page_type,
      "status" = EXCLUDED.status,
      "meta_title" = EXCLUDED.meta_title,
      "meta_description" = EXCLUDED.meta_description,
      "draft_config" = EXCLUDED.draft_config,
      "published_config" = EXCLUDED.published_config,
      "sections" = EXCLUDED.sections,
      "version_history" = EXCLUDED.version_history,
      "updated_at" = NOW(),
      "published_at" = EXCLUDED.published_at
  `,
    [
      id,
      page.title || "CMS Page",
      page.slug || id,
      page.page_type || "landing_page",
      page.status || "published",
      page.meta_title || page.title || "",
      page.meta_description || "",
      JSON.stringify(page.draft_config || {}),
      JSON.stringify(page.published_config || {}),
      JSON.stringify(page.sections || []),
      JSON.stringify(page.version_history || []),
      page.published_at ? new Date(page.published_at) : new Date(),
    ]
  );
}

/**
 * Persists an Offer to PostgreSQL
 */
export async function persistOfferToDb(offer: any): Promise<void> {
  const id = offer.id || `off_${Date.now()}`;
  await dbQuery(
    `
    INSERT INTO "offer" ("id", "name", "code", "type", "discount_value", "min_order", "is_active", "description", "metadata", "created_at", "updated_at")
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
    ON CONFLICT ("id") DO UPDATE SET
      "name" = EXCLUDED.name,
      "code" = EXCLUDED.code,
      "type" = EXCLUDED.type,
      "discount_value" = EXCLUDED.discount_value,
      "min_order" = EXCLUDED.min_order,
      "is_active" = EXCLUDED.is_active,
      "description" = EXCLUDED.description,
      "metadata" = EXCLUDED.metadata,
      "updated_at" = NOW()
  `,
    [
      id,
      offer.name || offer.code || "Promo Offer",
      (offer.code || `OFFER_${Date.now()}`).toUpperCase(),
      offer.type || offer.discount_type || "flat",
      Number(offer.discount_value) || 100,
      Number(offer.min_order) || 499,
      offer.is_active !== false,
      offer.description || "",
      JSON.stringify(offer.metadata || {}),
    ]
  );
}

/**
 * Persists a Setting to PostgreSQL
 */
export async function persistSettingToDb(group: string, key: string, value: any, isPublic: boolean = true): Promise<void> {
  const id = `set_${group}_${key}`;
  await dbQuery(
    `
    INSERT INTO "setting" ("id", "group", "key", "value", "is_public", "created_at", "updated_at")
    VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
    ON CONFLICT ("group", "key") WHERE (deleted_at IS NULL) DO UPDATE SET
      "value" = EXCLUDED.value,
      "is_public" = EXCLUDED.is_public,
      "updated_at" = NOW()
  `,
    [id, group, key, JSON.stringify(value), isPublic]
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

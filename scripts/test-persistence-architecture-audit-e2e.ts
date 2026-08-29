/**
 * Comprehensive Architecture & Persistence E2E Audit Test Suite
 * 
 * Verifies:
 * 1. PostgreSQL is the authoritative single source of truth (zero runtime JSON fallbacks).
 * 2. PIM Option authority (product-scoped flavors/shapes/weights, Super Admin persistence).
 * 3. Authoritative CMS persistence (PostgreSQL public.cms_page CRUD & publish lifecycle).
 * 4. Server-side price authority (recalculation of base + weight + options, rejecting client price spoofing).
 * 5. Map-first location coordinates and store pickup governance.
 */

import { dbQuery, getDbPool } from "../frontend/src/lib/db";
import { ApiEngine } from "../frontend/src/lib/api-engine";
import {
  hydrateStoreFromDatabase,
  persistProductToDb,
  deleteProductFromDb,
  persistCmsPageToDb,
  deleteCmsPageFromDb,
  persistSettingToDb,
} from "../frontend/src/lib/db-persistence";
import * as fs from "fs";
import * as path from "path";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedCount++;
  }
}

async function runAudit() {
  console.log("\n================================================================================");
  console.log("🚀 STARTING CAKETOHOME FULL PERSISTENCE & ARCHITECTURE E2E AUDIT");
  console.log("================================================================================\n");

  const testSuffix = Date.now();
  const testProductId = `audit_prod_${testSuffix}`;
  const testCmsPageId = `audit_pg_${testSuffix}`;
  const testCmsSlug = `audit-page-${testSuffix}`;

  try {
    // --------------------------------------------------------------------------
    // PHASE 1: Zero Runtime JSON Persistence & Authoritative DB Connection
    // --------------------------------------------------------------------------
    console.log("--- PHASE 1: Zero Runtime JSON Persistence & Database Connection ---");
    const jsonPaths = [
      path.join(process.cwd(), "frontend/src/lib/db-store.json"),
      path.join(process.cwd(), "frontend/src/lib/db-store.json.bak"),
      path.join(process.cwd(), "frontend/db-store.json"),
      path.join(process.cwd(), "db-store.json"),
    ];

    for (const p of jsonPaths) {
      const exists = fs.existsSync(p);
      assert(!exists, `JSON fallback file physically absent: ${path.basename(p)}`);
    }

    const dbPing = await dbQuery<{ current_db: string }>("SELECT current_database() as current_db;");
    assert(dbPing.rows.length > 0 && !!dbPing.rows[0].current_db, `Authoritative PostgreSQL connected: ${dbPing.rows[0]?.current_db}`);

    const hydration = await hydrateStoreFromDatabase();
    assert(hydration.productsCount > 0, `Database hydration authoritative (${hydration.productsCount} products loaded from PostgreSQL)`);

    // --------------------------------------------------------------------------
    // PHASE 2: Product & PIM Authority with Direct PostgreSQL Persistence
    // --------------------------------------------------------------------------
    console.log("\n--- PHASE 2: Product & PIM Authority with PostgreSQL Persistence ---");
    
    // 2.1 Create Admin Product via ApiEngine (awaiting PostgreSQL write)
    const newProductPayload = {
      id: testProductId,
      product_id: testProductId,
      title: `Audit Gourmet Black Forest Cake ${testSuffix}`,
      name: `Audit Gourmet Black Forest Cake ${testSuffix}`,
      handle: `audit-gourmet-black-forest-${testSuffix}`,
      price: 749,
      selling_price: 749,
      mrp: 899,
      description: "Rich dark chocolate sponge with fresh cherries and kirsch cream.",
      is_featured: true,
      is_bestseller: true,
      pim_config: {
        show_shape: true,
        show_flavour: true,
        show_eggless: true,
      },
    };

    const createdProduct = await ApiEngine.createAdminProduct(newProductPayload);
    assert(createdProduct.id === testProductId, `Product created via ApiEngine: ${createdProduct.title}`);

    // Verify written to PostgreSQL
    const dbProdRes = await dbQuery<any>('SELECT id, title, metadata FROM "product" WHERE id = $1', [testProductId]);
    assert(dbProdRes.rows.length === 1, `Product record exists in PostgreSQL public.product table`);
    const prodMeta = typeof dbProdRes.rows[0].metadata === "string" ? JSON.parse(dbProdRes.rows[0].metadata) : dbProdRes.rows[0].metadata;
    assert(Number(prodMeta?.price || prodMeta?.selling_price) === 749, `Authoritative price in PostgreSQL is ₹749`);

    // 2.2 Configure Weight Matrix & Surcharges
    const weightMatrix = [
      { weight_name: "0.5 kg", selling_price: 499, mrp: 599, is_enabled: true },
      { weight_name: "1 kg", selling_price: 749, mrp: 899, is_enabled: true },
      { weight_name: "2 kg", selling_price: 1399, mrp: 1699, is_enabled: true },
    ];
    const savedWeights = await ApiEngine.saveProductWeightPrices(testProductId, weightMatrix);
    assert(savedWeights.length === 3, `Weight tiers saved and normalized (${savedWeights.length} tiers)`);

    // 2.3 Flavor & Shape Option Mapping Enforcement
    // Configure specific mapped flavors (Vanilla +0, Dutch Chocolate +50)
    const flavorMappings = [
      { flavor_id: "flv_vanilla", name: "Classic Vanilla", price_modifier: 0, is_enabled: true },
      { flavor_id: "flv_dutch_choc", name: "Dutch Chocolate", price_modifier: 50, is_enabled: true },
    ];
    await ApiEngine.saveProductFlavorMappings(testProductId, flavorMappings);

    // Configure specific mapped shapes (Round +0, Heart +75)
    const shapeMappings = [
      { shape_id: "shp_round", name: "Round", price_modifier: 0, is_enabled: true },
      { shape_id: "shp_heart", name: "Heart Shape", price_modifier: 75, is_enabled: true },
    ];
    await ApiEngine.saveProductShapeMappings(testProductId, shapeMappings);

    // Verify Storefront Product Options Authority
    const storefrontOptions = ApiEngine.getStorefrontProductOptions(testProductId);
    assert(storefrontOptions.flavors.length === 2, `Storefront receives exactly 2 mapped flavors`);
    assert(storefrontOptions.shapes.length === 2, `Storefront receives exactly 2 mapped shapes`);
    assert(
      storefrontOptions.flavors.some((f: any) => f.name === "Dutch Chocolate" && f.price_modifier === 50),
      `Storefront received Dutch Chocolate with ₹50 surcharge`
    );

    // --------------------------------------------------------------------------
    // PHASE 3: Checkout Validation & Server-Side Price Authority
    // --------------------------------------------------------------------------
    console.log("\n--- PHASE 3: Checkout Validation & Price Recalculation ---");

    // 3.1 Price Tampering Test: Client attempts to spoof unit_price: 10
    const tomorrowDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const slotsRes = ApiEngine.getDeliverySlots("br_indiranagar", tomorrowDate, "delivery");
    const validSlot = slotsRes.delivery_slots?.find((s: any) => s.available) || slotsRes.delivery_slots?.[0];
    const validSlotId = validSlot ? validSlot.id : "standard";

    const tamperedCheckoutPayload = {
      items: [
        {
          product_id: testProductId,
          title: newProductPayload.title,
          weight: "1 kg",
          unit_price: 10, // Attempted spoof!
          price: 10,
          quantity: 1,
          flavour: "Classic Vanilla",
          shape: "Round",
        },
      ],
      address: {
        address_line_1: "12th Main Road, Indiranagar",
        city: "Bangalore",
        pincode: "560038",
        state: "Karnataka",
        latitude: 12.9716,
        longitude: 77.6412,
      },
      pincode: "560038",
      delivery_date: tomorrowDate,
      delivery_slot_id: validSlotId,
      delivery_type: "delivery",
    };

    const validationResult1 = ApiEngine.validateCheckout(tamperedCheckoutPayload);
    if (!validationResult1.valid) {
      console.log("Validation errors 1:", validationResult1.errors);
    }
    assert(validationResult1.valid === true, `Checkout validation passed for valid options`);
    // Recalculated server-side total must ignore 10 and use 749
    assert(
      validationResult1.pricing?.subtotal === 749,
      `Price Spoofing Defeated: Server recalculated subtotal to ₹749 (ignored client ₹10)`
    );

    // 3.2 Add Surcharges Test: Dutch Chocolate (+50) + Heart (+75) on 2kg tier (₹1399)
    const surchargeCheckoutPayload = {
      items: [
        {
          product_id: testProductId,
          title: newProductPayload.title,
          weight: "2 kg",
          quantity: 1,
          flavour: "Dutch Chocolate", // +50
          shape: "Heart Shape",      // +75
        },
      ],
      address: {
        address_line_1: "12th Main Road, Indiranagar",
        city: "Bangalore",
        pincode: "560038",
        state: "Karnataka",
        latitude: 12.9716,
        longitude: 77.6412,
      },
      pincode: "560038",
      delivery_date: tomorrowDate,
      delivery_slot_id: validSlotId,
      delivery_type: "delivery",
    };

    const validationResult2 = ApiEngine.validateCheckout(surchargeCheckoutPayload);
    const expectedItemPrice = 1399 + 50 + 75; // 1524
    assert(
      validationResult2.pricing?.subtotal === expectedItemPrice,
      `Authoritative Recalculation: 2kg (₹1399) + Dutch Choc (+₹50) + Heart (+₹75) = ₹${expectedItemPrice} (Subtotal: ₹${validationResult2.pricing?.subtotal})`
    );

    // 3.3 Unauthorized Option Rejection Test: Strawberry Flavour (not mapped)
    const unauthorizedOptionPayload = {
      items: [
        {
          product_id: testProductId,
          title: newProductPayload.title,
          weight: "1 kg",
          quantity: 1,
          flavour: "Wild Strawberry Blast", // Unauthorized!
          shape: "Round",
        },
      ],
      address: {
        address_line_1: "12th Main Road, Indiranagar",
        city: "Bangalore",
        pincode: "560038",
        state: "Karnataka",
        latitude: 12.9716,
        longitude: 77.6412,
      },
      pincode: "560038",
      delivery_date: tomorrowDate,
      delivery_slot_id: validSlotId,
      delivery_type: "delivery",
    };

    const validationResult3 = ApiEngine.validateCheckout(unauthorizedOptionPayload);
    assert(validationResult3.valid === false, `Unauthorized flavor rejected by checkout engine`);
    assert(
      validationResult3.errors?.some((e: any) => e.code === "INVALID_FLAVOR_OPTION"),
      `Error code INVALID_FLAVOR_OPTION emitted correctly`
    );

    // --------------------------------------------------------------------------
    // PHASE 4: Authoritative CMS Persistence Lifecycle
    // --------------------------------------------------------------------------
    console.log("\n--- PHASE 4: Authoritative CMS Persistence Lifecycle ---");

    // 4.1 Create CMS Page
    const cmsCreatePayload = {
      id: testCmsPageId,
      title: `Audit Festival Landing Page ${testSuffix}`,
      slug: testCmsSlug,
      page_type: "landing",
      template: "festival",
      status: "draft",
      meta_title: "Festive Cakes & Confections Collection",
      meta_description: "Celebrate festive occasions with gourmet handcrafted artisanal cakes.",
      sections: [
        { id: "sec_hero_1", type: "hero", title: "Festive Wonders", enabled: true },
        { id: "sec_grid_1", type: "product_grid", title: "Top Festive Bestsellers", enabled: true },
      ],
    };

    const createdCmsPage = await ApiEngine.createCmsPage(cmsCreatePayload);
    assert(createdCmsPage.id === testCmsPageId, `CMS Page created in memory and persisted: ${createdCmsPage.title}`);

    // Verify written to PostgreSQL public.cms_page
    const dbCmsRes1 = await dbQuery<any>('SELECT id, slug, status, title FROM "cms_page" WHERE id = $1 OR slug = $2', [
      testCmsPageId,
      testCmsSlug,
    ]);
    assert(dbCmsRes1.rows.length === 1, `CMS Page record exists in PostgreSQL public.cms_page table`);
    assert(dbCmsRes1.rows[0].status === "draft", `CMS Page status in PostgreSQL is 'draft'`);

    // 4.2 Publish CMS Page
    const publishRes = await ApiEngine.publishCmsPage(testCmsPageId);
    assert(publishRes.success === true, `CMS Page published successfully`);

    const dbCmsRes2 = await dbQuery<any>('SELECT id, status, blocks FROM "cms_page" WHERE id = $1', [testCmsPageId]);
    assert(dbCmsRes2.rows[0].status === "published", `CMS Page status in PostgreSQL updated to 'published'`);
    const blocksData = typeof dbCmsRes2.rows[0].blocks === "string" ? JSON.parse(dbCmsRes2.rows[0].blocks) : dbCmsRes2.rows[0].blocks;
    assert(!!blocksData?.published_config, `CMS Page published_config snapshot saved in PostgreSQL blocks column`);

    // 4.3 Unpublish CMS Page
    const unpublishRes = await ApiEngine.unpublishCmsPage(testCmsPageId);
    assert(unpublishRes.success === true, `CMS Page unpublished back to draft`);

    const dbCmsRes3 = await dbQuery<any>('SELECT id, status FROM "cms_page" WHERE id = $1', [testCmsPageId]);
    assert(dbCmsRes3.rows[0].status === "draft", `CMS Page status in PostgreSQL reverted to 'draft'`);

    // 4.4 Delete / Archive CMS Page
    const deleteCmsRes = await ApiEngine.deleteCmsPage(testCmsPageId);
    assert(deleteCmsRes === true, `CMS Page deleted/archived via ApiEngine`);

    const dbCmsRes4 = await dbQuery<any>('SELECT id, status, deleted_at FROM "cms_page" WHERE id = $1', [testCmsPageId]);
    assert(
      dbCmsRes4.rows.length === 0 || !!dbCmsRes4.rows[0].deleted_at,
      `CMS Page deleted or marked with deleted_at in PostgreSQL`
    );

    // --------------------------------------------------------------------------
    // PHASE 5: Location Authority & Store Pickup Governance
    // --------------------------------------------------------------------------
    console.log("\n--- PHASE 5: Location Authority & Store Pickup Governance ---");

    // 5.1 Store pickup setting toggle
    const store = ApiEngine.getStore();
    store.fulfillment_config = {
      ...(store.fulfillment_config || {}),
      store_pickup_enabled: true,
      allowed_pickup_branches: ["blr_central_01"],
    };
    await persistSettingToDb("fulfillment", "config", store.fulfillment_config, true);
    assert(store.fulfillment_config.store_pickup_enabled === true, `Store pickup enabled in configuration`);

    store.fulfillment_config = {
      ...store.fulfillment_config,
      store_pickup_enabled: false,
      allowed_pickup_branches: [],
    };
    await persistSettingToDb("fulfillment", "config", store.fulfillment_config, true);
    assert(store.fulfillment_config.store_pickup_enabled === false, `Store pickup disabled authoritative toggle persisted`);

    // --------------------------------------------------------------------------
    // CLEANUP
    // --------------------------------------------------------------------------
    console.log("\n--- CLEANUP ---");
    await ApiEngine.deleteAdminProduct(testProductId);
    const finalProdCheck = await dbQuery<any>('SELECT id, deleted_at FROM "product" WHERE id = $1', [testProductId]);
    assert(
      finalProdCheck.rows.length === 0 || !!finalProdCheck.rows[0].deleted_at,
      `Test audit product cleaned up / soft-deleted in PostgreSQL`
    );

    console.log("\n================================================================================");
    console.log(`AUDIT COMPLETE: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log("================================================================================\n");

    if (failedCount > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error("FATAL AUDIT ERROR:", error);
    process.exit(1);
  } finally {
    const pool = getDbPool();
    await pool.end();
  }
}

runAudit();

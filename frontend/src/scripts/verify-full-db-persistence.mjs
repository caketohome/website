/**
 * Full-Stack End-to-End Database-First Persistence Verification Suite
 * CakeToHome Production Platform
 */

import { getDbPool, dbQuery } from "../lib/db.ts";
import {
  hydrateStoreFromDatabase,
  persistProductToDb,
  persistVariantOptionToDb,
  deleteVariantOptionFromDb,
  persistOfferToDb,
  deleteOfferFromDb,
  persistPopupCampaignToDb,
  deletePopupCampaignFromDb,
  persistCustomerAddressToDb,
  deleteCustomerAddressFromDb,
  persistDeliveryPartnerToDb,
  persistSettingToDb,
  persistOrderToDb,
} from "../lib/db-persistence.ts";

async function runMasterVerification() {
  console.log("================================================================================");
  console.log("🍰 CAKETOHOME — FULL DATABASE-FIRST PERSISTENCE VERIFICATION SUITE");
  console.log("================================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, name, details = "") {
    if (condition) {
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name} — ${details}`);
      failed++;
    }
  }

  try {
    // 1. Direct PostgreSQL Connection & Pool Verification
    console.log("--- 1. Testing PostgreSQL Direct Connectivity & Pool ---");
    const testQueryRes = await dbQuery("SELECT NOW() as current_time, current_database() as db_name");
    assert(
      testQueryRes.rows.length > 0 && Boolean(testQueryRes.rows[0].current_time),
      "Direct PostgreSQL connection established via pg Pool",
      `Database: ${testQueryRes.rows[0]?.db_name}`
    );

    // 2. Hydration from Real PostgreSQL
    console.log("\n--- 2. Testing Authoritative Database Store Hydration ---");
    const testStore = {};
    const summary = await hydrateStoreFromDatabase(testStore);
    assert(summary.success === true, "hydrateStoreFromDatabase executes successfully against PostgreSQL");
    assert(Array.isArray(testStore.products) && testStore.products.length > 0, "Products hydrated directly from PostgreSQL", `Count: ${testStore.products?.length}`);
    assert(Array.isArray(testStore.branches) && testStore.branches.length > 0, "Branches hydrated directly from PostgreSQL", `Count: ${testStore.branches?.length}`);
    assert(Array.isArray(testStore.cities) && testStore.cities.length > 0, "Cities hydrated directly from PostgreSQL", `Count: ${testStore.cities?.length}`);

    // 3. Variant Option (Flavour / Shape) Direct DB CRUD
    console.log("\n--- 3. Testing Variant Option (Flavour / Shape) PostgreSQL CRUD ---");
    const testOptionId = `opt_test_${Date.now()}`;
    const testOption = {
      id: testOptionId,
      type: "flavour",
      name: "Belgian Espresso Ganache",
      display_name: "Belgian Espresso Ganache",
      price_modifier: 150,
      display_order: 99,
      status: "active",
      is_enabled: true,
    };
    await persistVariantOptionToDb(testOption);
    const dbOptRes = await dbQuery(`SELECT * FROM "variant_option" WHERE "id" = $1`, [testOptionId]);
    assert(dbOptRes.rows.length === 1 && dbOptRes.rows[0].name === testOption.name, "Variant Option successfully persisted to PostgreSQL table");

    // Soft delete variant option
    await deleteVariantOptionFromDb(testOptionId);
    const dbOptAfterDel = await dbQuery(`SELECT * FROM "variant_option" WHERE "id" = $1`, [testOptionId]);
    assert(dbOptAfterDel.rows[0]?.status === "archived" && dbOptAfterDel.rows[0]?.is_enabled === false, "Variant Option soft-deleted in PostgreSQL");

    // 4. Offer & Coupon Direct DB CRUD
    console.log("\n--- 4. Testing Promotional Offer / Coupon PostgreSQL CRUD ---");
    const testOfferId = `off_test_${Date.now()}`;
    const testOffer = {
      id: testOfferId,
      name: "Special Weekend Flash Sale",
      code: `WEEKEND${Math.floor(1000 + Math.random() * 9000)}`,
      type: "percentage",
      discount_value: 20,
      min_order: 599,
      is_active: true,
      description: "20% off on all artisan cakes",
    };
    await persistOfferToDb(testOffer);
    const dbOfferRes = await dbQuery(`SELECT * FROM "offer" WHERE "id" = $1`, [testOfferId]);
    assert(dbOfferRes.rows.length === 1 && dbOfferRes.rows[0].code === testOffer.code, "Promotional Offer successfully persisted to PostgreSQL table");

    // Soft delete offer
    await deleteOfferFromDb(testOfferId);
    const dbOfferAfterDel = await dbQuery(`SELECT * FROM "offer" WHERE "id" = $1`, [testOfferId]);
    assert(dbOfferAfterDel.rows[0]?.is_active === false, "Promotional Offer soft-deleted in PostgreSQL");

    // 5. Popup Campaign Direct DB CRUD
    console.log("\n--- 5. Testing Engagement Popup Campaign PostgreSQL CRUD ---");
    const testPopupId = `popup_test_${Date.now()}`;
    const testPopup = {
      id: testPopupId,
      name: "VIP Welcome Discount",
      slug: `vip-welcome-${Date.now()}`,
      description: "Instant ₹100 off on first cake purchase",
      popup_type: "PROMOTIONAL",
      status: "published",
      priority: 10,
      enabled: true,
      draft_version: {
        content: { title: "Welcome to CakeToHome!", subtitle: "Get ₹100 off" },
      },
      current_version: {
        content: { title: "Welcome to CakeToHome!", subtitle: "Get ₹100 off" },
      },
    };
    await persistPopupCampaignToDb(testPopup);
    const dbPopupRes = await dbQuery(`SELECT * FROM "popup_campaigns" WHERE "id" = $1`, [testPopupId]);
    assert(dbPopupRes.rows.length === 1 && dbPopupRes.rows[0].name === testPopup.name, "Popup Campaign successfully persisted to PostgreSQL table");

    // Soft delete popup campaign
    await deletePopupCampaignFromDb(testPopupId);
    const dbPopupAfterDel = await dbQuery(`SELECT * FROM "popup_campaigns" WHERE "id" = $1`, [testPopupId]);
    assert(dbPopupAfterDel.rows[0]?.status === "archived", "Popup Campaign archived in PostgreSQL");

    // 6. Customer Address Direct DB CRUD
    console.log("\n--- 6. Testing Customer Address PostgreSQL CRUD ---");
    const testAddrId = `addr_test_${Date.now()}`;
    const testCustId = `cus_test_${Date.now()}`;
    const testAddr = {
      id: testAddrId,
      customer_id: testCustId,
      first_name: "Aswin",
      last_name: "Kumar",
      address_1: "Flat 402, Signature Palms",
      address_2: "Indiranagar 100ft Road",
      city: "Bangalore",
      postal_code: "560038",
      phone: "+91 9876543210",
      type: "HOME",
      label: "Home",
      is_default: true,
    };
    await persistCustomerAddressToDb(testCustId, testAddr);
    const dbAddrRes = await dbQuery(`SELECT * FROM "customer_address" WHERE "id" = $1`, [testAddrId]);
    assert(dbAddrRes.rows.length === 1 && dbAddrRes.rows[0].address_1 === testAddr.address_1, "Customer Address successfully persisted to PostgreSQL table");

    await deleteCustomerAddressFromDb(testCustId, testAddrId);
    const dbAddrAfterDel = await dbQuery(`SELECT * FROM "customer_address" WHERE "id" = $1`, [testAddrId]);
    assert(dbAddrAfterDel.rows.length === 0, "Customer Address deleted from PostgreSQL table");

    // 7. Domain Settings Direct DB CRUD
    console.log("\n--- 7. Testing Platform & Statutory Settings PostgreSQL Persistence ---");
    const testSettingKey = `test_setting_${Date.now()}`;
    const testSettingVal = { default_delivery_fee: 49, store_pickup_enabled: true };
    await persistSettingToDb("fulfillment", testSettingKey, testSettingVal, true);
    const dbSettingRes = await dbQuery(`SELECT * FROM "setting" WHERE "group" = 'fulfillment' AND "key" = $1`, [testSettingKey]);
    assert(dbSettingRes.rows.length === 1, "Platform Setting persisted to PostgreSQL setting table");

    // Cleanup test setting
    await dbQuery(`DELETE FROM "setting" WHERE "group" = 'fulfillment' AND "key" = $1`, [testSettingKey]);

    // 8. Order Status Persistence
    console.log("\n--- 8. Testing Order Status Persistence ---");
    const testOrderId = `ord_test_${Date.now()}`;
    const testOrder = {
      id: testOrderId,
      order_number: `ORD-${Date.now().toString().slice(-6)}`,
      total: 999,
      subtotal: 950,
      delivery_fee: 49,
      status: "confirmed",
      payment_status: "paid",
      payment_method: "online",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: [
        { product_id: "prod_choco_truffle_01", title: "Signature Truffle Cake", quantity: 1, unit_price: 950, total_price: 950 }
      ],
    };
    await persistOrderToDb(testOrder);
    const dbOrderRes = await dbQuery(`SELECT * FROM "order" WHERE "id" = $1`, [testOrderId]);
    assert(dbOrderRes.rows.length === 1 && dbOrderRes.rows[0].status === "confirmed", "Order successfully persisted to PostgreSQL table");

    // Cleanup test order
    await dbQuery(`DELETE FROM "order" WHERE "id" = $1`, [testOrderId]);

  } catch (err) {
    console.error("💥 Unhandled exception during master verification:", err);
    failed++;
  }

  console.log("\n================================================================================");
  console.log(`🏁 MASTER PERSISTENCE VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runMasterVerification();

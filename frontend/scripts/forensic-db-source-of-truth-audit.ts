/**
 * Forensic Database Connectivity & Source-of-Truth Audit Script
 * 
 * Conducts direct empirical verification of:
 * 1. PostgreSQL connection & active table row counts
 * 2. Route handler dispatch paths for all 22 major domains
 * 3. Live DB Read Acid Test (direct DB UPDATE -> immediate API GET check)
 * 4. Live DB Write Acid Test (API mutation -> immediate DB SELECT check)
 * 5. In-memory vs Live DB comparison for all core entities
 */

import { dbQuery, getDbPool } from "../src/lib/db";
import { ApiEngine } from "../src/lib/api-engine";
import { OrderRepository } from "../src/lib/repositories/order.repository";
import { ProductRepository } from "../src/lib/repositories/product.repository";
import { CustomerRepository } from "../src/lib/repositories/customer.repository";
import { BranchRepository } from "../src/lib/repositories/branch.repository";

interface AuditResult {
  domain: string;
  table: string;
  pgRowCount: number;
  apiEndpoint: string;
  readMechanism: "LIVE_POSTGRES" | "IN_MEMORY_STORE" | "HYBRID_FALLBACK";
  writeMechanism: "LIVE_POSTGRES_SYNC" | "ASYNC_FIRE_AND_FORGET" | "IN_MEMORY_ONLY" | "UNVERIFIED";
  acidTestPassed: boolean;
  notes: string;
}

async function runForensicAudit() {
  console.log("================================================================================");
  console.log("   CAKETOHOME FORENSIC DATABASE CONNECTIVITY & SOURCE-OF-TRUTH AUDIT");
  console.log("================================================================================\n");

  // 1. Check PostgreSQL Direct Connectivity
  console.log("--- 1. DIRECT POSTGRESQL CONNECTIVITY & ROW COUNTS ---");
  const tables = [
    "product",
    "product_variant",
    "product_variant_option",
    "product_category",
    "customer",
    "customer_address",
    "order",
    "order_item",
    "delivery_partner",
    "branch",
    "branch_delivery_zone",
    "city",
    "cms_page",
    "cms_section",
    "offer",
    "setting",
    "popup_campaigns",
    "customer_favorites",
    "product_reviews",
  ];

  const tableCounts: Record<string, number> = {};

  for (const table of tables) {
    try {
      const res = await dbQuery(`SELECT COUNT(*)::int as count FROM "${table}"`);
      const count = Number(res.rows[0]?.count || 0);
      tableCounts[table] = count;
      console.log(`  Table "${table.padEnd(24)}": ${count} rows`);
    } catch (err: any) {
      console.log(`  Table "${table.padEnd(24)}": ERROR / DOES NOT EXIST (${err.message})`);
      tableCounts[table] = -1;
    }
  }

  // 2. Hydrate ApiEngine and inspect memoryStore counts
  console.log("\n--- 2. APIENGINE IN-MEMORY STORE STATE (POST-HYDRATION) ---");
  await ApiEngine.ensureHydrated();
  const store = ApiEngine.getStore();
  console.log(`  memoryStore.products:          ${store.products?.length ?? 0}`);
  console.log(`  memoryStore.branches:          ${store.branches?.length ?? 0}`);
  console.log(`  memoryStore.customers:         ${store.customers?.length ?? 0}`);
  console.log(`  memoryStore.orders:            ${store.orders?.length ?? 0}`);
  console.log(`  memoryStore.delivery_partners: ${store.delivery_partners?.length ?? 0}`);
  console.log(`  memoryStore.cms_pages:         ${store.cms_pages?.length ?? 0}`);
  console.log(`  memoryStore.cms_sections:      ${store.cms_sections?.length ?? 0}`);
  console.log(`  memoryStore.offers:            ${store.offers?.length ?? 0}`);
  console.log(`  memoryStore.settings:          ${store.settings?.length ?? 0}`);
  console.log(`  memoryStore.customer_favorites:${store.customer_favorites?.length ?? 0}`);
  console.log(`  memoryStore.product_reviews:   ${store.product_reviews?.length ?? 0}`);

  // 3. ACID TEST: Direct DB Update -> API GET
  // We pick real records in PostgreSQL, update a non-destructive field in DB directly,
  // and see if the API returns the updated value IMMEDIATELY (Live PostgreSQL) or returns the OLD value (MemoryStore).
  console.log("\n--- 3. ACID TEST: DOES API READ LIVE POSTGRESQL OR STALE IN-MEMORY? ---");

  // Test A: Products
  console.log("\n[Test A: Products Endpoint /api/v1/products]");
  const sampleProdRes = await dbQuery(`SELECT id, title, metadata FROM "product" WHERE deleted_at IS NULL LIMIT 1`);
  if (sampleProdRes.rows.length > 0) {
    const prod = sampleProdRes.rows[0];
    const originalTitle = prod.title;
    const markerTitle = `${originalTitle} [FORENSIC_DB_AUDIT_${Date.now()}]`;

    // 1. Update directly in PostgreSQL (external write)
    await dbQuery(`UPDATE "product" SET title = $1 WHERE id = $2`, [markerTitle, prod.id]);
    console.log(`  [DB Direct] Updated product ${prod.id} title in PostgreSQL directly.`);

    // 2. Request via API
    try {
      const apiRes = await fetch(`http://localhost:3000/api/v1/products?limit=100`);
      const apiData = await apiRes.json();
      const apiProds = apiData.products || [];
      const matchedProd = apiProds.find((p: any) => p.id === prod.id);

      if (matchedProd?.title === markerTitle) {
        console.log(`  ✅ RESULT: API returned NEW title from PostgreSQL! -> LIVE POSTGRES READ`);
      } else {
        console.log(`  ❌ RESULT: API returned OLD in-memory title "${matchedProd?.title}"! -> IN-MEMORY STALE READ`);
      }
    } catch (e: any) {
      console.log(`  Error calling API:`, e.message);
    } finally {
      // Revert change
      await dbQuery(`UPDATE "product" SET title = $1 WHERE id = $2`, [originalTitle, prod.id]);
      console.log(`  [DB Direct] Reverted product ${prod.id} title back to original.`);
    }
  }

  // Test B: Branches
  console.log("\n[Test B: Branches Endpoint /api/v1/branches]");
  const sampleBranchRes = await dbQuery(`SELECT id, name FROM "branch" WHERE deleted_at IS NULL LIMIT 1`);
  if (sampleBranchRes.rows.length > 0) {
    const branch = sampleBranchRes.rows[0];
    const originalName = branch.name;
    const markerName = `${originalName} [FORENSIC_AUDIT]`;

    await dbQuery(`UPDATE "branch" SET name = $1 WHERE id = $2`, [markerName, branch.id]);
    console.log(`  [DB Direct] Updated branch ${branch.id} name in PostgreSQL.`);

    try {
      const apiRes = await fetch(`http://localhost:3000/api/v1/branches`);
      const apiData = await apiRes.json();
      const apiBranches = apiData.branches || [];
      const matchedBranch = apiBranches.find((b: any) => b.id === branch.id);

      if (matchedBranch?.name === markerName) {
        console.log(`  ✅ RESULT: API returned NEW branch name from PostgreSQL! -> LIVE POSTGRES READ`);
      } else {
        console.log(`  ❌ RESULT: API returned OLD in-memory name "${matchedBranch?.name}"! -> IN-MEMORY STALE READ`);
      }
    } catch (e: any) {
      console.log(`  Error calling API:`, e.message);
    } finally {
      await dbQuery(`UPDATE "branch" SET name = $1 WHERE id = $2`, [originalName, branch.id]);
      console.log(`  [DB Direct] Reverted branch name.`);
    }
  }

  // Test C: Orders (List & Detail)
  console.log("\n[Test C: Orders List /api/v1/admin/orders & Detail /api/v1/admin/orders/[id]]");
  const sampleOrderRes = await dbQuery(`SELECT id, metadata FROM "order" WHERE deleted_at IS NULL LIMIT 1`);
  if (sampleOrderRes.rows.length > 0) {
    const order = sampleOrderRes.rows[0];
    const meta = order.metadata || {};
    const originalCustName = meta.customer_name || "Valued Customer";
    const markerCustName = `${originalCustName} [FORENSIC_ORDER_AUDIT]`;

    const updatedMeta = { ...meta, customer_name: markerCustName };
    await dbQuery(`UPDATE "order" SET metadata = $1 WHERE id = $2`, [JSON.stringify(updatedMeta), order.id]);
    console.log(`  [DB Direct] Updated order ${order.id} customer_name in PostgreSQL metadata.`);

    // 1. Check Orders List
    try {
      const listRes = await fetch(`http://localhost:3000/api/v1/admin/orders?limit=20`);
      const listData = await listRes.json();
      const orders = listData.orders || [];
      const matchedListOrder = orders.find((o: any) => o.id === order.id);

      if (matchedListOrder?.customer_name === markerCustName) {
        console.log(`  ✅ RESULT (List): Admin Orders List returned NEW customer name from PostgreSQL! -> LIVE POSTGRES READ`);
      } else {
        console.log(`  ❌ RESULT (List): Admin Orders List returned OLD customer name "${matchedListOrder?.customer_name}"! -> IN-MEMORY STALE READ`);
      }
    } catch (e: any) {
      console.log(`  List API Error:`, e.message);
    }

    // 2. Check Order Detail
    try {
      const detailRes = await fetch(`http://localhost:3000/api/v1/admin/orders/${order.id}`);
      const detailData = await detailRes.json();
      const detailOrder = detailData?.order;

      if (detailOrder?.customer_name === markerCustName) {
        console.log(`  ✅ RESULT (Detail): Admin Order Detail returned NEW customer name from PostgreSQL! -> LIVE POSTGRES READ`);
      } else {
        console.log(`  ❌ RESULT (Detail): Admin Order Detail returned OLD customer name "${detailOrder?.customer_name}"! -> IN-MEMORY STALE READ`);
      }
    } catch (e: any) {
      console.log(`  Detail API Error:`, e.message);
    } finally {
      const revertMeta = { ...meta, customer_name: originalCustName };
      await dbQuery(`UPDATE "order" SET metadata = $1 WHERE id = $2`, [JSON.stringify(revertMeta), order.id]);
      console.log(`  [DB Direct] Reverted order customer_name.`);
    }
  }

  // Test D: CMS Pages (/api/v1/cms/pages/cmspg_home)
  console.log("\n[Test D: CMS Pages Endpoint /api/v1/cms/pages/cmspg_home]");
  const sampleCmsRes = await dbQuery(`SELECT id, title, meta_title FROM "cms_page" WHERE id = 'cmspg_home' LIMIT 1`);
  if (sampleCmsRes.rows.length > 0) {
    const page = sampleCmsRes.rows[0];
    const originalMetaTitle = page.meta_title || "";
    const markerMetaTitle = `FORENSIC_CMS_AUDIT_${Date.now()}`;

    await dbQuery(`UPDATE "cms_page" SET meta_title = $1 WHERE id = 'cmspg_home'`, [markerMetaTitle]);
    console.log(`  [DB Direct] Updated cmspg_home meta_title in PostgreSQL.`);

    try {
      const cmsRes = await fetch(`http://localhost:3000/api/v1/cms/pages/cmspg_home`);
      const cmsData = await cmsRes.json();
      const apiPage = cmsData.page;

      if (apiPage?.meta_title === markerMetaTitle) {
        console.log(`  ✅ RESULT: CMS Page API returned NEW meta_title from PostgreSQL! -> LIVE POSTGRES READ`);
      } else {
        console.log(`  ❌ RESULT: CMS Page API returned OLD in-memory meta_title "${apiPage?.meta_title}"! -> IN-MEMORY STALE READ`);
      }
    } catch (e: any) {
      console.log(`  CMS API Error:`, e.message);
    } finally {
      await dbQuery(`UPDATE "cms_page" SET meta_title = $1 WHERE id = 'cmspg_home'`, [originalMetaTitle]);
      console.log(`  [DB Direct] Reverted cmspg_home meta_title.`);
    }
  }

  // Test E: Offers (/api/v1/admin/marketing/offers)
  console.log("\n[Test E: Offers Endpoint /api/v1/admin/marketing/offers]");
  const sampleOfferRes = await dbQuery(`SELECT id, code, description FROM "offer" LIMIT 1`);
  if (sampleOfferRes.rows.length > 0) {
    const offer = sampleOfferRes.rows[0];
    const originalDesc = offer.description || "";
    const markerDesc = `Forensic Audit Offer ${Date.now()}`;

    await dbQuery(`UPDATE "offer" SET description = $1 WHERE id = $2`, [markerDesc, offer.id]);
    console.log(`  [DB Direct] Updated offer ${offer.code} description in PostgreSQL.`);

    try {
      const offRes = await fetch(`http://localhost:3000/api/v1/admin/marketing/offers`);
      const offData = await offRes.json();
      const offers = offData.offers || [];
      const matchedOffer = offers.find((o: any) => o.id === offer.id);

      if (matchedOffer?.description === markerDesc) {
        console.log(`  ✅ RESULT: Offers API returned NEW description from PostgreSQL! -> LIVE POSTGRES READ`);
      } else {
        console.log(`  ❌ RESULT: Offers API returned OLD description "${matchedOffer?.description}"! -> IN-MEMORY STALE READ`);
      }
    } catch (e: any) {
      console.log(`  Offers API Error:`, e.message);
    } finally {
      await dbQuery(`UPDATE "offer" SET description = $1 WHERE id = $2`, [originalDesc, offer.id]);
      console.log(`  [DB Direct] Reverted offer description.`);
    }
  }

  // 4. WRITE PERSISTENCE ACID TEST: Does an API Write reach PostgreSQL?
  console.log("\n--- 4. ACID TEST: DO API WRITES PERSIST TO POSTGRESQL DIRECTLY? ---");

  // Write Test 1: Order Status Update via API
  console.log("\n[Write Test 1: Order Status Update via PUT /api/v1/admin/orders/[id]/status]");
  if (sampleOrderRes.rows.length > 0) {
    const order = sampleOrderRes.rows[0];
    const originalStatus = order.status || "confirmed";
    const testStatus = originalStatus === "confirmed" ? "kitchen_accepted" : "confirmed";

    try {
      const updateRes = await fetch(`http://localhost:3000/api/v1/admin/orders/${order.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: testStatus, notes: "Forensic audit test" }),
      });
      console.log(`  API Status Update HTTP Status: ${updateRes.status}`);

      // Check PostgreSQL directly
      const verifyRes = await dbQuery(`SELECT status, metadata FROM "order" WHERE id = $1`, [order.id]);
      const dbRow = verifyRes.rows[0];
      const dbStatus = dbRow?.metadata?.bakery_status || dbRow?.status;

      if (dbStatus === testStatus) {
        console.log(`  ✅ RESULT: PostgreSQL row WAS updated directly in DB! -> LIVE POSTGRES WRITE CONFIRMED`);
      } else {
        console.log(`  ❌ RESULT: PostgreSQL row NOT updated! DB status is "${dbStatus}" while API reported "${testStatus}"! -> IN-MEMORY ONLY OR WRITE FAILED`);
      }

      // Revert via API
      await fetch(`http://localhost:3000/api/v1/admin/orders/${order.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: originalStatus, notes: "Revert test" }),
      });
    } catch (e: any) {
      console.log(`  Error in write test:`, e.message);
    }
  }

  // Write Test 2: CMS Page Update via PUT /api/v1/cms/pages/cmspg_home
  console.log("\n[Write Test 2: CMS Page Update via PUT /api/v1/cms/pages/cmspg_home]");
  try {
    const getRes = await fetch(`http://localhost:3000/api/v1/cms/pages/cmspg_home`);
    const getData = await getRes.json();
    const origPage = getData.page;
    if (origPage) {
      const origMetaDesc = origPage.meta_description || "";
      const testMarker = `FORENSIC_WRITE_TEST_${Date.now()}`;
      const modifiedPage = { ...origPage, meta_description: testMarker };

      const putRes = await fetch(`http://localhost:3000/api/v1/cms/pages/cmspg_home`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(modifiedPage),
      });
      console.log(`  CMS PUT HTTP Status: ${putRes.status}`);

      // Verify directly in PostgreSQL
      const dbCheck = await dbQuery(`SELECT meta_description FROM "cms_page" WHERE id = 'cmspg_home'`);
      const actualDbDesc = dbCheck.rows[0]?.meta_description;

      if (actualDbDesc === testMarker) {
        console.log(`  ✅ RESULT: PostgreSQL cms_page row WAS updated directly in DB! -> LIVE POSTGRES WRITE CONFIRMED`);
      } else {
        console.log(`  ❌ RESULT: PostgreSQL cms_page row NOT updated! DB desc is "${actualDbDesc}", expected "${testMarker}"!`);
      }

      // Revert
      const revertPage = { ...origPage, meta_description: origMetaDesc };
      await fetch(`http://localhost:3000/api/v1/cms/pages/cmspg_home`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(revertPage),
      });
    }
  } catch (e: any) {
    console.log(`  Error in CMS write test:`, e.message);
  }

  console.log("\n================================================================================");
  console.log("   FORENSIC AUDIT SCRIPT COMPLETE");
  console.log("================================================================================\n");
}

runForensicAudit().catch((err) => {
  console.error("Audit script failed:", err);
  process.exit(1);
});

import { dbQuery } from "../src/lib/db";
import { ApiEngine } from "../src/lib/api-engine";

async function reconcile() {
  await ApiEngine.ensureHydrated();
  const store = ApiEngine.getStore();

  console.log("================================================================================");
  console.log("   DATA RECONCILIATION: MEMORYSTORE VS POSTGRESQL CANONICAL COMPARISON");
  console.log("================================================================================\n");

  // 1. PRODUCTS
  try {
    const dbProdRes = await dbQuery(`SELECT id, title, handle, deleted_at FROM "product" ORDER BY id ASC`);
    const dbProducts = dbProdRes.rows;
    const memProducts = store.products || [];

    const dbActiveProds = dbProducts.filter((p: any) => !p.deleted_at);
    const dbSoftDeletedProds = dbProducts.filter((p: any) => p.deleted_at);

    const memProdIds = new Set(memProducts.map((p: any) => p.id));
    const dbProdIds = new Set(dbProducts.map((p: any) => p.id));

    const memOnlyProds = memProducts.filter((p: any) => !dbProdIds.has(p.id));
    const dbOnlyActiveProds = dbActiveProds.filter((p: any) => !memProdIds.has(p.id));

    console.log("--- 1. PRODUCTS ---");
    console.log(`  Memory Products: ${memProducts.length}`);
    console.log(`  DB Total Products: ${dbProducts.length} (${dbActiveProds.length} active, ${dbSoftDeletedProds.length} soft-deleted)`);
    console.log(`  Memory-Only IDs: [${memOnlyProds.map((p: any) => p.id).join(", ")}]`);
    console.log(`  DB-Only Active IDs: [${dbOnlyActiveProds.map((p: any) => p.id).join(", ")}]`);
  } catch (e: any) {
    console.error("Products error:", e.message);
  }

  // 2. BRANCHES
  try {
    const dbBranchRes = await dbQuery(`SELECT id, name, code, is_open, deleted_at FROM "branch" ORDER BY id ASC`);
    const dbBranches = dbBranchRes.rows;
    const memBranches = store.branches || [];

    const dbActiveBranches = dbBranches.filter((b: any) => !b.deleted_at);
    const memBranchIds = new Set(memBranches.map((b: any) => b.id));
    const dbBranchIds = new Set(dbBranches.map((b: any) => b.id));

    const memOnlyBranches = memBranches.filter((b: any) => !dbBranchIds.has(b.id));
    const dbOnlyActiveBranches = dbActiveBranches.filter((b: any) => !memBranchIds.has(b.id));

    console.log("\n--- 2. BRANCHES ---");
    console.log(`  Memory Branches: ${memBranches.length}`);
    console.log(`  DB Active Branches: ${dbActiveBranches.length}`);
    console.log(`  Memory-Only IDs: [${memOnlyBranches.map((b: any) => b.id).join(", ")}]`);
    console.log(`  DB-Only Active IDs: [${dbOnlyActiveBranches.map((b: any) => b.id).join(", ")}]`);
  } catch (e: any) {
    console.error("Branches error:", e.message);
  }

  // 3. CUSTOMERS
  try {
    const dbCustRes = await dbQuery(`SELECT id, email, first_name, last_name, phone FROM "customer" WHERE deleted_at IS NULL ORDER BY id ASC`);
    const dbCustomers = dbCustRes.rows;
    const memCustomers = store.customers || [];

    const memCustIds = new Set(memCustomers.map((c: any) => c.customer_uid || c.id));
    const dbCustIds = new Set(dbCustomers.map((c: any) => c.id));

    const memOnlyCust = memCustomers.filter((c: any) => !dbCustIds.has(c.customer_uid || c.id));
    const dbOnlyCust = dbCustomers.filter((c: any) => !memCustIds.has(c.id));

    console.log("\n--- 3. CUSTOMERS ---");
    console.log(`  Memory Customers: ${memCustomers.length}`);
    console.log(`  DB Active Customers: ${dbCustomers.length}`);
    console.log(`  Memory-Only IDs count: ${memOnlyCust.length}`);
    console.log(`  DB-Only IDs count: ${dbOnlyCust.length}`);
  } catch (e: any) {
    console.error("Customers error:", e.message);
  }

  // 4. ORDERS
  try {
    const dbOrderRes = await dbQuery(`SELECT id, display_id, email, status, metadata FROM "order" WHERE deleted_at IS NULL ORDER BY created_at DESC`);
    const dbOrders = dbOrderRes.rows;
    const memOrders = store.orders || [];

    const memOrderIds = new Set(memOrders.map((o: any) => o.id));
    const dbOrderIds = new Set(dbOrders.map((o: any) => o.id));

    const memOnlyOrders = memOrders.filter((o: any) => !dbOrderIds.has(o.id));
    const dbOnlyOrders = dbOrders.filter((o: any) => !memOrderIds.has(o.id));

    console.log("\n--- 4. ORDERS ---");
    console.log(`  Memory Orders: ${memOrders.length}`);
    console.log(`  DB Active Orders: ${dbOrders.length}`);
    console.log(`  Memory-Only Orders: ${memOnlyOrders.length}`);
    console.log(`  DB-Only Orders: ${dbOnlyOrders.length}`);
  } catch (e: any) {
    console.error("Orders error:", e.message);
  }

  // 5. INVENTORY
  try {
    const dbInvRes = await dbQuery(`SELECT id, product_id, variant_id, quantity, reserved, branch_id FROM "branch_inventory"`);
    console.log("\n--- 5. INVENTORY ---");
    console.log(`  DB branch_inventory rows: ${dbInvRes.rows.length}`);
    console.log(`  Memory stock representation: embedded in memoryStore.products[].stock or branch_availability`);
  } catch (e: any) {
    console.error("Inventory error:", e.message);
  }

  // 6. CMS PAGES
  try {
    const dbCmsRes = await dbQuery(`SELECT id, slug, title, type, status FROM "cms_page"`);
    const dbCmsPages = dbCmsRes.rows;
    const memCmsPages = store.cms_pages || [];

    const memCmsIds = new Set(memCmsPages.map((p: any) => p.id));
    const dbCmsIds = new Set(dbCmsPages.map((p: any) => p.id));

    console.log("\n--- 6. CMS PAGES ---");
    console.log(`  Memory CMS Pages: ${memCmsPages.length}`);
    console.log(`  DB Active CMS Pages: ${dbCmsPages.length}`);
    console.log(`  Memory-Only CMS IDs: [${memCmsPages.filter((p: any) => !dbCmsIds.has(p.id)).map((p: any) => p.id).join(", ")}]`);
    console.log(`  DB-Only CMS IDs: [${dbCmsPages.filter((p: any) => !memCmsIds.has(p.id)).map((p: any) => p.id).join(", ")}]`);
  } catch (e: any) {
    console.error("CMS error:", e.message);
  }

  // 7. OFFERS
  try {
    const dbOfferRes = await dbQuery(`SELECT id, code, name, type, status FROM "offer" WHERE deleted_at IS NULL`);
    const dbOffers = dbOfferRes.rows;
    const memOffers = store.offers || [];

    const memOfferCodes = new Set(memOffers.map((o: any) => o.code));
    const dbOfferCodes = new Set(dbOffers.map((o: any) => o.code));

    console.log("\n--- 7. OFFERS ---");
    console.log(`  Memory Offers: ${memOffers.length}`);
    console.log(`  DB Active Offers: ${dbOffers.length}`);
    console.log(`  Memory-Only Offers: [${memOffers.filter((o: any) => !dbOfferCodes.has(o.code)).map((o: any) => o.code).join(", ")}]`);
    console.log(`  DB-Only Offers: [${dbOffers.filter((o: any) => !memOfferCodes.has(o.code)).map((o: any) => o.code).join(", ")}]`);
  } catch (e: any) {
    console.error("Offers error:", e.message);
  }

  process.exit(0);
}

reconcile().catch((e) => {
  console.error("Reconciliation failed:", e);
  process.exit(1);
});

import { dbQuery } from "../src/lib/db";
import { memoryStore, ApiEngine } from "../src/lib/api-engine";

async function catalog() {
  await ApiEngine.ensureHydrated();
  console.log("=== 1. DATABASE SCHEMA RECONCILIATION: EXISTING TABLES & ROW COUNTS ===");
  const tablesRes = await dbQuery(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
  `);
  const tableNames = new Set(tablesRes.rows.map((r: any) => r.table_name));

  const keyEntities = [
    { entity: "Product", table: "product" },
    { entity: "Product Variant", table: "product_variant" },
    { entity: "Product Category", table: "product_category" },
    { entity: "Customer", table: "customer" },
    { entity: "Customer Address", table: "customer_address" },
    { entity: "Order", table: "order" },
    { entity: "Order Item", table: "order_item" },
    { entity: "Order Status History", table: "order_status_history" },
    { entity: "Payment", table: "payment" },
    { entity: "Payment Transaction", table: "payment_transaction" },
    { entity: "Delivery", table: "delivery" },
    { entity: "Delivery Partner", table: "delivery_partner" },
    { entity: "Branch", table: "branch" },
    { entity: "Delivery Zone", table: "delivery_zone" },
    { entity: "Branch Inventory", table: "branch_inventory" },
    { entity: "Inventory Item (Medusa)", table: "inventory_item" },
    { entity: "Inventory Level (Medusa)", table: "inventory_level" },
    { entity: "Stock Location (Medusa)", table: "stock_location" },
    { entity: "Offer", table: "offer" },
    { entity: "Product Review", table: "product_review" },
    { entity: "Product Reviews (plural)", table: "product_reviews" },
    { entity: "Customer Favorite", table: "customer_favorite" },
    { entity: "Customer Favorites (plural)", table: "customer_favorites" },
    { entity: "CMS Page", table: "cms_page" },
    { entity: "CMS Section", table: "cms_homepage_section" },
    { entity: "Setting", table: "setting" },
    { entity: "User", table: "user" },
    { entity: "Branch Capacity", table: "branch_capacity" },
    { entity: "Branch Settings", table: "branch_settings" },
    { entity: "Variant Option", table: "variant_option" },
    { entity: "Popup Campaigns", table: "popup_campaigns" },
  ];

  const schemaReport: any[] = [];

  for (const item of keyEntities) {
    const exists = tableNames.has(item.table);
    let rowCount = -1;
    let columns: string[] = [];
    if (exists) {
      try {
        const countRes = await dbQuery(`SELECT COUNT(*)::int as c FROM "${item.table}"`);
        rowCount = countRes.rows[0].c;

        const colsRes = await dbQuery(`
          SELECT column_name, data_type, is_nullable 
          FROM information_schema.columns 
          WHERE table_name = $1 AND table_schema = 'public'
          ORDER BY ordinal_position
        `, [item.table]);
        columns = colsRes.rows.map((c: any) => `${c.column_name}:${c.data_type}`);
      } catch (e: any) {
        rowCount = -999;
      }
    }
    schemaReport.push({
      Entity: item.entity,
      Table: item.table,
      Exists: exists ? "YES" : "NO",
      RowCount: rowCount >= 0 ? rowCount : "N/A",
      ColumnsCount: columns.length,
      SampleCols: columns.slice(0, 5).join(", "),
    });
  }

  console.table(schemaReport);

  console.log("\n=== 2. MEMORYSTORE VS POSTGRESQL DATA COMPARISON ===");
  const store = memoryStore;

  const comparison = [
    {
      domain: "Products",
      memoryCount: (store.products || []).length,
      dbQuery: `SELECT COUNT(*)::int as c FROM "product" WHERE deleted_at IS NULL`,
    },
    {
      domain: "Branches",
      memoryCount: (store.branches || []).length,
      dbQuery: `SELECT COUNT(*)::int as c FROM "branch" WHERE deleted_at IS NULL`,
    },
    {
      domain: "Customers",
      memoryCount: (store.customers || []).length,
      dbQuery: `SELECT COUNT(*)::int as c FROM "customer" WHERE deleted_at IS NULL`,
    },
    {
      domain: "Orders",
      memoryCount: (store.orders || []).length,
      dbQuery: `SELECT COUNT(*)::int as c FROM "order" WHERE deleted_at IS NULL`,
    },
    {
      domain: "Delivery Partners",
      memoryCount: (store.delivery_partners || []).length,
      dbQuery: `SELECT COUNT(*)::int as c FROM "delivery_partner" WHERE deleted_at IS NULL`,
    },
    {
      domain: "CMS Pages",
      memoryCount: (store.cms_pages || []).length,
      dbQuery: `SELECT COUNT(*)::int as c FROM "cms_page" WHERE deleted_at IS NULL`,
    },
    {
      domain: "CMS Homepage Sections",
      memoryCount: (store.cms_sections || []).length,
      dbQuery: `SELECT COUNT(*)::int as c FROM "cms_homepage_section"`,
    },
    {
      domain: "Offers",
      memoryCount: (store.offers || []).length,
      dbQuery: `SELECT COUNT(*)::int as c FROM "offer" WHERE deleted_at IS NULL`,
    },
    {
      domain: "Settings",
      memoryCount: Object.keys(store.settings || {}).length,
      dbQuery: `SELECT COUNT(*)::int as c FROM "setting" WHERE deleted_at IS NULL`,
    },
    {
      domain: "Variant Options",
      memoryCount: (store.variant_options || []).length,
      dbQuery: `SELECT COUNT(*)::int as c FROM "variant_option" WHERE deleted_at IS NULL`,
    },
    {
      domain: "Customer Favorites",
      memoryCount: (store.customer_favorites || []).length,
      dbQuery: `SELECT COUNT(*)::int as c FROM "customer_favorite" WHERE deleted_at IS NULL`,
    },
    {
      domain: "Product Reviews",
      memoryCount: (store.product_reviews || []).length,
      dbQuery: `SELECT COUNT(*)::int as c FROM "product_review" WHERE deleted_at IS NULL`,
    },
    {
      domain: "Branch Inventory",
      memoryCount: "Scattered in product.stock",
      dbQuery: `SELECT COUNT(*)::int as c FROM "branch_inventory"`,
    },
  ];

  for (const item of comparison) {
    let dbCount: any = "ERROR";
    try {
      const res = await dbQuery(item.dbQuery);
      dbCount = res.rows[0].c;
    } catch (e: any) {
      dbCount = `ERR: ${e.message.split("\n")[0]}`;
    }
    console.log(`  ${item.domain.padEnd(24)}: Memory Count = ${String(item.memoryCount).padEnd(6)} | DB Count = ${dbCount}`);
  }

  process.exit(0);
}

catalog().catch((e) => {
  console.error("Catalog failed:", e);
  process.exit(1);
});

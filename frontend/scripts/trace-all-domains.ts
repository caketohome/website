import { dbQuery } from "../src/lib/db";
import { memoryStore } from "../src/lib/api-engine";

interface DomainCheck {
  domain: string;
  tableName: string;
  apiGetRoute: string;
  apiMutateRoute: string;
  dbRowCount?: number;
  memoryCount?: number;
  readMechanism: string;
  writeMechanism: string;
  inMemoryInvolved: boolean;
  cacheOrFallback: string;
  productionSafe: boolean;
  notes: string;
}

async function runDomainTrace() {
  console.log("================================================================================");
  console.log("   TRACE ALL 22 BUSINESS DOMAINS — POSTGRESQL VS IN-MEMORY AUDIT");
  console.log("================================================================================\n");

  const results: Record<string, any> = {};

  // 1. Check DB tables existence & row count
  const tables = [
    "product",
    "product_variant",
    "product_category",
    "customer",
    "customer_address",
    "order",
    "order_item",
    "order_status_history",
    "payment",
    "payment_transaction",
    "delivery",
    "delivery_partner",
    "branch",
    "delivery_zone",
    "branch_inventory",
    "offer",
    "product_reviews",
    "customer_favorites",
    "cms_page",
    "user",
    "setting",
  ];

  const dbCounts: Record<string, number | string> = {};
  for (const t of tables) {
    try {
      const r = await dbQuery(`SELECT COUNT(*)::int as count FROM "${t}"`);
      dbCounts[t] = r.rows[0].count;
    } catch (e: any) {
      dbCounts[t] = `ERROR: ${e.message.split("\n")[0]}`;
    }
  }

  console.log("PostgreSQL Table Row Counts:");
  console.table(dbCounts);

  // 2. Test API read endpoints for response & data source
  const apiEndpoints = [
    { domain: "products", url: "http://localhost:3000/api/v1/products" },
    { domain: "admin products", url: "http://localhost:3000/api/v1/admin/products" },
    { domain: "product variants", url: "http://localhost:3000/api/v1/admin/catalog/variant-options" },
    { domain: "categories", url: "http://localhost:3000/api/v1/categories" },
    { domain: "customers", url: "http://localhost:3000/api/v1/admin/crm/customers" },
    { domain: "addresses", url: "http://localhost:3000/api/v1/customers/addresses" },
    { domain: "orders (store)", url: "http://localhost:3000/api/v1/orders" },
    { domain: "orders (admin list)", url: "http://localhost:3000/api/v1/admin/orders" },
    { domain: "deliveries", url: "http://localhost:3000/api/v1/admin/delivery/jobs" },
    { domain: "delivery partners", url: "http://localhost:3000/api/v1/admin/delivery/partners" },
    { domain: "branches", url: "http://localhost:3000/api/v1/branches" },
    { domain: "admin branches", url: "http://localhost:3000/api/v1/admin/branches" },
    { domain: "delivery zones", url: "http://localhost:3000/api/v1/branches/delivery-zones" },
    { domain: "inventory", url: "http://localhost:3000/api/v1/admin/inventory" },
    { domain: "offers", url: "http://localhost:3000/api/v1/admin/marketing/offers" },
    { domain: "reviews", url: "http://localhost:3000/api/v1/admin/reviews" },
    { domain: "favorites", url: "http://localhost:3000/api/v1/customer/favorites" },
    { domain: "cms pages", url: "http://localhost:3000/api/v1/cms/pages" },
    { domain: "homepage cms", url: "http://localhost:3000/api/v1/cms/pages/cmspg_home" },
    { domain: "users/admin", url: "http://localhost:3000/api/v1/admin/staff" },
    { domain: "settings", url: "http://localhost:3000/api/v1/admin/settings" },
  ];

  console.log("\nTesting API Endpoints:");
  for (const ep of apiEndpoints) {
    try {
      const res = await fetch(ep.url, { headers: { "Cookie": "_cth_role=SUPER_ADMIN;_cth_user_id=admin_01" } });
      const xds = res.headers.get("x-data-source");
      const xfb = res.headers.get("x-fallback");
      const data = await res.json().catch(() => ({}));
      const keys = Object.keys(data);
      const count = Array.isArray(data[keys[0]]) ? data[keys[0]].length : (data.total || data.count || "object/status");
      console.log(`  ${ep.domain.padEnd(22)}: HTTP ${res.status} | X-Data-Source: ${xds || "none"} | X-Fallback: ${xfb || "none"} | Items/Count: ${count}`);
    } catch (e: any) {
      console.log(`  ${ep.domain.padEnd(22)}: ERROR: ${e.message}`);
    }
  }

  process.exit(0);
}

runDomainTrace().catch((e) => {
  console.error("Domain trace failed:", e);
  process.exit(1);
});

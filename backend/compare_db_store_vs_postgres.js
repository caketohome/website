const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: "./.env" });

async function compare() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const dbStoreRaw = JSON.parse(fs.readFileSync(path.join(__dirname, "../frontend/data/db-store.json"), "utf-8"));

  console.log("================================================================================");
  console.log("📊 COMPARISON: db-store.json VS POSTGRESQL DATABASE");
  console.log("================================================================================");

  const mappings = [
    { entity: "Branches", jsonKey: "branches", table: "branch" },
    { entity: "Cities", jsonKey: "cities", table: "city" },
    { entity: "Delivery Zones", jsonKey: "branches.zones", table: "delivery_zone" },
    { entity: "Products", jsonKey: "products", table: "product" },
    { entity: "Categories", jsonKey: "pim_categories", table: "product_category" },
    { entity: "Customers", jsonKey: "customers", table: "customer" },
    { entity: "Delivery Partners", jsonKey: "delivery_partners", table: "delivery_partner" },
    { entity: "Orders", jsonKey: "orders", table: "order" },
    { entity: "CMS Pages", jsonKey: "cms_pages", table: "cms_page" },
    { entity: "Offers", jsonKey: "offers", table: "offer" },
    { entity: "Media Assets", jsonKey: "media", table: "media" },
    { entity: "Settings", jsonKey: "settings", table: "setting" },
    { entity: "Popup Campaigns", jsonKey: "popup_campaigns", table: "popup_campaigns" },
    { entity: "Product Reviews", jsonKey: "product_reviews", table: "product_reviews" }
  ];

  for (const m of mappings) {
    let jsonCount = 0;
    if (m.jsonKey === "branches.zones") {
      (dbStoreRaw.branches || []).forEach(b => {
        jsonCount += (b.delivery_zones || []).length;
      });
    } else if (m.jsonKey === "settings") {
      jsonCount = Object.keys(dbStoreRaw.settings || {}).length;
    } else {
      jsonCount = Array.isArray(dbStoreRaw[m.jsonKey]) ? dbStoreRaw[m.jsonKey].length : (dbStoreRaw[m.jsonKey] ? 1 : 0);
    }

    const res = await client.query(`SELECT COUNT(*) FROM "${m.table}" WHERE deleted_at IS NULL`);
    const dbCount = parseInt(res.rows[0].count, 10);

    const match = jsonCount === dbCount ? "✅ MATCH" : (dbCount > 0 ? "⚠️ PARTIAL / DIFF" : "❌ EMPTY IN DB");
    console.log(`- ${m.entity.padEnd(20)}: JSON = ${String(jsonCount).padStart(3)} | DB = ${String(dbCount).padStart(3)} | ${match}`);
  }

  await client.end();
}

compare().catch(console.error);

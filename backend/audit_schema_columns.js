const { Client } = require("pg");
require("dotenv").config({ path: "./.env" });

const connectionString = process.env.DATABASE_URL;

async function checkColumns() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const targetTables = [
    "product",
    "product_variant",
    "product_option",
    "product_category",
    "branch",
    "delivery_zone",
    "city",
    "delivery_partner",
    "customer",
    "customer_address",
    "order",
    "cms_page",
    "cms_homepage_section",
    "setting",
    "media",
    "offer",
    "product_reviews",
    "wishlist_item",
    "popup_campaigns",
    "popup_versions"
  ];

  console.log("=== POSTGRESQL SCHEMA AUDIT FOR KEY ENTITIES ===");
  for (const table of targetTables) {
    const res = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = $1 AND table_schema = 'public'
      ORDER BY ordinal_position;
    `, [table]);

    if (res.rows.length === 0) {
      console.log(`\n❌ Table '${table}' NOT FOUND in public schema.`);
    } else {
      console.log(`\n📋 Table '${table}' (${res.rows.length} columns):`);
      res.rows.forEach(r => {
        console.log(`   - ${r.column_name}: ${r.data_type} (nullable: ${r.is_nullable})`);
      });
    }
  }

  await client.end();
}

checkColumns().catch(console.error);

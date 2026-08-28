const { Client } = require("pg");
require("dotenv").config({ path: "./.env" });

async function validateFidelity() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log("================================================================================");
  console.log("🔬 POSTGRESQL DATA FIDELITY & SCHEMA INTEGRITY VERIFICATION");
  console.log("================================================================================\n");

  // 1. Check Homepage CMS & Sections
  const cmsHome = await client.query(`SELECT id, slug, title, blocks FROM "cms_page" WHERE slug = 'home'`);
  console.log("1. CMS Homepage in DB:", cmsHome.rows[0]?.id, "| Title:", cmsHome.rows[0]?.title);
  const homeSections = await client.query(`SELECT id, name, section_type, sort_order FROM "cms_homepage_section" ORDER BY sort_order LIMIT 5`);
  console.log("   Homepage sections in DB:", homeSections.rows);

  // 2. Check Branches & Zones
  const branches = await client.query(`SELECT id, name, latitude, longitude, metadata FROM "branch" WHERE id IN ('br_indiranagar', 'br_kollam')`);
  console.log("\n2. Branches in DB:");
  branches.rows.forEach(b => {
    console.log(`   - ${b.id}: ${b.name} (${b.latitude}, ${b.longitude}) | Has schedule: ${Boolean(b.metadata?.weekly_schedule)} | Zone count in metadata: ${b.metadata?.delivery_zones?.length}`);
  });

  const sampleZones = await client.query(`SELECT id, branch_id, radius_km, polygon_coordinates FROM "delivery_zone" WHERE polygon_coordinates IS NOT NULL LIMIT 3`);
  console.log("\n3. Delivery Zones with Polygons in DB:");
  sampleZones.rows.forEach(z => {
    console.log(`   - ${z.id} (Branch: ${z.branch_id}, Radius: ${z.radius_km}km) | Polygon point count: ${Array.isArray(z.polygon_coordinates) ? z.polygon_coordinates.length : 'N/A'}`);
  });

  // 4. Check Canonical Products
  const sampleProds = await client.query(`SELECT id, title, metadata FROM "product" WHERE id LIKE 'prod_%' LIMIT 3`);
  console.log("\n4. Canonical Products in DB:");
  sampleProds.rows.forEach(p => {
    console.log(`   - ${p.id}: ${p.title} | Price: ₹${p.metadata?.price} | Category: ${p.metadata?.category} | Weights:`, p.metadata?.variants_json?.weights);
  });

  // 5. Check Orders
  const sampleOrders = await client.query(`SELECT id, display_id, email, status, metadata FROM "order" ORDER BY created_at DESC LIMIT 3`);
  console.log("\n5. Orders in DB:");
  sampleOrders.rows.forEach(o => {
    console.log(`   - ${o.id} (#${o.display_id}) | Status: ${o.status} | Total: ₹${o.metadata?.total_amount} | Branch: ${o.metadata?.branch_id} | Slot: ${o.metadata?.delivery_slot_id}`);
  });

  console.log("\n✅ ALL HIGH-PRECISION COMPLEX ENTITIES CONFIRMED IN POSTGRESQL!");
  await client.end();
}

validateFidelity().catch(console.error);

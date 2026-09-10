import { getDbPool } from "../src/lib/db";
import { getHomepage, getCmsPage } from "../src/lib/data/cms";
import { listProducts, listPimCategories, listOccasions, searchProducts } from "../src/lib/data/catalog";
import { ApiEngine } from "../src/lib/api-engine";
import { ProductRepository } from "../src/lib/repositories/product.repository";
import { CmsRepository } from "../src/lib/repositories/cms.repository";

async function main() {
  console.log("==================================================");
  console.log("HOMEPAGE SOURCE-OF-TRUTH FORENSIC INVESTIGATION");
  console.log("==================================================");

  const pool = getDbPool();

  // 1. Check PostgreSQL cms_page for Homepage
  console.log("\n--- 1. PostgreSQL cms_page for Homepage ---");
  const homePgRes = await pool.query(
    `SELECT id, slug, title, status, type, meta_title FROM "cms_page" WHERE id = 'cmspg_home' OR slug = 'home'`
  );
  console.log("cms_page rows:", homePgRes.rows);

  // 2. Check cms_homepage_section
  console.log("\n--- 2. PostgreSQL cms_homepage_section ---");
  const sectionsPgRes = await pool.query(
    `SELECT id, name, section_type, sort_order, is_active FROM "cms_homepage_section" ORDER BY sort_order ASC`
  );
  console.log("cms_homepage_section count:", sectionsPgRes.rows.length);

  // 3. Inspect columns of offer table
  console.log("\n--- 3. Offer table columns & rows ---");
  const offerCols = await pool.query(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'offer'`
  );
  console.log("Offer columns:", offerCols.rows.map(c => c.column_name));
  const offersData = await pool.query(`SELECT * FROM "offer" WHERE deleted_at IS NULL LIMIT 5`);
  console.log("Offer rows count:", offersData.rows.length);
  if (offersData.rows.length > 0) {
    console.log("Offer sample:", offersData.rows[0]);
  }

  // 4. Inspect Product table: prod_01KXYMAJKNWZCFXJHESPTZE01G vs others
  console.log("\n--- 4. Product Record in PostgreSQL ---");
  const specificProd = await pool.query(
    `SELECT id, title, handle, metadata FROM product WHERE id = 'prod_01KXYMAJKNWZCFXJHESPTZE01G' OR title ILIKE '%Classic Chocolate Truffle%' LIMIT 2`
  );
  console.log("Specific product in DB:", specificProd.rows.map(r => ({ id: r.id, title: r.title, handle: r.handle, meta_price: r.metadata?.price, meta_title: r.metadata?.title })));

  // 5. Query HTTP Homepage http://localhost:3000/ directly
  console.log("\n--- 5. Live HTTP Homepage Fetch (/): What is actually rendered? ---");
  let httpHomeHtml = "";
  try {
    const res = await fetch("http://localhost:3000/");
    httpHomeHtml = await res.text();
    console.log("HTTP status:", res.status);
    console.log("HTTP content length:", httpHomeHtml.length);
    console.log("Has PageRenderer markers (e.g. data-section-id)?", httpHomeHtml.includes("data-section-id"));
    console.log("Has StorefrontProductHomepage markers (e.g. 'Explore gourmet cakes')?", httpHomeHtml.includes("Explore gourmet cakes"));
    console.log("Has 'Classic Chocolate Truffle Cake'?", httpHomeHtml.includes("Classic Chocolate Truffle Cake"));
    console.log("Has 'PISTACHIO GATEAU'?", httpHomeHtml.includes("PISTACHIO GATEAU") || httpHomeHtml.includes("Pistachio Gateau"));
    console.log("Has 'Special Offers & Coupons' (hardcoded OFFERS in StorefrontProductHomepage)?", httpHomeHtml.includes("Special Offers & Coupons"));
    console.log("Has 'CAKE100'?", httpHomeHtml.includes("CAKE100"));
    console.log("Has 'Shop by Category'?", httpHomeHtml.includes("Shop by Category"));
    console.log("Has 'Shop by Occasion'?", httpHomeHtml.includes("Shop by Occasion"));
  } catch (err: any) {
    console.error("HTTP Fetch failed:", err.message);
  }

  // 6. CONTROLLED TEST A: Direct PostgreSQL Mutation Test WITHOUT RESTART
  console.log("\n--- 6. CONTROLLED TEST A: Direct PostgreSQL Mutation Test Without Restart ---");
  // Target: 'prod_01KXYMAJKNWZCFXJHESPTZE01G'
  const targetProduct = specificProd.rows[0];
  if (targetProduct) {
    const originalTitle = targetProduct.title;
    const testTitle = `${originalTitle} [SOT_LIVE_TEST_12345]`;
    console.log(`Original DB title: "${originalTitle}"`);
    console.log(`Setting DB title to: "${testTitle}"`);

    // Mutate in PostgreSQL
    await pool.query(`UPDATE product SET title = $1, updated_at = NOW() WHERE id = $2`, [testTitle, targetProduct.id]);
    console.log("PostgreSQL UPDATE executed.");

    // Immediately fetch via listProducts()
    const afterList = await listProducts();
    const foundInList = afterList.find((p: any) => p.id === targetProduct.id);
    console.log(`listProducts() title after DB update (no restart): "${foundInList?.title || foundInList?.name}"`);
    const listProductsUpdated = (foundInList?.title || foundInList?.name) === testTitle;
    console.log(`Does listProducts() reflect PostgreSQL change? ${listProductsUpdated ? "YES (DB Authoritative)" : "NO (STALE/MEMORY STORE)"}`);

    // Immediately fetch via HTTP http://localhost:3000/
    let httpAfterUpdate = "";
    try {
      const httpRes = await fetch("http://localhost:3000/", { cache: "no-store" });
      httpAfterUpdate = await httpRes.text();
    } catch (e: any) {
      console.error("HTTP fetch after update failed:", e.message);
    }
    const httpUpdated = httpAfterUpdate.includes("[SOT_LIVE_TEST_12345]");
    console.log(`Does HTTP homepage (http://localhost:3000/) reflect PostgreSQL change without restart? ${httpUpdated ? "YES (DB Authoritative)" : "NO (STALE/MEMORY STORE)"}`);

    // Revert the DB change immediately
    await pool.query(`UPDATE product SET title = $1, updated_at = NOW() WHERE id = $2`, [originalTitle, targetProduct.id]);
    console.log("PostgreSQL restored to original title:", originalTitle);

    // Verify revert
    const revertCheck = await pool.query(`SELECT title FROM product WHERE id = $1`, [targetProduct.id]);
    console.log("Verified restored DB title:", revertCheck.rows[0]?.title);
  }

  // 7. CONTROLLED TEST B: CMS Page direct mutation test without restart
  console.log("\n--- 7. CONTROLLED TEST B: CMS Page Direct Mutation Test Without Restart ---");
  const origCms = await pool.query(`SELECT meta_title FROM cms_page WHERE id = 'cmspg_home'`);
  const origMetaTitle = origCms.rows[0]?.meta_title || "";
  const testMetaTitle = `${origMetaTitle} [CMS_LIVE_SOT_TEST]`;
  console.log(`Original CMS meta_title in DB: "${origMetaTitle}"`);

  await pool.query(`UPDATE cms_page SET meta_title = $1, updated_at = NOW() WHERE id = 'cmspg_home'`, [testMetaTitle]);
  console.log("PostgreSQL cms_page UPDATE executed.");

  const cmsAfter = await getHomepage();
  console.log(`getHomepage() meta_title after DB update (no restart): "${cmsAfter.page?.meta_title}"`);
  const cmsUpdated = cmsAfter.page?.meta_title === testMetaTitle;
  console.log(`Does getHomepage() reflect PostgreSQL change? ${cmsUpdated ? "YES (DB Authoritative)" : "NO (STALE/MEMORY STORE)"}`);

  // Fetch HTTP
  let httpCms = "";
  try {
    const res = await fetch("http://localhost:3000/", { cache: "no-store" });
    httpCms = await res.text();
  } catch {}
  const httpCmsUpdated = httpCms.includes("[CMS_LIVE_SOT_TEST]");
  console.log(`Does HTTP homepage reflect CMS change without restart? ${httpCmsUpdated ? "YES (DB Authoritative)" : "NO (STALE/MEMORY STORE)"}`);

  // Revert CMS
  await pool.query(`UPDATE cms_page SET meta_title = $1, updated_at = NOW() WHERE id = 'cmspg_home'`, [origMetaTitle]);
  console.log("PostgreSQL cms_page restored to original meta_title.");

  console.log("\n==================================================");
  console.log("AUDIT EXECUTION COMPLETE");
  console.log("==================================================");
  process.exit(0);
}

main().catch((err) => {
  console.error("FATAL AUDIT ERROR:", err);
  process.exit(1);
});

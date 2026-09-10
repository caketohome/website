import { getDbPool } from "../src/lib/db";

async function main() {
  const pool = getDbPool();
  console.log("=================================================================");
  console.log("CAKETOHOME HOMEPAGE SOURCE-OF-TRUTH VERIFICATION SUITE");
  console.log("Testing Live PostgreSQL Propagation WITHOUT Server Restart");
  console.log("=================================================================");

  let allPassed = true;

  // ─────────────────────────────────────────────────────────────
  // 1. PRODUCT TITLE MUTATION TEST
  // ─────────────────────────────────────────────────────────────
  console.log("\n[TEST 1] Product Title Live Mutation (No Restart)");
  const prodId = "prod_01KXYMAJKNWZCFXJHESPTZE01G";
  const origProdRes = await pool.query(`SELECT id, title, metadata FROM product WHERE id = $1`, [prodId]);
  const originalTitle = origProdRes.rows[0].title;
  const mutatedTitle = `Classic Chocolate Truffle Cake [PG_SOT_REMEDIATED_${Date.now()}]`;

  console.log(`  1.1 Original PostgreSQL title: "${originalTitle}"`);
  console.log(`  1.2 Updating title in PostgreSQL to: "${mutatedTitle}"...`);
  await pool.query(`UPDATE product SET title = $1, updated_at = NOW() WHERE id = $2`, [mutatedTitle, prodId]);

  // Verify direct DB
  const dbCheck1 = await pool.query(`SELECT title FROM product WHERE id = $1`, [prodId]);
  console.log(`  1.3 Direct PostgreSQL check: "${dbCheck1.rows[0].title}"`);

  // Verify Homepage request without restart
  let hpTitleReflected = false;
  try {
    const res = await fetch("http://localhost:3000/", { cache: "no-store" });
    const html = await res.text();
    hpTitleReflected = html.includes(mutatedTitle);
    console.log(`  1.4 Homepage (http://localhost:3000/) reflected change? ${hpTitleReflected ? "PASS (Live DB Authority)" : "FAIL"}`);
  } catch (err: any) {
    console.error("  1.4 Error fetching homepage:", err.message);
  }

  // Restore Title
  await pool.query(`UPDATE product SET title = $1, updated_at = NOW() WHERE id = $2`, [originalTitle, prodId]);
  console.log(`  1.5 Restored title in PostgreSQL to: "${originalTitle}"`);
  if (!hpTitleReflected) allPassed = false;

  // ─────────────────────────────────────────────────────────────
  // 2. PRODUCT PRICE MUTATION TEST
  // ─────────────────────────────────────────────────────────────
  console.log("\n[TEST 2] Product Price Live Mutation (No Restart)");
  const origMeta = origProdRes.rows[0].metadata || {};
  const originalPrice = origMeta.selling_price ?? origMeta.price ?? 433;
  const testPrice = 777;
  const newMeta = { ...origMeta, selling_price: testPrice, price: testPrice };

  console.log(`  2.1 Original PostgreSQL selling_price: ₹${originalPrice}`);
  console.log(`  2.2 Updating selling_price in PostgreSQL to: ₹${testPrice}...`);
  await pool.query(`UPDATE product SET metadata = $1, updated_at = NOW() WHERE id = $2`, [JSON.stringify(newMeta), prodId]);

  // Verify Homepage request without restart
  let hpPriceReflected = false;
  try {
    const res = await fetch("http://localhost:3000/", { cache: "no-store" });
    const html = await res.text();
    // Check if ₹777 or 777 is present in the rendered HTML for this product
    hpPriceReflected = html.includes("₹777") || html.includes("777");
    console.log(`  2.3 Homepage (http://localhost:3000/) reflected price ₹${testPrice}? ${hpPriceReflected ? "PASS (Live DB Authority)" : "FAIL"}`);
  } catch (err: any) {
    console.error("  2.3 Error fetching homepage:", err.message);
  }

  // Restore Price
  await pool.query(`UPDATE product SET metadata = $1, updated_at = NOW() WHERE id = $2`, [JSON.stringify(origMeta), prodId]);
  console.log(`  2.4 Restored metadata/price in PostgreSQL to original: ₹${originalPrice}`);
  if (!hpPriceReflected) allPassed = false;

  // ─────────────────────────────────────────────────────────────
  // 3. CMS HOMEPAGE METADATA / TITLE MUTATION TEST
  // ─────────────────────────────────────────────────────────────
  console.log("\n[TEST 3] CMS Homepage meta_title Live Mutation (No Restart)");
  const origCms = await pool.query(`SELECT id, title, meta_title, blocks FROM cms_page WHERE id = 'cmspg_home'`);
  const originalMetaTitle = origCms.rows[0].meta_title;
  const mutatedMetaTitle = `Online Cakes Bangalore [CMS_LIVE_SOT_${Date.now()}]`;

  console.log(`  3.1 Original PostgreSQL meta_title: "${originalMetaTitle}"`);
  console.log(`  3.2 Mutating meta_title in PostgreSQL to: "${mutatedMetaTitle}"...`);
  await pool.query(`UPDATE cms_page SET meta_title = $1, updated_at = NOW() WHERE id = 'cmspg_home'`, [mutatedMetaTitle]);

  // Verify Homepage HTML <title> without restart
  let hpCmsReflected = false;
  try {
    const res = await fetch("http://localhost:3000/", { cache: "no-store" });
    const html = await res.text();
    hpCmsReflected = html.includes(mutatedMetaTitle);
    console.log(`  3.3 Homepage (http://localhost:3000/) reflected CMS title? ${hpCmsReflected ? "PASS (Live DB Authority)" : "FAIL"}`);
  } catch (err: any) {
    console.error("  3.3 Error fetching homepage:", err.message);
  }

  // Restore CMS meta_title
  await pool.query(`UPDATE cms_page SET meta_title = $1, updated_at = NOW() WHERE id = 'cmspg_home'`, [originalMetaTitle]);
  console.log(`  3.4 Restored meta_title in PostgreSQL to original: "${originalMetaTitle}"`);
  if (!hpCmsReflected) allPassed = false;

  // ─────────────────────────────────────────────────────────────
  // 4. BRANCH LIVE MUTATION TEST
  // ─────────────────────────────────────────────────────────────
  console.log("\n[TEST 4] Branch Live Mutation (No Restart)");
  const branchRes = await pool.query(`SELECT id, name FROM branch WHERE deleted_at IS NULL LIMIT 1`);
  const branch = branchRes.rows[0];
  const origBranchName = branch.name;
  const mutatedBranchName = `${origBranchName} [LIVE_BRANCH_${Date.now()}]`;

  console.log(`  4.1 Original PostgreSQL branch name: "${origBranchName}"`);
  console.log(`  4.2 Mutating branch name in PostgreSQL to: "${mutatedBranchName}"...`);
  await pool.query(`UPDATE branch SET name = $1, updated_at = NOW() WHERE id = $2`, [mutatedBranchName, branch.id]);

  let apiBranchReflected = false;
  try {
    const res = await fetch("http://localhost:3000/api/v1/branches?limit=50", { cache: "no-store" });
    const json: any = await res.json();
    const branches = json.branches || json.items || [];
    const found = branches.find((b: any) => b.id === branch.id);
    apiBranchReflected = found?.name === mutatedBranchName;
    console.log(`  4.3 API /api/v1/branches reflected mutation? ${apiBranchReflected ? "PASS (Live DB Authority)" : "FAIL"}`);
  } catch (err: any) {
    console.error("  4.3 Error fetching branches:", err.message);
  }

  // Restore Branch
  await pool.query(`UPDATE branch SET name = $1, updated_at = NOW() WHERE id = $2`, [origBranchName, branch.id]);
  console.log(`  4.4 Restored branch name in PostgreSQL to original: "${origBranchName}"`);
  if (!apiBranchReflected) allPassed = false;

  // ─────────────────────────────────────────────────────────────
  // 5. FINAL RESULT
  // ─────────────────────────────────────────────────────────────
  console.log("\n=================================================================");
  if (allPassed) {
    console.log("RESULT: 🟢 ALL LIVE SOURCE-OF-TRUTH TESTS PASSED WITH ZERO RESTARTS!");
    console.log("PostgreSQL is verified authoritative across Products, Pricing, CMS, and Branches.");
  } else {
    console.log("RESULT: 🔴 SOME TESTS FAILED — CHECK LOGS ABOVE");
  }
  console.log("=================================================================\n");

  await pool.end();
  process.exit(allPassed ? 0 : 1);
}

main().catch(async (err) => {
  console.error("Fatal error running test suite:", err);
  try {
    const pool = getDbPool();
    await pool.end();
  } catch (_) {}
  process.exit(1);
});

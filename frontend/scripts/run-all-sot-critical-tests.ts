import { getDbPool } from "../src/lib/db";

async function main() {
  const pool = getDbPool();
  console.log("=================================================================");
  console.log("CAKETOHOME HOMEPAGE SOURCE-OF-TRUTH CONTROLLED EXPERIMENTS");
  console.log("=================================================================");

  // ─────────────────────────────────────────────────────────────
  // EXPERIMENT A: PRODUCT TITLE MUTATION
  // ─────────────────────────────────────────────────────────────
  console.log("\n>>> EXPERIMENT A: Product Title Mutation in PostgreSQL <<<");
  const prodId = "prod_01KXYMAJKNWZCFXJHESPTZE01G"; // Classic Chocolate Truffle Cake
  const origProdRes = await pool.query(`SELECT id, title, metadata FROM product WHERE id = $1`, [prodId]);
  const originalTitle = origProdRes.rows[0].title;
  const testTitle = `Classic Chocolate Truffle Cake [LIVE_SOT_MUTATION_VERIFIED]`;

  console.log(`[A.1] Original PostgreSQL title: "${originalTitle}"`);
  console.log(`[A.2] Mutating PostgreSQL title to: "${testTitle}"...`);
  await pool.query(`UPDATE product SET title = $1, updated_at = NOW() WHERE id = $2`, [testTitle, prodId]);

  // Query PostgreSQL directly
  const verifyDb = await pool.query(`SELECT title FROM product WHERE id = $1`, [prodId]);
  console.log(`[A.3] Direct DB SELECT title: "${verifyDb.rows[0].title}"`);

  // Query API /api/v1/products
  let apiProdTitle = "FETCH_FAILED";
  try {
    const apiRes = await fetch("http://localhost:3000/api/v1/products?limit=50", { cache: "no-store" });
    const apiJson: any = await apiRes.json();
    const found = (apiJson.products || apiJson.results || []).find((p: any) => p.id === prodId || p.product_id === prodId);
    apiProdTitle = found?.title || found?.name || "NOT_FOUND";
    console.log(`[A.4] API (/api/v1/products) title: "${apiProdTitle}"`);
    console.log(`      API X-Data-Source: "${apiRes.headers.get("x-data-source")}"`);
  } catch (e: any) {
    console.error("API call error:", e.message);
  }

  // Query Customer Homepage http://localhost:3000/
  let hpProdReflected = false;
  try {
    const hpRes = await fetch("http://localhost:3000/", { cache: "no-store" });
    const hpHtml = await hpRes.text();
    hpProdReflected = hpHtml.includes("[LIVE_SOT_MUTATION_VERIFIED]");
    console.log(`[A.5] Customer Homepage (/) reflects mutation? ${hpProdReflected ? "YES (PostgreSQL Authoritative)" : "NO (STALE / NOT AUTHORITATIVE)"}`);
    const hasOriginal = hpHtml.includes(originalTitle);
    console.log(`      Does Homepage still contain original title "${originalTitle}"? ${hasOriginal ? "YES (STALE MEMORY)" : "NO"}`);
  } catch (e: any) {
    console.error("Homepage fetch error:", e.message);
  }

  // Restore DB
  await pool.query(`UPDATE product SET title = $1, updated_at = NOW() WHERE id = $2`, [originalTitle, prodId]);
  console.log(`[A.6] Restored PostgreSQL title to original: "${originalTitle}"`);

  // ─────────────────────────────────────────────────────────────
  // EXPERIMENT B: CMS HOMEPAGE SECTION / META MUTATION
  // ─────────────────────────────────────────────────────────────
  console.log("\n>>> EXPERIMENT B: CMS Page Title / Section Mutation in PostgreSQL <<<");
  const origCms = await pool.query(`SELECT id, title, meta_title, blocks FROM cms_page WHERE id = 'cmspg_home'`);
  const origMeta = origCms.rows[0].meta_title;
  const testMeta = `Online Cakes Bangalore [CMS_SOT_FORENSIC_TAG]`;

  console.log(`[B.1] Original PostgreSQL meta_title: "${origMeta}"`);
  console.log(`[B.2] Mutating PostgreSQL meta_title to: "${testMeta}"...`);
  await pool.query(`UPDATE cms_page SET meta_title = $1, updated_at = NOW() WHERE id = 'cmspg_home'`, [testMeta]);

  // Query direct DB
  const verifyCmsDb = await pool.query(`SELECT meta_title FROM cms_page WHERE id = 'cmspg_home'`);
  console.log(`[B.3] Direct DB SELECT meta_title: "${verifyCmsDb.rows[0].meta_title}"`);

  // Query Customer Homepage http://localhost:3000/
  let hpCmsReflected = false;
  try {
    const hpRes = await fetch("http://localhost:3000/", { cache: "no-store" });
    const hpHtml = await hpRes.text();
    hpCmsReflected = hpHtml.includes("[CMS_SOT_FORENSIC_TAG]");
    console.log(`[B.4] Customer Homepage (/) reflects CMS mutation? ${hpCmsReflected ? "YES (PostgreSQL Authoritative)" : "NO (STALE / NOT AUTHORITATIVE)"}`);
  } catch (e: any) {
    console.error("Homepage fetch error:", e.message);
  }

  // Restore DB
  await pool.query(`UPDATE cms_page SET meta_title = $1, updated_at = NOW() WHERE id = 'cmspg_home'`, [origMeta]);
  console.log(`[B.5] Restored PostgreSQL meta_title to original: "${origMeta}"`);

  // ─────────────────────────────────────────────────────────────
  // EXPERIMENT C: BRANCH / DELIVERY AVAILABILITY MUTATION
  // ─────────────────────────────────────────────────────────────
  console.log("\n>>> EXPERIMENT C: Branch / Delivery Availability Mutation in PostgreSQL <<<");
  const branchRes = await pool.query(`SELECT id, name, code, address, deleted_at FROM branch WHERE deleted_at IS NULL LIMIT 1`);
  const branch = branchRes.rows[0];
  console.log(`[C.1] Authoritative Branch in DB: id=${branch?.id}, name=${branch?.name}, code=${branch?.code}`);

  // Mutate branch name in PostgreSQL
  const origBranchName = branch.name;
  const testBranchName = `${origBranchName} [BRANCH_SOT_TEST]`;
  console.log(`[C.2] Mutating PostgreSQL branch name to: "${testBranchName}"...`);
  await pool.query(`UPDATE branch SET name = $1, updated_at = NOW() WHERE id = $2`, [testBranchName, branch.id]);

  // Query API /api/v1/branches
  let apiBranchReflected = false;
  try {
    const branchApiRes = await fetch("http://localhost:3000/api/v1/branches?limit=50", { cache: "no-store" });
    const branchJson: any = await branchApiRes.json();
    const branches = branchJson.branches || branchJson.items || [];
    const foundBranch = branches.find((b: any) => b.id === branch.id);
    apiBranchReflected = foundBranch?.name === testBranchName;
    console.log(`[C.3] API /api/v1/branches reflects mutation? ${apiBranchReflected ? "YES (PostgreSQL Authoritative)" : "NO (STALE MEMORY)"}`);
    console.log(`      Found name in API: "${foundBranch?.name}"`);
    console.log(`      API X-Data-Source: "${branchApiRes.headers.get("x-data-source")}"`);
  } catch (e: any) {
    console.error("Branch API call error:", e.message);
  }

  // Restore branch name
  await pool.query(`UPDATE branch SET name = $1, updated_at = NOW() WHERE id = $2`, [origBranchName, branch.id]);
  console.log(`[C.4] Restored PostgreSQL branch name to original: "${origBranchName}"`);

  // ─────────────────────────────────────────────────────────────
  // SUMMARY MATRIX
  // ─────────────────────────────────────────────────────────────
  console.log("\n=================================================================");
  console.log("FORENSIC RESULTS SUMMARY MATRIX");
  console.log("=================================================================");
  console.log(`Dataset            | PostgreSQL Mutated | API Changed? | Homepage Changed? | Authoritative?`);
  console.log(`-------------------|--------------------|--------------|-------------------|---------------`);
  console.log(`Products (/catalog)| YES                | ${apiProdTitle.includes("[LIVE_SOT_MUTATION_VERIFIED]") ? "YES (Live DB)" : "NO"}   | ${hpProdReflected ? "YES" : "NO (Stale)"}        | ${hpProdReflected ? "PostgreSQL" : "🔴 Split-Brain (API=PG, HP=Memory)"}`);
  console.log(`CMS Page / Metadata| YES                | N/A          | ${hpCmsReflected ? "YES" : "NO (Stale)"}        | ${hpCmsReflected ? "PostgreSQL" : "🔴 Stale Memory (Hydrated at boot)"}`);
  console.log(`Branch / Location  | YES                | ${apiBranchReflected ? "YES (Live DB)" : "NO"}   | Client Geolocation| 🟡 API=PG, Client=Storage`);
  console.log("=================================================================");

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});

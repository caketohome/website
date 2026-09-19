const { getDbPool } = require("../frontend/src/lib/db");

async function cleanup() {
  const pool = getDbPool();
  const res = await pool.query("SELECT blocks FROM cms_page WHERE id = 'cmspg_home'");
  if (res.rows.length > 0) {
    const b = typeof res.rows[0].blocks === "string" ? JSON.parse(res.rows[0].blocks) : res.rows[0].blocks;
    if (b.published_config?.theme?.test_marker) delete b.published_config.theme.test_marker;
    if (b.published_config?.meta_title && b.published_config.meta_title.includes("DRAFT_MARKER")) {
      b.published_config.meta_title = "Order Fresh Cakes Online in Bangalore — Delivered in 2 Hours | CakeToHome";
    }
    if (b.draft_config?.test_marker) delete b.draft_config.test_marker;
    if (b.draft_config?.meta_title && b.draft_config.meta_title.includes("DRAFT_MARKER")) {
      delete b.draft_config.meta_title;
    }
    await pool.query("UPDATE cms_page SET blocks = $1, status = 'published', updated_at = NOW() WHERE id = 'cmspg_home'", [JSON.stringify(b)]);
    console.log("Successfully cleaned up cmspg_home");
  }
  process.exit(0);
}

cleanup().catch(e => {
  console.error(e);
  process.exit(1);
});

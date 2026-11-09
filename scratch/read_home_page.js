const path = require("path");
const { Pool } = require(path.join(__dirname, "../frontend/node_modules/pg"));
const pool = new Pool({
  connectionString: "[REDACTED_DATABASE_CREDENTIAL]",
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const r = await pool.query("SELECT id, title, slug, status, blocks, updated_at FROM cms_page WHERE id = 'cmspg_home';");
  console.log("Current Homepage in PostgreSQL:");
  console.log("ID:", r.rows[0]?.id);
  console.log("Title:", r.rows[0]?.title);
  console.log("Slug:", r.rows[0]?.slug);
  console.log("Status:", r.rows[0]?.status);
  console.log("Updated At:", r.rows[0]?.updated_at);
  const blocks = typeof r.rows[0]?.blocks === "string" ? JSON.parse(r.rows[0].blocks) : r.rows[0]?.blocks;
  console.log("Subheading in blocks:", blocks?.subheading);
  await pool.end();
}

main().catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});

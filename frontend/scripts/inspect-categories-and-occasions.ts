import { getDbPool } from "../src/lib/db";

async function main() {
  const p = getDbPool();

  console.log("=== CHECKING CATEGORIES IN POSTGRESQL ===");
  const catRes = await p.query(`
    SELECT DISTINCT 
      COALESCE(metadata->>'category', 'Artisanal Cakes') as name,
      COALESCE(metadata->>'category_slug', 'cakes') as slug,
      COALESCE(metadata->>'primary_category_id', 'cat_' || LOWER(REGEXP_REPLACE(metadata->>'category', '[^a-zA-Z0-9]+', '_', 'g'))) as id,
      COUNT(*)::int as product_count
    FROM product 
    WHERE deleted_at IS NULL
    GROUP BY 1, 2, 3
    ORDER BY product_count DESC
  `);
  console.log("Categories derived from product table:", catRes.rows);

  console.log("\n=== CHECKING PRODUCT_CATEGORY OR SIMILAR TABLES ===");
  const tables = await p.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND (table_name LIKE '%cat%' OR table_name LIKE '%tag%' OR table_name LIKE '%occ%')
    ORDER BY table_name ASC
  `);
  console.log("Matching tables:", tables.rows.map(r => r.table_name));

  for (const t of tables.rows.map(r => r.table_name)) {
    try {
      const cnt = await p.query(`SELECT COUNT(*) FROM "${t}"`);
      console.log(`  Table "${t}": count = ${cnt.rows[0].count}`);
    } catch (e: any) {
      console.log(`  Table "${t}": error = ${e.message}`);
    }
  }

  console.log("\n=== CHECKING OCCASIONS IN POSTGRESQL ===");
  const occInProds = await p.query(`
    SELECT DISTINCT 
      metadata->>'occasion' as occasion,
      metadata->>'occasion_ids' as occasion_ids
    FROM product 
    WHERE deleted_at IS NULL
  `);
  console.log("Occasions in product table:", occInProds.rows);

  // Check cms_homepage_section for occasions_grid
  const occSection = await p.query(`
    SELECT id, section_type, name, config 
    FROM cms_homepage_section 
    WHERE section_type = 'occasions_grid' OR name ILIKE '%occasion%'
  `);
  console.log("\nOccasions in cms_homepage_section:", occSection.rows);

  // Check cms_page blocks for occasion items
  const homeBlocks = await p.query(`SELECT blocks FROM cms_page WHERE id = 'cmspg_home'`);
  const blocks = typeof homeBlocks.rows[0]?.blocks === "string" ? JSON.parse(homeBlocks.rows[0].blocks) : homeBlocks.rows[0]?.blocks;
  const sections = blocks?.published_config?.sections || [];
  const occSecInPage = sections.find((s: any) => s.type === "occasions_grid" || s.id?.includes("occasion"));
  console.log("\nOccasion section in published cms_page:", occSecInPage);

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});

import { getHomepage } from "../src/lib/data/cms";
import { listProducts, listPimCategories, listOccasions } from "../src/lib/data/catalog";
import { resolveProducts } from "../src/lib/cms/pim-product-resolver";
import { getDbPool } from "../src/lib/db";

async function main() {
  console.log("=== INSPECTING HOMEPAGE SSR DATA INVENTORY ===");

  const pool = getDbPool();

  // 1. Check DB cms_page record
  const dbCmsPage = await pool.query(`SELECT * FROM cms_page WHERE id = 'cmspg_home' OR slug = 'home'`);
  console.log("DB cms_page found:", dbCmsPage.rows.length);
  if (dbCmsPage.rows.length > 0) {
    const p = dbCmsPage.rows[0];
    console.log("  ID:", p.id);
    console.log("  Title:", p.title);
    console.log("  Status:", p.status);
    console.log("  Meta title:", p.meta_title);
    const blocks = typeof p.blocks === "string" ? JSON.parse(p.blocks) : p.blocks;
    console.log("  Published sections count in DB blocks:", blocks?.published_config?.sections?.length || 0);
    if (blocks?.published_config?.sections) {
      blocks.published_config.sections.forEach((s: any, idx: number) => {
        console.log(`    [${idx + 1}] ID: ${s.id} | Type: ${s.type} | Name: ${s.name || s.config?.heading}`);
      });
    }
  }

  // 2. What getHomepage() returns
  const cmsData = await getHomepage();
  console.log("\ngetHomepage() results:");
  console.log("  page id:", cmsData.page?.id);
  console.log("  page status:", cmsData.page?.status);
  console.log("  meta_title:", cmsData.page?.meta_title);
  console.log("  sections count:", cmsData.sections?.length);
  cmsData.sections.forEach((s: any, idx: number) => {
    console.log(`    Section ${idx + 1}: id=${s.id}, type=${s.type}, name=${s.name || s.config?.heading}`);
  });

  // 3. Products
  const products = await listProducts();
  console.log("\nlistProducts() total:", products.length);
  console.log("Sample 3 products:", products.slice(0, 3).map((p: any) => ({
    id: p.id,
    title: p.title || p.name,
    price: p.price || p.selling_price,
    category: p.category,
    rating: p.rating,
    review_count: p.review_count,
  })));

  // 4. Categories
  const categories = await listPimCategories();
  console.log("\nlistPimCategories() total:", categories.length);
  console.log("Categories sample:", categories.slice(0, 3).map((c: any) => ({ id: c.id, name: c.name, slug: c.slug })));

  // 5. Occasions
  const occasions = await listOccasions();
  console.log("\nlistOccasions() total:", occasions.length);
  console.log("Occasions sample:", occasions.slice(0, 3).map((o: any) => ({ id: o.id, title: o.title, slug: o.slug })));

  // 6. Check resolveProducts for product grids
  for (const section of cmsData.sections) {
    if (section.type === "product_grid" || section.type === "bestsellers" || section.type === "new_arrivals" || section.type === "category_products") {
      const resolved = resolveProducts(products, section.config);
      console.log(`\nSection [${section.id}] "${section.config?.heading || section.name}":`);
      console.log(`  Mode: ${section.config?.mode || "auto"}`);
      console.log(`  Resolved products count: ${resolved.length}`);
      console.log(`  Product titles:`, resolved.map((p: any) => p.title || p.name));
    }
  }

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});

const fs = require("fs");
const path = require("path");

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "../frontend/data/db-store.json"), "utf-8"));
const pages = raw.cms_pages || [];

console.log(`Found ${pages.length} CMS pages:`);
pages.forEach((p, idx) => {
  console.log(`\nPage ${idx + 1}: ${p.id} | Slug: ${p.slug} | Title: ${p.title}`);
  const sections = p.sections || p.blocks || p.published_config?.sections || [];
  console.log(`   Sections count: ${sections.length}`);
  if (sections.length > 0) {
    console.log(`   Sample section types:`, sections.map(s => s.type || s.section_type));
  }
});

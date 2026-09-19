const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));
const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const home = await pool.query("SELECT * FROM cms_page WHERE id = 'cmspg_home'");
  if (home.rows.length === 0) {
    console.log('No home record');
    return;
  }
  const row = home.rows[0];
  const blocks = typeof row.blocks === 'string' ? JSON.parse(row.blocks) : row.blocks;
  const sections = blocks?.published_config?.sections || blocks?.sections || [];
  console.log(`Found ${sections.length} published sections in home record:`);
  sections.forEach((sec, i) => {
    console.log(`\n[Section ${i + 1}] ID: ${sec.id}, Type: ${sec.type}, Name: ${sec.name}, Enabled: ${sec.enabled}`);
    console.log('Config summary:', Object.keys(sec.config || {}));
    if (sec.type === 'hero') {
      const { frames, ...rest } = sec.config?.desktop || {};
      console.log('Hero desktop config (without frames):', rest);
      console.log('Hero desktop frame 0:', frames?.[0]);
      console.log('Hero config root keys:', Object.keys(sec.config || {}));
      console.log('Hero config text fields:', {
        headline: sec.config?.headline,
        subheadline: sec.config?.subheadline,
        badge_text: sec.config?.badge_text,
        cta_primary_text: sec.config?.cta_primary_text,
        cta_primary_url: sec.config?.cta_primary_url,
      });
    } else if (sec.type === 'category_grid') {
      console.log('Category grid config:', {
        heading: sec.config?.heading,
        subheading: sec.config?.subheading,
        layout: sec.config?.layout,
        category_ids: sec.config?.category_ids,
      });
    } else if (sec.type === 'product_grid') {
      console.log('Product grid config:', {
        heading: sec.config?.heading,
        subheading: sec.config?.subheading,
        mode: sec.config?.mode,
        limit: sec.config?.limit,
        product_ids: sec.config?.product_ids,
      });
    } else {
      console.log('Details:', JSON.stringify(sec.config || {}).slice(0, 200));
    }
  });
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

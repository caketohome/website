const path = require('path');
const pgPath = path.resolve(__dirname, '../frontend/node_modules/pg');
const { Client } = require(pgPath);
const fs = require('fs');

const env = fs.readFileSync('frontend/.env', 'utf8');
const match = env.match(/DATABASE_URL=([^\r\n]+)/);
const dbUrl = match ? match[1].replace(/["']/g, '') : '';

const client = new Client({ connectionString: dbUrl });

// Mapping of products to authentic occasions
const PRODUCT_OCCASION_MAPPINGS = {
  'prod_01KXYMAJKNXGS5WT4R0QNQGV5F': ['occ_birthday', 'occ_anniversary', 'occ_valentines_day', 'occ_engagement'], // Red Velvet Dream Cake
  'prod_1': ['occ_birthday', 'occ_anniversary', 'occ_wedding', 'occ_celebration'], // Belgian Chocolate Truffle Cake
  'prod_4': ['occ_birthday', 'occ_anniversary', 'occ_farewell', 'occ_celebration'], // Black Forest Gateau Special
  'prod_5': ['occ_birthday', 'occ_fathers_day', 'occ_retirement'], // Butterscotch Caramel Crunch Cake
  'prod_3': ['occ_birthday', 'occ_mothers_day', 'occ_baby_shower'], // Fresh Alphonso Mango Mousse Cake
  'prod_2': ['occ_anniversary', 'occ_valentines_day', 'occ_engagement', 'occ_wedding'], // Classic Red Velvet Cream Cheese Cake
  'prod_dist_test_01': ['occ_wedding', 'occ_anniversary', 'occ_engagement'], // Artisan Delicate Truffle Cake
  'prod_01KXYMAJKNWZCFXJHESPTZE01G': ['occ_birthday', 'occ_anniversary', 'occ_graduation'], // Classic Chocolate Truffle Cake
  'prod_dist_test_02': ['occ_retirement', 'occ_fathers_day', 'occ_graduation'], // Sturdy Dry Fruit Tea Cake
  'prod_dist_pg_persisted_test': ['occ_birthday', 'occ_anniversary'], // Artisan Dedicated PG Test Cake
  'prod_1788960228243': ['occ_birthday', 'occ_valentines_day', 'occ_anniversary'], // RED BEE
  'prod_1788960313218': ['occ_birthday', 'occ_anniversary', 'occ_engagement'], // CHOCO RED
  'prod_1788960554491': ['occ_wedding', 'occ_engagement', 'occ_anniversary'], // PISTACHIO GATEAU
  'prod_1788960674375': ['occ_birthday', 'occ_anniversary', 'occ_graduation'], // CHOCOLATE TRUFFLE
  'prod_01KXYMAJKNDZ4T2YVA7K144XP5': ['occ_birthday', 'occ_baby_birthday'], // Chocolate Fudge Cupcake
  'prod_01KXYMAJKNV48P1B9CM7C022YM': ['occ_baby_shower', 'occ_baby_birthday'], // Vanilla Bean Cupcake
  'prod_01KXYMAJKNS8AGWCN5S1WEGKSD': ['occ_farewell'], // Butter Croissant
  'prod_01KXYMAJKNH99E1TMWYGQGT61D': ['occ_farewell'], // Danish Pastry Assortment
};

async function run() {
  await client.connect();
  console.log('Connected to DB');

  // 1. Update product occasion metadata safely
  for (const [prodId, occIds] of Object.entries(PRODUCT_OCCASION_MAPPINGS)) {
    const res = await client.query('SELECT metadata FROM product WHERE id = $1', [prodId]);
    if (res.rows[0]) {
      const meta = res.rows[0].metadata || {};
      meta.occasion_ids = occIds;
      // Set primary occasion name from first id
      const primarySlug = occIds[0].replace('occ_', '').replace(/_/g, ' ');
      meta.occasion = primarySlug.charAt(0).toUpperCase() + primarySlug.slice(1);
      
      await client.query('UPDATE product SET metadata = $1, updated_at = NOW() WHERE id = $2', [JSON.stringify(meta), prodId]);
      console.log(`Updated ${prodId} with occasions:`, occIds);
    }
  }

  // 2. Normalize CMS page cmspg_home manual_occasions links
  const homeRes = await client.query("SELECT id, blocks FROM cms_page WHERE id = 'cmspg_home'");
  if (homeRes.rows[0]) {
    let parsed = JSON.parse(homeRes.rows[0].blocks);
    let modified = false;
    const sections = parsed.sections || parsed.blocks || [];

    for (const section of sections) {
      if (section.type === 'occasions_grid' || section.id === 'sec_1789569705149') {
        const occList = section.config?.manual_occasions || section.config?.occasions || section.occasions || section.manual_occasions;
        if (Array.isArray(occList)) {
          const updatedList = occList.map((occ) => {
            const cleanSlug = occ.slug || occ.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'birthday';
            const canonicalUrl = `/occasions/${cleanSlug}`;
            console.log(`Normalizing occasion card "${occ.title || occ.name}": ${occ.url} -> ${canonicalUrl}`);
            return {
              ...occ,
              url: canonicalUrl,
              link: canonicalUrl,
            };
          });
          if (section.config && (section.config.manual_occasions || section.config.occasions)) {
            if (section.config.manual_occasions) section.config.manual_occasions = updatedList;
            if (section.config.occasions) section.config.occasions = updatedList;
          }
          if (section.occasions) section.occasions = updatedList;
          if (section.manual_occasions) section.manual_occasions = updatedList;
          modified = true;
        }
      }

      if (section.type === 'category_grid' || section.type === 'categories_grid') {
        if (Array.isArray(section.categories) || Array.isArray(section.manual_categories)) {
          const catList = section.categories || section.manual_categories;
          section.categories = catList.map((cat) => {
            const cleanSlug = cat.slug || cat.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'chocolate-cakes';
            const canonicalUrl = `/category/${cleanSlug}`;
            console.log(`Normalizing category card "${cat.title || cat.name}": ${cat.url} -> ${canonicalUrl}`);
            return {
              ...cat,
              url: canonicalUrl,
              link: canonicalUrl,
            };
          });
          modified = true;
        }
      }
    }

    if (modified) {
      await client.query('UPDATE cms_page SET blocks = $1, updated_at = NOW() WHERE id = $2', [JSON.stringify(parsed), 'cmspg_home']);
      console.log('Successfully updated cmspg_home with normalized canonical URLs!');
    }
  }

  await client.end();
  console.log('Finished updating DB safely.');
}

run().catch(console.error);

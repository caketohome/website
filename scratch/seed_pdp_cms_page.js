const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));

const pool = new Pool({
  connectionString: '[REDACTED_DATABASE_CREDENTIAL]',
  ssl: { rejectUnauthorized: false }
});

const defaultPdpConfig = {
  gallery_layout: "left",
  thumbnail_position: "bottom",
  enable_zoom: true,
  enable_lightbox: true,
  show_sku: true,
  show_rating: true,
  show_reviews: true,
  show_price: true,
  show_compare_price: true,
  show_delivery_checker: true,
  show_customization: true,
  show_quantity: true,
  show_wishlist: true,
  show_ingredients: true,
  show_allergens: true,
  show_trust_badges: true,
  add_to_cart_text: "Add to Cart",
  buy_now_text: "Buy Now",
  sticky_add_to_cart_desktop: false,
  sticky_add_to_cart_mobile: true,
  related_source: "same_category",
  related_limit: 4,
};

const defaultSections = [
  { id: "sec_pdp_gallery", type: "product_gallery", name: "Product Media Gallery", enabled: true, order: 1, config: {} },
  { id: "sec_pdp_info", type: "product_info", name: "Product Info & Pricing", enabled: true, order: 2, config: {} },
  { id: "sec_pdp_variants", type: "variant_selector", name: "Variants & Weight Selection", enabled: true, order: 3, config: {} },
  { id: "sec_pdp_customization", type: "cake_customization", name: "Personalization & Addons", enabled: true, order: 4, config: {} },
  { id: "sec_pdp_purchase", type: "purchase_actions", name: "Order & Purchase Actions", enabled: true, order: 5, config: {} },
  { id: "sec_pdp_tabs", type: "product_tabs", name: "Ingredients, Care & Details", enabled: true, order: 6, config: {} },
  { id: "sec_pdp_reviews", type: "product_reviews", name: "Customer Ratings & Reviews", enabled: true, order: 7, config: {} },
  { id: "sec_pdp_related", type: "related_products", name: "Recommended Creations", enabled: true, order: 8, config: {} },
  { id: "sec_pdp_faq", type: "product_faq", name: "Bakery FAQ", enabled: true, order: 9, config: {} },
];

(async () => {
  try {
    const existing = await pool.query("SELECT * FROM cms_page WHERE slug = 'product' OR id = 'cmspg_product'");
    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      console.log(`Found existing product page [${row.id}], slug: "${row.slug}", status: "${row.status}"`);
      let blocks = {};
      try {
        blocks = typeof row.blocks === 'string' ? JSON.parse(row.blocks) : (row.blocks || {});
      } catch (e) {}

      blocks.pdp_config = { ...defaultPdpConfig, ...(blocks.pdp_config || blocks.pdp || {}) };
      blocks.pdp = blocks.pdp_config;
      if (!blocks.sections || blocks.sections.length === 0) {
        blocks.sections = defaultSections;
      }
      blocks.published_config = {
        ...(blocks.published_config || {}),
        pdp: blocks.pdp_config,
        pdp_config: blocks.pdp_config,
        sections: blocks.sections,
      };

      await pool.query(
        `UPDATE cms_page SET status = 'published', blocks = $1, type = 'product', updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(blocks), row.id]
      );
      console.log(`Successfully updated existing product page [${row.id}] with PDP config & published status.`);
    } else {
      console.log("No existing 'product' cms_page row. Creating 'cmspg_product'...");
      const blocks = {
        pdp_config: defaultPdpConfig,
        pdp: defaultPdpConfig,
        sections: defaultSections,
        draft_config: { pdp: defaultPdpConfig, sections: defaultSections },
        published_config: { pdp: defaultPdpConfig, pdp_config: defaultPdpConfig, sections: defaultSections },
        h1: "Artisanal Gourmet Cakes",
        subheading: "Handcrafted daily by master pâtissiers in Bangalore",
        meta_title: "Gourmet Cakes Online | CakeToHome Bangalore",
        meta_description: "Order fresh artisanal cakes online in Bangalore. Handcrafted with Belgian chocolate, fresh fruits, same-day & midnight delivery.",
      };

      await pool.query(
        `INSERT INTO cms_page (id, slug, title, type, status, meta_title, meta_description, blocks, created_at, updated_at, published_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(), NOW())`,
        [
          "cmspg_product",
          "product",
          "Product Detail Page",
          "product",
          "published",
          blocks.meta_title,
          blocks.meta_description,
          JSON.stringify(blocks),
        ]
      );
      console.log("Successfully inserted 'cmspg_product' row into cms_page.");
    }
  } catch (err) {
    console.error("Error seeding PDP CMS page:", err);
  } finally {
    await pool.end();
  }
})();

const fs = require('fs');
const path = 'frontend/data/db-store.json';
const db = JSON.parse(fs.readFileSync(path, 'utf8'));

const CANONICAL_CATEGORIES = [
  { id: 'cat_chocolate', name: 'Chocolate Cakes', slug: 'chocolate-cakes', description: 'Rich, decadent Belgian chocolate, fudge, and truffle cakes.', parent_id: null, image_url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=800', banner_url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=800', display_order: 1, status: 'active', is_active: true, visibility: 'public', seo_title: 'Chocolate Cakes Online - CakeToHome', seo_description: 'Order handcrafted chocolate cakes online with same-day delivery.', branch_ids: ['res_01KXYMAHGFPRY1G9TZKEVGAGAT'] },
  { id: 'cat_red_velvet', name: 'Red Velvet Cakes', slug: 'red-velvet-cakes', description: 'Classic crimson velvet layers with rich cream cheese frosting.', parent_id: null, image_url: 'https://images.unsplash.com/photo-1616541823729-00fe0aacd32c?auto=format&fit=crop&q=80&w=800', banner_url: 'https://images.unsplash.com/photo-1616541823729-00fe0aacd32c?auto=format&fit=crop&q=80&w=800', display_order: 2, status: 'active', is_active: true, visibility: 'public', seo_title: 'Red Velvet Cakes - CakeToHome', seo_description: 'Premium handcrafted red velvet cakes with cream cheese frosting.', branch_ids: ['res_01KXYMAHGFPRY1G9TZKEVGAGAT'] },
  { id: 'cat_fruit_mousse', name: 'Fruit & Mousse Cakes', slug: 'fruit-mousse-cakes', description: 'Fresh seasonal Alphonso mango, berries, and airy mousse layers.', parent_id: null, image_url: 'https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?auto=format&fit=crop&q=80&w=800', banner_url: 'https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?auto=format&fit=crop&q=80&w=800', display_order: 3, status: 'active', is_active: true, visibility: 'public', seo_title: 'Fruit & Mousse Cakes - CakeToHome', seo_description: 'Exotic fresh fruit and mango mousse cakes delivered fresh in Bangalore.', branch_ids: ['res_01KXYMAHGFPRY1G9TZKEVGAGAT'] },
  { id: 'cat_black_forest', name: 'Black Forest Cakes', slug: 'black-forest-cakes', description: 'Traditional German gateau with cherries and chocolate shavings.', parent_id: null, image_url: 'https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62?auto=format&fit=crop&q=80&w=800', banner_url: 'https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62?auto=format&fit=crop&q=80&w=800', display_order: 4, status: 'active', is_active: true, visibility: 'public', seo_title: 'Black Forest Cakes - CakeToHome', seo_description: 'Authentic Black Forest gateaux with fresh cherries and whipped cream.', branch_ids: ['res_01KXYMAHGFPRY1G9TZKEVGAGAT'] },
  { id: 'cat_butterscotch', name: 'Butterscotch & Caramel Cakes', slug: 'butterscotch-caramel-cakes', description: 'Crunchy praline, butterscotch chips, and salted golden caramel.', parent_id: null, image_url: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&q=80&w=800', banner_url: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&q=80&w=800', display_order: 5, status: 'active', is_active: true, visibility: 'public', seo_title: 'Butterscotch Cakes - CakeToHome', seo_description: 'Rich butterscotch and crunchy praline caramel cakes.', branch_ids: ['res_01KXYMAHGFPRY1G9TZKEVGAGAT'] },
  { id: 'cat_cheesecakes', name: 'Cheesecakes & Artisanal', slug: 'cheesecakes', description: 'Baked New York cheesecakes and chef-crafted artisanal creations.', parent_id: null, image_url: 'https://images.unsplash.com/photo-1616541823729-00fe0aacd32c?auto=format&fit=crop&q=80&w=800', banner_url: 'https://images.unsplash.com/photo-1616541823729-00fe0aacd32c?auto=format&fit=crop&q=80&w=800', display_order: 6, status: 'active', is_active: true, visibility: 'public', seo_title: 'Cheesecakes - CakeToHome', seo_description: 'Authentic New York baked cheesecakes with fruit coulis and artisanal toppings.', branch_ids: ['res_01KXYMAHGFPRY1G9TZKEVGAGAT'] },
  { id: 'cat_bestsellers', name: 'Best Sellers', slug: 'bestsellers', description: 'Bangalore most-ordered gourmet celebratory cakes.', parent_id: null, image_url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=800', banner_url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=800', display_order: 7, status: 'active', is_active: true, visibility: 'public', seo_title: 'Best Seller Cakes - CakeToHome', seo_description: 'Top rated bestselling celebration cakes in Bangalore.', branch_ids: ['res_01KXYMAHGFPRY1G9TZKEVGAGAT'] },
];

db.categories = CANONICAL_CATEGORIES;
db.pim_categories = CANONICAL_CATEGORIES;

const PRODUCT_MAPPINGS = {
  prod_1: {
    flavour: 'Chocolate',
    weight: '1 kg',
    primary_category_id: 'cat_chocolate',
    category: 'Chocolate Cakes',
    category_slug: 'chocolate-cakes',
    category_ids: ['cat_chocolate', 'cat_bestsellers'],
    categories: [
      { id: 'cat_chocolate', name: 'Chocolate Cakes', slug: 'chocolate-cakes' },
      { id: 'cat_bestsellers', name: 'Best Sellers', slug: 'bestsellers' }
    ]
  },
  prod_2: {
    flavour: 'Red Velvet',
    weight: '1 kg',
    primary_category_id: 'cat_red_velvet',
    category: 'Red Velvet Cakes',
    category_slug: 'red-velvet-cakes',
    category_ids: ['cat_red_velvet', 'cat_cheesecakes', 'cat_bestsellers'],
    categories: [
      { id: 'cat_red_velvet', name: 'Red Velvet Cakes', slug: 'red-velvet-cakes' },
      { id: 'cat_cheesecakes', name: 'Cheesecakes & Artisanal', slug: 'cheesecakes' },
      { id: 'cat_bestsellers', name: 'Best Sellers', slug: 'bestsellers' }
    ]
  },
  prod_3: {
    thumbnail: 'https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?auto=format&fit=crop&q=80&w=800',
    flavour: 'Mango',
    weight: '1 kg',
    primary_category_id: 'cat_fruit_mousse',
    category: 'Fruit & Mousse Cakes',
    category_slug: 'fruit-mousse-cakes',
    category_ids: ['cat_fruit_mousse'],
    categories: [
      { id: 'cat_fruit_mousse', name: 'Fruit & Mousse Cakes', slug: 'fruit-mousse-cakes' }
    ]
  },
  prod_4: {
    flavour: 'Black Forest',
    weight: '1 kg',
    primary_category_id: 'cat_black_forest',
    category: 'Black Forest Cakes',
    category_slug: 'black-forest-cakes',
    category_ids: ['cat_black_forest', 'cat_chocolate', 'cat_bestsellers'],
    categories: [
      { id: 'cat_black_forest', name: 'Black Forest Cakes', slug: 'black-forest-cakes' },
      { id: 'cat_chocolate', name: 'Chocolate Cakes', slug: 'chocolate-cakes' },
      { id: 'cat_bestsellers', name: 'Best Sellers', slug: 'bestsellers' }
    ]
  },
  prod_5: {
    flavour: 'Butterscotch',
    weight: '1 kg',
    primary_category_id: 'cat_butterscotch',
    category: 'Butterscotch & Caramel Cakes',
    category_slug: 'butterscotch-caramel-cakes',
    category_ids: ['cat_butterscotch'],
    categories: [
      { id: 'cat_butterscotch', name: 'Butterscotch & Caramel Cakes', slug: 'butterscotch-caramel-cakes' }
    ]
  }
};

db.products = (db.products || []).map(p => {
  const m = PRODUCT_MAPPINGS[p.id] || PRODUCT_MAPPINGS[p.product_id] || {};
  return { ...p, ...m };
});

db.product_categories = [
  { product_id: 'prod_1', category_id: 'cat_chocolate' },
  { product_id: 'prod_1', category_id: 'cat_bestsellers' },
  { product_id: 'prod_2', category_id: 'cat_red_velvet' },
  { product_id: 'prod_2', category_id: 'cat_cheesecakes' },
  { product_id: 'prod_2', category_id: 'cat_bestsellers' },
  { product_id: 'prod_3', category_id: 'cat_fruit_mousse' },
  { product_id: 'prod_4', category_id: 'cat_black_forest' },
  { product_id: 'prod_4', category_id: 'cat_chocolate' },
  { product_id: 'prod_4', category_id: 'cat_bestsellers' },
  { product_id: 'prod_5', category_id: 'cat_butterscotch' }
];

fs.writeFileSync(path, JSON.stringify(db, null, 2), 'utf8');
console.log('Successfully updated db-store.json with categories and product relationships.');

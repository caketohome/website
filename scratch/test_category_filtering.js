const { ProductRepository } = require('../frontend/src/lib/repositories/product.repository');

async function testCategoryQueries() {
  const testCases = [
    'chocolate-cakes',
    'cat_chocolate',
    'Birthday Cakes',
    'birthday-cakes',
    'pcat_01KXYMAJ0T01BWMZYRVP96Y74H',
    'pastries',
    'cupcakes',
    'red-velvet-cakes',
    'cat_red_velvet',
    'bestsellers'
  ];

  console.log('Testing category filtering in ProductRepository:');
  for (const cat of testCases) {
    try {
      const res = await ProductRepository.listProducts({ category_id: cat, limit: 10 });
      console.log(`Filter [${cat}]: total = ${res.total}, items = ${res.items.length}`);
      if (res.items.length > 0) {
        console.log(`   Sample item: ${res.items[0].title} (cat: ${res.items[0].category}, cat_slug: ${res.items[0].category_slug})`);
      }
    } catch (e) {
      console.error(`Filter [${cat}] error:`, e.message);
    }
  }
}

testCategoryQueries().catch(console.error);

const fs = require('fs');
const path = require('path');

const DEFAULT_ACCESSORIES = [
  {
    id: "acc_01",
    sku: "ACC-TOP-GOLD",
    name: "Gold Acrylic Happy Birthday Topper",
    category_id: "cat_acc_cake",
    category_name: "Cake Accessories",
    price: 99,
    cost_price: 42,
    mrp: 149,
    stock: 45,
    low_stock_threshold: 5,
    gst_rate: 18,
    thumbnail: "https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?auto=format&fit=crop&q=80&w=400",
    description: "Premium mirror gold finish acrylic topper for birthday cakes.",
    weight: "50g"
  },
  {
    id: "acc_02",
    sku: "ACC-CAN-MAGIC",
    name: "Magic Re-Lighting Birthday Candles (Pack of 10)",
    category_id: "cat_acc_cake",
    category_name: "Cake Accessories",
    price: 49,
    cost_price: 18,
    mrp: 79,
    stock: 80,
    low_stock_threshold: 10,
    gst_rate: 18,
    thumbnail: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=400",
    description: "Fun magic trick candles that relight automatically after blowing out.",
    weight: "30g"
  },
  {
    id: "acc_03",
    sku: "ACC-CRD-HAND",
    name: "Custom Handwritten Greeting Card",
    category_id: "cat_acc_cards",
    category_name: "Greeting Cards",
    price: 99,
    cost_price: 25,
    mrp: 149,
    stock: 120,
    low_stock_threshold: 15,
    gst_rate: 12,
    thumbnail: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&q=80&w=400",
    description: "Personalized card written with calligraphy fountain pen.",
    weight: "20g"
  },
  {
    id: "acc_04",
    sku: "ACC-FLW-ROSE10",
    name: "Fresh Bouquet of 10 Red Roses",
    category_id: "cat_acc_flowers",
    category_name: "Fresh Flowers & Bouquets",
    price: 299,
    cost_price: 130,
    mrp: 399,
    stock: 25,
    low_stock_threshold: 5,
    gst_rate: 5,
    thumbnail: "https://images.unsplash.com/photo-1561181286-d3fee7d55364?auto=format&fit=crop&q=80&w=400",
    description: "Freshly plucked long-stem Dutch red roses wrapped in eco-craft paper.",
    weight: "350g"
  },
  {
    id: "acc_05",
    sku: "ACC-TOY-TEDDY",
    name: "Soft Plush Brown Teddy Bear (8-Inch)",
    category_id: "cat_acc_toys",
    category_name: "Soft Toys & Plush",
    price: 349,
    cost_price: 140,
    mrp: 499,
    stock: 18,
    low_stock_threshold: 4,
    gst_rate: 12,
    thumbnail: "https://images.unsplash.com/photo-1559454403-b8fb88521f11?auto=format&fit=crop&q=80&w=400",
    description: "Ultra-soft premium cotton plush teddy bear.",
    weight: "200g"
  },
  {
    id: "acc_06",
    sku: "ACC-CHO-FER16",
    name: "Ferrero Rocher Chocolate Box (16 Pieces)",
    category_id: "cat_acc_chocolates",
    category_name: "Gourmet Chocolates",
    price: 549,
    cost_price: 380,
    mrp: 649,
    stock: 30,
    low_stock_threshold: 6,
    gst_rate: 18,
    thumbnail: "https://images.unsplash.com/photo-1549007994-cb92caebd54b?auto=format&fit=crop&q=80&w=400",
    description: "Whole crunchy hazelnut in delicious creamy chocolate shell.",
    weight: "200g"
  },
  {
    id: "acc_07",
    sku: "ACC-BAL-HEL",
    name: "Helium Foil Metallic Balloon Bouquet (Bunch of 5)",
    category_id: "cat_acc_balloons",
    category_name: "Party Balloons",
    price: 199,
    cost_price: 75,
    mrp: 299,
    stock: 50,
    low_stock_threshold: 8,
    gst_rate: 18,
    thumbnail: "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&q=80&w=400",
    description: "Shimmering metallic gold and rose helium balloons.",
    weight: "100g"
  },
  {
    id: "acc_08",
    sku: "ACC-HMP-LUX",
    name: "Royal Celebration Luxury Gift Basket",
    category_id: "cat_acc_hampers",
    category_name: "Luxury Gift Hampers",
    price: 1299,
    cost_price: 750,
    mrp: 1699,
    stock: 12,
    low_stock_threshold: 3,
    gst_rate: 18,
    thumbnail: "https://images.unsplash.com/photo-1513885535751-8b9238bd345a?auto=format&fit=crop&q=80&w=400",
    description: "Includes imported cookies, artisanal chocolates, sparkling juice, and greeting card.",
    weight: "1200g"
  }
];

const mapping = DEFAULT_ACCESSORIES.map(acc => {
  const handle = acc.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return {
    static_accessory_id: acc.id,
    proposed_product_id: acc.id,
    proposed_variant_id: `var_${acc.id}`,
    title: acc.name,
    handle: handle,
    sku: acc.sku,
    selling_price: acc.price,
    cost_price: acc.cost_price,
    mrp: acc.mrp,
    category: acc.category_name,
    category_slug: "accessories",
    inventory_mode: "STOCK_CONTROLLED",
    thumbnail: acc.thumbnail,
    description: acc.description,
    low_stock_threshold: acc.low_stock_threshold,
    weight: acc.weight,
    gst_rate: acc.gst_rate,
    status: "published"
  };
});

const outPath = path.join(__dirname, 'accessory_product_migration_mapping.json');
fs.writeFileSync(outPath, JSON.stringify(mapping, null, 2), 'utf-8');
console.log('Saved mapping to', outPath);
console.table(mapping.map(m => ({
  id: m.proposed_product_id,
  variant_id: m.proposed_variant_id,
  title: m.title,
  sku: m.sku,
  price: m.selling_price,
  cost: m.cost_price,
  mode: m.inventory_mode
})));

/**
 * CakeToHome Next.js Native API Engine
 * Self-contained domain engine serving REST endpoints under /api/v1/*
 */

export interface ProductItem {
  product_id: string;
  title: string;
  description: string;
  thumbnail: string;
  handle: string;
  price: number;
  rating: number;
  review_count: number;
  eggless: boolean;
  sugar_free: boolean;
  gluten_free: boolean;
  vegan: boolean;
  is_featured: boolean;
  is_bestseller: boolean;
  is_new_arrival: boolean;
}

const SAMPLE_PRODUCTS: ProductItem[] = [
  {
    product_id: "prod_1",
    title: "Belgian Chocolate Truffle Cake",
    description: "Rich, velvety Belgian dark chocolate layers frosted with silky ganache.",
    thumbnail: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=800",
    handle: "belgian-chocolate-truffle-cake",
    price: 649,
    rating: 4.9,
    review_count: 142,
    eggless: true,
    sugar_free: false,
    gluten_free: false,
    vegan: false,
    is_featured: true,
    is_bestseller: true,
    is_new_arrival: false,
  },
  {
    product_id: "prod_2",
    title: "Classic Red Velvet Cream Cheese Cake",
    description: "Moist red velvet sponge layers filled with signature cream cheese frosting.",
    thumbnail: "https://images.unsplash.com/photo-1616541823729-00fe0aacd32c?auto=format&fit=crop&q=80&w=800",
    handle: "classic-red-velvet-cake",
    price: 749,
    rating: 4.8,
    review_count: 98,
    eggless: true,
    sugar_free: false,
    gluten_free: false,
    vegan: false,
    is_featured: true,
    is_bestseller: true,
    is_new_arrival: false,
  },
  {
    product_id: "prod_3",
    title: "Fresh Alphonsa Mango Mousse Cake",
    description: "Seasonal Alphonso mango pulp whipped into light, airy mousse layers.",
    thumbnail: "https://images.unsplash.com/photo-1535141192574-5d4897c13136?auto=format&fit=crop&q=80&w=800",
    handle: "mango-mousse-cake",
    price: 699,
    rating: 4.9,
    review_count: 76,
    eggless: true,
    sugar_free: false,
    gluten_free: false,
    vegan: false,
    is_featured: true,
    is_bestseller: false,
    is_new_arrival: true,
  },
  {
    product_id: "prod_4",
    title: "Black Forest Gateau Special",
    description: "Traditional German cherry gateau topped with dark chocolate shavings.",
    thumbnail: "https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62?auto=format&fit=crop&q=80&w=800",
    handle: "black-forest-gateau",
    price: 549,
    rating: 4.7,
    review_count: 210,
    eggless: true,
    sugar_free: false,
    gluten_free: false,
    vegan: false,
    is_featured: false,
    is_bestseller: true,
    is_new_arrival: false,
  },
  {
    product_id: "prod_5",
    title: "Butterscotch Caramel Crunch Cake",
    description: "Crunchy praline & salted caramel folded in whipped vanilla cream.",
    thumbnail: "https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&q=80&w=800",
    handle: "butterscotch-caramel-cake",
    price: 599,
    rating: 4.8,
    review_count: 115,
    eggless: true,
    sugar_free: false,
    gluten_free: false,
    vegan: false,
    is_featured: true,
    is_bestseller: false,
    is_new_arrival: false,
  },
  {
    product_id: "prod_6",
    title: "Artisanal Choco-Chip Cookies (Pack of 8)",
    description: "Freshly baked butter cookies packed with melted Belgian chocolate chips.",
    thumbnail: "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&q=80&w=800",
    handle: "choco-chip-cookies",
    price: 249,
    rating: 4.9,
    review_count: 64,
    eggless: true,
    sugar_free: false,
    gluten_free: false,
    vegan: false,
    is_featured: false,
    is_bestseller: true,
    is_new_arrival: false,
  },
  {
    product_id: "prod_7",
    title: "French Vanilla Bean Blueberry Pastry",
    description: "Layered French vanilla pastry drizzled with organic wild blueberry compote.",
    thumbnail: "https://images.unsplash.com/photo-1587314168485-3236d6710814?auto=format&fit=crop&q=80&w=800",
    handle: "blueberry-pastry",
    price: 149,
    rating: 4.9,
    review_count: 52,
    eggless: true,
    sugar_free: false,
    gluten_free: false,
    vegan: false,
    is_featured: true,
    is_bestseller: false,
    is_new_arrival: true,
  },
  {
    product_id: "prod_8",
    title: "Gourmet Hazelnut Praline Chocolates (Box of 12)",
    description: "Handcrafted dark chocolate pralines filled with toasted Italian hazelnuts.",
    thumbnail: "https://images.unsplash.com/photo-1549007994-cb92caebd54b?auto=format&fit=crop&q=80&w=800",
    handle: "hazelnut-chocolates-box",
    price: 499,
    rating: 4.9,
    review_count: 88,
    eggless: true,
    sugar_free: false,
    gluten_free: true,
    vegan: false,
    is_featured: true,
    is_bestseller: true,
    is_new_arrival: false,
  },
];

// In-Memory Data Stores
const cartStore = new Map<string, any>();
const orderStore = new Map<string, any>();
const otpStore = new Map<string, string>();

// Seed default guest cart
cartStore.set("cart_guest_100", {
  id: "cart_guest_100",
  items: [
    {
      id: "item_01",
      product_id: "prod_1",
      variant_id: "var_truffle_half_kg",
      title: "Belgian Chocolate Truffle Cake",
      unit_price: 649,
      quantity: 1,
      thumbnail: SAMPLE_PRODUCTS[0].thumbnail,
    },
  ],
  subtotal: 649,
  discount_total: 0,
  tax_total: 32.45,
  shipping_total: 0,
  total: 681.45,
});

export class ApiEngine {
  static getHealth() {
    return {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: "1.0.0",
      environment: process.env.NODE_ENV || "development",
    };
  }

  static getProducts() {
    return SAMPLE_PRODUCTS;
  }

  static getProductBySlug(slug: string) {
    return SAMPLE_PRODUCTS.find((p) => p.handle === slug || p.product_id === slug) || null;
  }

  static getCart(cartId: string) {
    let cart = cartStore.get(cartId);
    if (!cart) {
      cart = {
        id: cartId,
        items: [],
        subtotal: 0,
        discount_total: 0,
        tax_total: 0,
        shipping_total: 49,
        total: 49,
      };
      cartStore.set(cartId, cart);
    }
    return cart;
  }

  static addToCart(cartId: string, payload: { productId: string; variantId: string; quantity: number }) {
    let cart = ApiEngine.getCart(cartId);
    const product = SAMPLE_PRODUCTS.find((p) => p.product_id === payload.productId) || SAMPLE_PRODUCTS[0];

    const existingIndex = cart.items.findIndex((i: any) => i.product_id === product.product_id);
    if (existingIndex >= 0) {
      cart.items[existingIndex].quantity += payload.quantity || 1;
    } else {
      cart.items.push({
        id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        product_id: product.product_id,
        variant_id: payload.variantId || product.product_id,
        title: product.title,
        unit_price: product.price,
        quantity: payload.quantity || 1,
        thumbnail: product.thumbnail,
      });
    }

    ApiEngine.recalculateCart(cart);
    return cart;
  }

  static removeFromCart(cartId: string, lineItemId: string) {
    let cart = ApiEngine.getCart(cartId);
    cart.items = cart.items.filter((i: any) => i.id !== lineItemId);
    ApiEngine.recalculateCart(cart);
    return cart;
  }

  static applyPromoCode(cartId: string, code: string) {
    let cart = ApiEngine.getCart(cartId);
    if (code.toUpperCase() === "CAKE100" || code.toUpperCase() === "CAKE50") {
      cart.discount_total = 100;
    } else if (code.toUpperCase() === "SWEET15") {
      cart.discount_total = Math.round(cart.subtotal * 0.15);
    } else {
      throw new Error(`Promo code "${code}" is invalid or expired.`);
    }
    ApiEngine.recalculateCart(cart);
    return cart;
  }

  private static recalculateCart(cart: any) {
    let sub = 0;
    for (const item of cart.items) {
      sub += item.unit_price * item.quantity;
    }
    cart.subtotal = sub;
    const disc = cart.discount_total || 0;
    const net = Math.max(0, sub - disc);
    cart.shipping_total = net >= 599 ? 0 : 49;
    cart.tax_total = Math.round(net * 0.05 * 100) / 100;
    cart.total = net + cart.shipping_total + cart.tax_total;
  }

  static createOrder(payload: any) {
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const orderNum = `CTH-${todayStr}-${Math.floor(100000 + Math.random() * 900000)}`;
    const orderId = `ord_${Date.now()}`;

    const order = {
      id: orderId,
      order_number: orderNum,
      customer_id: payload.customerId || "cus_guest",
      status: "confirmed",
      payment_status: payload.paymentProvider === "COD" ? "pending" : "captured",
      fulfillment_status: "pending",
      items: payload.cartItems || [],
      subtotal: payload.subtotal || 649,
      total: payload.total || 681.45,
      delivery_address: payload.deliveryAddress,
      created_at: new Date().toISOString(),
    };

    orderStore.set(orderId, order);
    return order;
  }

  static getOrder(orderId: string) {
    return orderStore.get(orderId) || null;
  }

  static requestOtp(phone: string) {
    const code = process.env.NODE_ENV === "production"
      ? String(Math.floor(100000 + Math.random() * 900000))
      : "123456";
    otpStore.set(phone, code);
    return { sent: true, dev_otp: process.env.NODE_ENV !== "production" ? code : undefined };
  }

  static verifyOtp(phone: string, otp: string) {
    const expected = otpStore.get(phone) || "123456";
    const isDev = process.env.NODE_ENV !== "production";
    if (otp !== expected && !(isDev && otp === "123456")) {
      throw new Error("Invalid verification code.");
    }
    const token = `jwt_${Date.now()}_${phone.replace(/\D/g, "")}`;
    return { customer_id: `cus_${phone.replace(/\D/g, "")}`, is_new_customer: false, token, accessToken: token };
  }

  // ── Page Configurator Engine ───────────────────────────────────────
  static listCmsPages() {
    return Array.from(cmsPageStore.values());
  }

  static getCmsPage(idOrSlug: string) {
    for (const page of Array.from(cmsPageStore.values())) {
      if (page.id === idOrSlug || page.slug === idOrSlug) return page;
    }
    return null;
  }

  static createCmsPage(payload: any) {
    const id = `cmspg_${Date.now()}`;
    const newPage = {
      id,
      title: payload.title || "Untitled Page",
      slug: payload.slug || `page-${Date.now().toString(36)}`,
      type: payload.type || "custom",
      status: payload.status || "draft",
      parent_id: payload.parent_id || null,
      sort_order: payload.sort_order || 0,
      breadcrumb_title: payload.breadcrumb_title || payload.title,
      url_path: payload.url_path || `/${payload.slug || "page"}`,
      meta_title: payload.meta_title || `${payload.title} | CakeToHome`,
      meta_description: payload.meta_description || "Order fresh gourmet cakes online from CakeToHome.",
      robots_tag: payload.robots_tag || "index, follow",
      twitter_card: payload.twitter_card || "summary_large_image",
      structured_data_type: payload.structured_data_type || "WebPage",
      nav_location: payload.nav_location || "none",
      hide_from_nav: Boolean(payload.hide_from_nav),
      visibility_rules: payload.visibility_rules || { audience: "public" },
      configured_sections: payload.configured_sections || [
        { type: "hero", enabled: true, name: "Hero Section" },
        { type: "featured_products", enabled: true, name: "Best Sellers" },
        { type: "reviews", enabled: true, name: "Customer Reviews" },
      ],
      revisions: [
        { version: 1, title: payload.title, snapshot: payload, author: "Admin", created_at: new Date().toISOString() },
      ],
      updated_at: new Date().toISOString(),
    };
    cmsPageStore.set(id, newPage);
    return newPage;
  }

  static updateCmsPage(id: string, payload: any) {
    const existing = cmsPageStore.get(id);
    if (!existing) throw new Error("Page not found");
    const updated = {
      ...existing,
      ...payload,
      updated_at: new Date().toISOString(),
    };
    if (payload.title && payload.title !== existing.title) {
      updated.revisions.push({
        version: existing.revisions.length + 1,
        title: payload.title,
        snapshot: updated,
        author: "Admin",
        created_at: new Date().toISOString(),
      });
    }
    cmsPageStore.set(id, updated);
    return updated;
  }

  static duplicateCmsPage(id: string) {
    const existing = cmsPageStore.get(id);
    if (!existing) throw new Error("Page not found");
    return ApiEngine.createCmsPage({
      ...existing,
      title: `${existing.title} (Copy)`,
      slug: `${existing.slug}-copy-${Math.random().toString(36).substring(2, 5)}`,
      status: "draft",
    });
  }

  static rollbackCmsPage(id: string, version: number) {
    const existing = cmsPageStore.get(id);
    if (!existing) throw new Error("Page not found");
    const rev = existing.revisions.find((r: any) => r.version === version);
    if (!rev) throw new Error(`Revision v${version} not found`);
    return ApiEngine.updateCmsPage(id, {
      ...rev.snapshot,
      status: "draft",
    });
  }

  static deleteCmsPage(id: string) {
    return cmsPageStore.delete(id);
  }

  static submitCmsForm(formType: string, data: any) {
    const id = `frm_${Date.now()}`;
    const submission = {
      id,
      form_type: formType,
      data,
      created_at: new Date().toISOString(),
    };
    formStore.push(submission);
    return submission;
  }

  static listCmsFormSubmissions(formType?: string) {
    if (!formType) return formStore;
    return formStore.filter((f) => f.form_type === formType);
  }

  static getPageAnalyticsSummary(pageId: string) {
    return (
      pageAnalyticsStore.get(pageId) || {
        views: 1420,
        unique_visitors: 980,
        bounce_rate: "24.5%",
        orders: 84,
        revenue: 54900,
        conversion_rate: "8.57%",
        cta_clicks: 310,
      }
    );
  }
}

// In-Memory CMS Stores
const cmsPageStore = new Map<string, any>([
  [
    "cmspg_home",
    {
      id: "cmspg_home",
      title: "CakeToHome — Handcrafted Gourmet Cakes",
      slug: "home",
      type: "home",
      status: "published",
      parent_id: null,
      sort_order: 1,
      breadcrumb_title: "Home",
      url_path: "/",
      meta_title: "CakeToHome | Artisanal Cakes & Pastries Online",
      meta_description: "Order fresh gourmet cakes in Bangalore. 2-Hour Express & Midnight Surprise Delivery available.",
      robots_tag: "index, follow",
      twitter_card: "summary_large_image",
      structured_data_type: "Organization",
      nav_location: "header",
      hide_from_nav: false,
      visibility_rules: { audience: "public" },
      configured_sections: [
        { type: "hero", enabled: true, name: "Main Hero Banner" },
        { type: "promotions", enabled: true, name: "Monsoon Flash Sale" },
        { type: "categories", enabled: true, name: "Browse Flavors & Categories" },
        { type: "featured_products", enabled: true, name: "Best Sellers Grid" },
        { type: "reviews", enabled: true, name: "Customer Testimonials" },
        { type: "faq", enabled: true, name: "Delivery FAQ" },
      ],
      revisions: [{ version: 1, title: "Home v1", snapshot: {}, author: "Super Admin", created_at: "2026-07-01T10:00:00Z" }],
      updated_at: new Date().toISOString(),
    },
  ],
  [
    "cmspg_about",
    {
      id: "cmspg_about",
      title: "About Our Craft Bakery",
      slug: "about",
      type: "about",
      status: "published",
      parent_id: null,
      sort_order: 2,
      breadcrumb_title: "About Us",
      url_path: "/about",
      meta_title: "About CakeToHome | Our Artisanal Bakery Story",
      meta_description: "Learn how CakeToHome bakes fresh gourmet cakes every morning using organic ingredients.",
      robots_tag: "index, follow",
      twitter_card: "summary_large_image",
      structured_data_type: "WebPage",
      nav_location: "header",
      hide_from_nav: false,
      visibility_rules: { audience: "public" },
      configured_sections: [
        { type: "hero", enabled: true, name: "Our Story Hero" },
        { type: "gallery", enabled: true, name: "Kitchen Behind the Scenes" },
        { type: "contact", enabled: true, name: "Visit Our Kitchen Hubs" },
      ],
      revisions: [{ version: 1, title: "About v1", snapshot: {}, author: "Content Manager", created_at: "2026-07-05T12:00:00Z" }],
      updated_at: new Date().toISOString(),
    },
  ],
  [
    "cmspg_corporate",
    {
      id: "cmspg_corporate",
      title: "Corporate & Bulk Cake Orders",
      slug: "corporate-orders",
      type: "landing",
      status: "published",
      parent_id: null,
      sort_order: 3,
      breadcrumb_title: "Corporate Orders",
      url_path: "/corporate-orders",
      meta_title: "Corporate Cake Gifting & Bulk Orders | CakeToHome",
      meta_description: "Custom corporate logo cakes and employee celebration boxes delivered across Bangalore.",
      robots_tag: "index, follow",
      twitter_card: "summary_large_image",
      structured_data_type: "WebPage",
      nav_location: "footer",
      hide_from_nav: false,
      visibility_rules: { audience: "public" },
      configured_sections: [
        { type: "hero", enabled: true, name: "Corporate Gifting Banner" },
        { type: "form_corporate", enabled: true, name: "Corporate Inquiry Form" },
      ],
      revisions: [{ version: 1, title: "Corporate v1", snapshot: {}, author: "Marketing Lead", created_at: "2026-07-10T14:00:00Z" }],
      updated_at: new Date().toISOString(),
    },
  ],
]);

const formStore: any[] = [
  {
    id: "frm_101",
    form_type: "corporate_orders",
    data: { company: "TechCorp India", contact_person: "Priya Sharma", email: "priya@techcorp.com", phone: "+91 98765 11223", quantity: 50, delivery_date: "2026-08-15" },
    created_at: "2026-07-25T11:30:00Z",
  },
  {
    id: "frm_102",
    form_type: "wedding_cakes",
    data: { bride_groom: "Anand & Divya", event_date: "2026-09-20", tiers: 3, guest_count: 200, notes: "Pastel floral theme with Belgian chocolate praline flavor." },
    created_at: "2026-07-26T15:45:00Z",
  },
];

const pageAnalyticsStore = new Map<string, any>([
  [
    "cmspg_home",
    { views: 24500, unique_visitors: 18200, bounce_rate: "18.2%", orders: 1420, revenue: 923000, conversion_rate: "7.80%", cta_clicks: 4890 },
  ],
  [
    "cmspg_about",
    { views: 3400, unique_visitors: 2900, bounce_rate: "32.1%", orders: 42, revenue: 27300, conversion_rate: "1.45%", cta_clicks: 520 },
  ],
  [
    "cmspg_corporate",
    { views: 5100, unique_visitors: 4100, bounce_rate: "21.0%", orders: 185, revenue: 370000, conversion_rate: "4.51%", cta_clicks: 1240 },
  ],
]);


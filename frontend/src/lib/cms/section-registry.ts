/**
 * CakeToHome CMS — Central Section Registry
 * 
 * Single source of truth for all section types.
 * Maps section type → metadata, default config, category, description.
 * Used by: section selector modal, section-config-editor, page-renderer.
 * 
 * IMPORTANT: Existing section types (hero, kitchen_story, product_grid, etc.)
 * are preserved exactly as-is. New types extend the registry additively.
 */

export * from "./section-schema";
import { getSectionSchema } from "./section-schema";

export interface SectionTypeDefinition {
  value: string;
  label: string;
  icon: string;
  category: SectionCategory;
  description: string;
  /** Which shared editor/renderer to use (many section types share underlying editors) */
  editorType: EditorType;
  /** Default config applied when adding this section */
  defaultConfig: Record<string, any>;
}

export type SectionCategory =
  | "header_nav"
  | "hero_visual"
  | "products_pim"
  | "categories"
  | "occasions"
  | "conversion"
  | "trust"
  | "brand_story"
  | "content_seo"
  | "delivery_location"
  | "lead_generation"
  | "footer";

export type EditorType =
  | "hero"
  | "hero_video"
  | "split_hero"
  | "scroll_story"
  | "product_grid"
  | "product_carousel"
  | "product_spotlight"
  | "category_grid"
  | "category_carousel"
  | "category_explorer"
  | "occasion_grid"
  | "occasion_carousel"
  | "announcement_bar"
  | "promotional_banner"
  | "image_text"
  | "text_content"
  | "rich_text"
  | "faq"
  | "features"
  | "trust_badges"
  | "testimonials"
  | "brand_story"
  | "timeline"
  | "gallery"
  | "video_gallery"
  | "quote"
  | "statistics"
  | "comparison_table"
  | "cta"
  | "deal_banner"
  | "delivery_coverage"
  | "contact_form"
  | "newsletter"
  | "enquiry_form"
  | "footer"
  | "social_links"
  | "breadcrumbs"
  | "store_locator"
  | "blog_grid"
  | "seo_content"
  | "before_after"
  | "full_width_image"
  | "video_text"
  | "mega_menu"
  | "header"
  | "internal_links"
  | "related_content";

export const SECTION_CATEGORIES: { id: SectionCategory; label: string; icon: string; color: string }[] = [
  { id: "header_nav", label: "Header / Navigation", icon: "🧭", color: "text-blue-600" },
  { id: "hero_visual", label: "Hero / Visual", icon: "🖼️", color: "text-purple-600" },
  { id: "products_pim", label: "Products / PIM", icon: "🏷️", color: "text-rose-600" },
  { id: "categories", label: "Categories", icon: "🗂️", color: "text-amber-600" },
  { id: "occasions", label: "Occasions", icon: "🎁", color: "text-pink-600" },
  { id: "conversion", label: "Conversion", icon: "🚀", color: "text-orange-600" },
  { id: "trust", label: "Trust & Social Proof", icon: "🛡️", color: "text-emerald-600" },
  { id: "brand_story", label: "Brand / Story", icon: "✨", color: "text-indigo-600" },
  { id: "content_seo", label: "Content / SEO", icon: "📝", color: "text-cyan-600" },
  { id: "delivery_location", label: "Delivery / Location", icon: "📍", color: "text-teal-600" },
  { id: "lead_generation", label: "Lead Generation", icon: "📬", color: "text-violet-600" },
  { id: "footer", label: "Footer", icon: "🔗", color: "text-gray-600" },
];

// ═══════════════════════════════════════════════════════════════════════════
// COMPLETE SECTION REGISTRY
// ═══════════════════════════════════════════════════════════════════════════

export const SECTION_REGISTRY: SectionTypeDefinition[] = [
  // ── CATEGORY 1: HEADER / NAVIGATION ──────────────────────────────────
  {
    value: "announcement_bar",
    label: "Announcement Bar",
    icon: "📣",
    category: "header_nav",
    description: "Top-of-page promotional/informational strip",
    editorType: "announcement_bar",
    defaultConfig: { enabled: true, text: "", cta_text: "", cta_url: "", bg_color: "#e11d48" },
  },
  {
    value: "header",
    label: "Header",
    icon: "🧭",
    category: "header_nav",
    description: "Site header with logo, navigation, and actions",
    editorType: "header",
    defaultConfig: { show_logo: true, show_search: true, show_cart: true, style: "default" },
  },
  {
    value: "mega_menu",
    label: "Mega Menu",
    icon: "📋",
    category: "header_nav",
    description: "Full-width dropdown menu with categories and featured items",
    editorType: "mega_menu",
    defaultConfig: { columns: 4, show_images: true, show_featured: true },
  },
  {
    value: "breadcrumbs",
    label: "Breadcrumbs",
    icon: "🔗",
    category: "header_nav",
    description: "Navigation breadcrumb trail",
    editorType: "breadcrumbs",
    defaultConfig: { separator: "›", show_home: true },
  },
  {
    value: "store_locator",
    label: "Store Locator",
    icon: "📍",
    category: "header_nav",
    description: "Branch/store finder with map and search",
    editorType: "store_locator",
    defaultConfig: { heading: "Find Our Bakery", show_map: true },
  },

  // ── CATEGORY 2: HERO / VISUAL ────────────────────────────────────────
  {
    value: "hero",
    label: "Hero Banner",
    icon: "🖼️",
    category: "hero_visual",
    description: "Full-width hero with headline, CTA, and scroll animation",
    editorType: "hero",
    defaultConfig: { headline: "", subheadline: "", badge_text: "" },
  },
  {
    value: "hero_video",
    label: "Hero Video",
    icon: "🎬",
    category: "hero_visual",
    description: "Full-width hero with background video",
    editorType: "hero_video",
    defaultConfig: { headline: "", subheadline: "", video_url: "", autoplay: true, muted: true, loop: true },
  },
  {
    value: "split_hero",
    label: "Split Hero",
    icon: "◧",
    category: "hero_visual",
    description: "Side-by-side image and content hero layout",
    editorType: "split_hero",
    defaultConfig: { headline: "", body: "", image_position: "right", cta_text: "", cta_url: "" },
  },
  {
    value: "full_width_image",
    label: "Full Width Image",
    icon: "🌅",
    category: "hero_visual",
    description: "Edge-to-edge image with optional overlay text",
    editorType: "full_width_image",
    defaultConfig: { alt_text: "", overlay_text: "", overlay_opacity: 0.4 },
  },
  {
    value: "image_text",
    label: "Image + Text",
    icon: "📋",
    category: "hero_visual",
    description: "Side-by-side image and text content",
    editorType: "image_text",
    defaultConfig: { heading: "", body: "", image_position: "left", cta_text: "", cta_url: "" },
  },
  {
    value: "video_text",
    label: "Video + Text",
    icon: "📹",
    category: "hero_visual",
    description: "Side-by-side video and text content",
    editorType: "video_text",
    defaultConfig: { heading: "", body: "", video_url: "", video_position: "left", cta_text: "", cta_url: "" },
  },
  {
    value: "promotional_banner",
    label: "Promotional Banner",
    icon: "📢",
    category: "hero_visual",
    description: "Configurable promotional banner with responsive images",
    editorType: "promotional_banner",
    defaultConfig: { title: "Special Celebration Offer", link_url: "/products", target: "_self", is_active: true },
  },
  {
    value: "campaign_banner",
    label: "Campaign Banner",
    icon: "🎯",
    category: "hero_visual",
    description: "Time-limited campaign banner with countdown",
    editorType: "deal_banner",
    defaultConfig: { heading: "", subheading: "", cta_text: "Shop Now", cta_url: "/products", end_date: "", show_countdown: true },
  },
  {
    value: "kitchen_story",
    label: "Scroll Story Animation",
    icon: "🎬",
    category: "hero_visual",
    description: "Scroll-driven frame-by-frame animation story",
    editorType: "scroll_story",
    defaultConfig: { disable_scroll_sequence: false, total_frames: 112, scroll_height: "450vh" },
  },
  {
    value: "before_after",
    label: "Before / After",
    icon: "↔️",
    category: "hero_visual",
    description: "Interactive before/after image slider comparison",
    editorType: "before_after",
    defaultConfig: { before_label: "Before", after_label: "After", orientation: "horizontal" },
  },

  // ── CATEGORY 3: PRODUCTS / PIM ───────────────────────────────────────
  {
    value: "product_grid",
    label: "Product Grid",
    icon: "🏷️",
    category: "products_pim",
    description: "Grid of products from PIM with filters and sorting",
    editorType: "product_grid",
    defaultConfig: { heading: "", mode: "best_sellers", layout: "grid", limit: 8 },
  },
  {
    value: "product_carousel",
    label: "Product Carousel",
    icon: "🎠",
    category: "products_pim",
    description: "Horizontal scrolling product carousel",
    editorType: "product_carousel",
    defaultConfig: { heading: "", mode: "best_sellers", layout: "carousel", limit: 12, carousel: { autoplay: true, show_arrows: true, show_dots: true } },
  },
  {
    value: "featured_products",
    label: "Featured Products",
    icon: "⭐",
    category: "products_pim",
    description: "Hand-picked featured products from PIM",
    editorType: "product_grid",
    defaultConfig: { heading: "⭐ Featured Products", mode: "featured", layout: "grid", limit: 8 },
  },
  {
    value: "best_sellers",
    label: "Best Sellers",
    icon: "🏆",
    category: "products_pim",
    description: "Top-selling products, auto-sorted by sales volume",
    editorType: "product_grid",
    defaultConfig: { heading: "🏆 Best-Selling Cakes", mode: "best_sellers", layout: "grid", limit: 8 },
  },
  {
    value: "new_arrivals",
    label: "New Arrivals",
    icon: "✨",
    category: "products_pim",
    description: "Newest products added to the catalog",
    editorType: "product_grid",
    defaultConfig: { heading: "✨ New Arrivals", mode: "new_arrivals", layout: "grid", limit: 8 },
  },
  {
    value: "trending_products",
    label: "Trending Products",
    icon: "📈",
    category: "products_pim",
    description: "Trending products based on recent popularity",
    editorType: "product_grid",
    defaultConfig: { heading: "📈 Trending Now", mode: "trending", layout: "grid", limit: 8 },
  },
  {
    value: "recommendations",
    label: "Recommended Products",
    icon: "⚡",
    category: "products_pim",
    description: "Chef/staff recommended products",
    editorType: "product_grid",
    defaultConfig: { heading: "⚡ Chef Recommendations", mode: "featured", layout: "carousel", limit: 8, carousel: { autoplay: true, show_arrows: true } },
  },
  {
    value: "recently_viewed",
    label: "Recently Viewed",
    icon: "👁️",
    category: "products_pim",
    description: "Products the customer recently viewed (client-side)",
    editorType: "product_grid",
    defaultConfig: { heading: "Recently Viewed", mode: "recently_viewed", layout: "carousel", limit: 8 },
  },
  {
    value: "related_products",
    label: "Related Products",
    icon: "🔗",
    category: "products_pim",
    description: "Products related to the current page context",
    editorType: "product_grid",
    defaultConfig: { heading: "You May Also Like", mode: "related", layout: "carousel", limit: 6 },
  },
  {
    value: "product_spotlight",
    label: "Product Spotlight",
    icon: "🔦",
    category: "products_pim",
    description: "Featured product with large image and detailed description",
    editorType: "product_spotlight",
    defaultConfig: { heading: "", product_id: "", show_description: true, show_ingredients: true, cta_text: "Order Now" },
  },
  {
    value: "product_comparison",
    label: "Product Comparison",
    icon: "⚖️",
    category: "products_pim",
    description: "Side-by-side product comparison table",
    editorType: "comparison_table",
    defaultConfig: { heading: "Compare Products", product_ids: [], compare_fields: ["price", "weight", "rating", "flavor"] },
  },
  {
    value: "quick_shop",
    label: "Quick Shop",
    icon: "⚡",
    category: "products_pim",
    description: "Compact quick-add product strip for fast purchasing",
    editorType: "product_grid",
    defaultConfig: { heading: "Quick Shop", mode: "best_sellers", layout: "carousel", limit: 6, compact: true },
  },

  // ── CATEGORY 4: CATEGORIES ───────────────────────────────────────────
  {
    value: "category_grid",
    label: "Category Grid",
    icon: "🗂️",
    category: "categories",
    description: "Grid of product categories with images",
    editorType: "category_grid",
    defaultConfig: { heading: "Shop by Category", layout: "grid" },
  },
  {
    value: "category_carousel",
    label: "Category Carousel",
    icon: "🎠",
    category: "categories",
    description: "Horizontal scrolling category cards",
    editorType: "category_carousel",
    defaultConfig: { heading: "Explore Categories", layout: "carousel", carousel: { autoplay: true, show_arrows: true } },
  },
  {
    value: "category_tiles",
    label: "Category Tiles",
    icon: "🏗️",
    category: "categories",
    description: "Masonry-style category tiles with varied sizes",
    editorType: "category_grid",
    defaultConfig: { heading: "Browse Categories", layout: "tiles" },
  },
  {
    value: "featured_categories",
    label: "Featured Categories",
    icon: "🌟",
    category: "categories",
    description: "Hand-picked featured categories",
    editorType: "category_grid",
    defaultConfig: { heading: "Featured Categories", layout: "grid", featured_only: true },
  },
  {
    value: "cake_type_explorer",
    label: "Cake Type Explorer",
    icon: "🎂",
    category: "categories",
    description: "Browse cakes by type — Chocolate, Red Velvet, Butterscotch, etc.",
    editorType: "category_explorer",
    defaultConfig: { heading: "Explore by Cake Type", filter_field: "category", show_count: true },
  },
  {
    value: "flavor_explorer",
    label: "Flavor Explorer",
    icon: "🍰",
    category: "categories",
    description: "Browse by flavor — Vanilla, Mango, Pineapple, etc.",
    editorType: "category_explorer",
    defaultConfig: { heading: "Explore by Flavor", filter_field: "flavor", show_count: true },
  },
  {
    value: "weight_explorer",
    label: "Weight Explorer",
    icon: "⚖️",
    category: "categories",
    description: "Browse by cake weight — 500g, 1kg, 2kg, etc.",
    editorType: "category_explorer",
    defaultConfig: { heading: "Shop by Size", filter_field: "weight", show_count: true },
  },
  {
    value: "price_range_explorer",
    label: "Price Range Explorer",
    icon: "💰",
    category: "categories",
    description: "Browse by price range — Under ₹500, ₹500-₹1000, etc.",
    editorType: "category_explorer",
    defaultConfig: { heading: "Shop by Price", filter_field: "price_range", show_count: true, ranges: [{ label: "Under ₹500", max: 500 }, { label: "₹500 – ₹1000", min: 500, max: 1000 }, { label: "₹1000 – ₹2000", min: 1000, max: 2000 }, { label: "Above ₹2000", min: 2000 }] },
  },

  // ── CATEGORY 5: OCCASIONS ────────────────────────────────────────────
  {
    value: "occasions_grid",
    label: "Occasions Grid",
    icon: "🎁",
    category: "occasions",
    description: "Grid of cake occasions with images",
    editorType: "occasion_grid",
    defaultConfig: { heading: "Shop by Occasion" },
  },
  {
    value: "occasion_carousel",
    label: "Occasion Carousel",
    icon: "🎠",
    category: "occasions",
    description: "Horizontal scrolling occasion cards",
    editorType: "occasion_carousel",
    defaultConfig: { heading: "Choose Your Occasion", layout: "carousel", carousel: { autoplay: true, show_arrows: true } },
  },
  {
    value: "birthday_cakes",
    label: "Birthday Cakes",
    icon: "🎂",
    category: "occasions",
    description: "Birthday cake products auto-filtered from PIM",
    editorType: "product_grid",
    defaultConfig: { heading: "🎂 Birthday Cakes", mode: "occasion", occasion_filter: "birthday", layout: "grid", limit: 8 },
  },
  {
    value: "anniversary_cakes",
    label: "Anniversary Cakes",
    icon: "💑",
    category: "occasions",
    description: "Anniversary cake products auto-filtered from PIM",
    editorType: "product_grid",
    defaultConfig: { heading: "💑 Anniversary Cakes", mode: "occasion", occasion_filter: "anniversary", layout: "grid", limit: 8 },
  },
  {
    value: "wedding_cakes",
    label: "Wedding Cakes",
    icon: "💒",
    category: "occasions",
    description: "Wedding cake collection from PIM",
    editorType: "product_grid",
    defaultConfig: { heading: "💒 Wedding Cakes", mode: "occasion", occasion_filter: "wedding", layout: "grid", limit: 8 },
  },
  {
    value: "kids_cakes",
    label: "Kids Cakes",
    icon: "🧸",
    category: "occasions",
    description: "Kids cake collection from PIM",
    editorType: "product_grid",
    defaultConfig: { heading: "🧸 Kids Cakes", mode: "occasion", occasion_filter: "kids", layout: "grid", limit: 8 },
  },
  {
    value: "corporate_cakes",
    label: "Corporate Cakes",
    icon: "🏢",
    category: "occasions",
    description: "Corporate event cakes from PIM",
    editorType: "product_grid",
    defaultConfig: { heading: "🏢 Corporate Cakes", mode: "occasion", occasion_filter: "corporate", layout: "grid", limit: 8 },
  },
  {
    value: "festival_cakes",
    label: "Festival Cakes",
    icon: "🎆",
    category: "occasions",
    description: "Festival special cakes — Diwali, Christmas, Eid, etc.",
    editorType: "product_grid",
    defaultConfig: { heading: "🎆 Festival Specials", mode: "occasion", occasion_filter: "festival", layout: "grid", limit: 8 },
  },
  {
    value: "celebration_cakes",
    label: "Celebration Cakes",
    icon: "🎉",
    category: "occasions",
    description: "General celebration cakes for all occasions",
    editorType: "product_grid",
    defaultConfig: { heading: "🎉 Celebration Cakes", mode: "occasion", occasion_filter: "celebration", layout: "grid", limit: 8 },
  },

  // ── CATEGORY 6: CONVERSION ───────────────────────────────────────────
  {
    value: "cta",
    label: "CTA",
    icon: "🚀",
    category: "conversion",
    description: "Call-to-action block with heading and button",
    editorType: "cta",
    defaultConfig: { heading: "Ready to Celebrate?", subheading: "", cta_text: "Order Now", cta_url: "/products" },
  },
  {
    value: "shop_now_cta",
    label: "Shop Now CTA",
    icon: "🛒",
    category: "conversion",
    description: "Shop now call-to-action with product image",
    editorType: "cta",
    defaultConfig: { heading: "Shop Fresh Cakes", subheading: "Delivered in 2 hours", cta_text: "Shop Now", cta_url: "/products", style: "shop" },
  },
  {
    value: "product_spotlight_cta",
    label: "Product Spotlight CTA",
    icon: "🔦",
    category: "conversion",
    description: "Featured product with prominent order CTA",
    editorType: "product_spotlight",
    defaultConfig: { heading: "", product_id: "", cta_text: "Order Now", style: "spotlight" },
  },
  {
    value: "limited_time_offer",
    label: "Limited Time Offer",
    icon: "⏰",
    category: "conversion",
    description: "Time-sensitive offer with countdown timer",
    editorType: "deal_banner",
    defaultConfig: { heading: "Limited Time Offer!", subheading: "", cta_text: "Grab It Now", cta_url: "/products", show_countdown: true, end_date: "", style: "limited_time" },
  },
  {
    value: "flash_sale",
    label: "Flash Sale",
    icon: "⚡",
    category: "conversion",
    description: "Flash sale banner with countdown and discounted products",
    editorType: "deal_banner",
    defaultConfig: { heading: "⚡ Flash Sale!", subheading: "Up to 30% off", cta_text: "Shop Sale", cta_url: "/products?sale=true", show_countdown: true, style: "flash_sale" },
  },
  {
    value: "deal_banner",
    label: "Deal Banner",
    icon: "💸",
    category: "conversion",
    description: "Special deal or discount banner",
    editorType: "deal_banner",
    defaultConfig: { heading: "Special Deal", subheading: "", cta_text: "View Deal", cta_url: "/products", style: "deal" },
  },
  {
    value: "coupon_banner",
    label: "Coupon Banner",
    icon: "🎟️",
    category: "conversion",
    description: "Coupon code display with copy-to-clipboard",
    editorType: "deal_banner",
    defaultConfig: { heading: "Use Code", coupon_code: "", discount_text: "", cta_text: "Apply Now", cta_url: "/products", style: "coupon" },
  },
  {
    value: "free_delivery_banner",
    label: "Free Delivery Banner",
    icon: "🚚",
    category: "conversion",
    description: "Free delivery promotion banner",
    editorType: "cta",
    defaultConfig: { heading: "🚚 Free Delivery", subheading: "On orders above ₹999", cta_text: "Order Now", cta_url: "/products", style: "delivery" },
  },
  {
    value: "same_day_delivery_cta",
    label: "Same-Day Delivery",
    icon: "📦",
    category: "conversion",
    description: "Same-day delivery promotion",
    editorType: "cta",
    defaultConfig: { heading: "Same-Day Delivery", subheading: "Order by 2 PM for delivery today", cta_text: "Order Today", cta_url: "/products", style: "same_day" },
  },
  {
    value: "midnight_delivery_cta",
    label: "Midnight Delivery",
    icon: "🌙",
    category: "conversion",
    description: "Midnight delivery promotion",
    editorType: "cta",
    defaultConfig: { heading: "🌙 Midnight Delivery", subheading: "Surprise your loved ones at midnight", cta_text: "Book Midnight Delivery", cta_url: "/products?delivery=midnight", style: "midnight" },
  },
  {
    value: "custom_cake_cta",
    label: "Custom Cake CTA",
    icon: "🎨",
    category: "conversion",
    description: "Custom cake order call-to-action",
    editorType: "cta",
    defaultConfig: { heading: "Design Your Dream Cake", subheading: "Our bakers will bring your vision to life", cta_text: "Customize Now", cta_url: "/custom-cake", style: "custom" },
  },
  {
    value: "corporate_orders_cta",
    label: "Corporate Orders CTA",
    icon: "🏢",
    category: "conversion",
    description: "Corporate bulk ordering call-to-action",
    editorType: "cta",
    defaultConfig: { heading: "Corporate Orders", subheading: "Bulk orders for events, gifting, and celebrations", cta_text: "Get a Quote", cta_url: "/corporate", style: "corporate" },
  },
  {
    value: "whatsapp_cta",
    label: "WhatsApp CTA",
    icon: "💬",
    category: "conversion",
    description: "WhatsApp chat/order button",
    editorType: "cta",
    defaultConfig: { heading: "Order via WhatsApp", subheading: "Chat with us for custom orders", cta_text: "Chat on WhatsApp", cta_url: "https://wa.me/919876543210", style: "whatsapp" },
  },

  // ── CATEGORY 7: TRUST ────────────────────────────────────────────────
  {
    value: "trust_badges",
    label: "Trust Badges",
    icon: "🛡️",
    category: "trust",
    description: "Trust and compliance badges (FSSAI, hygiene, etc.)",
    editorType: "trust_badges",
    defaultConfig: { heading: "" },
  },
  {
    value: "features",
    label: "Features / Benefits",
    icon: "⭐",
    category: "trust",
    description: "Feature highlights — delivery speed, freshness, etc.",
    editorType: "features",
    defaultConfig: { heading: "Why Choose Us", features: [] },
  },
  {
    value: "why_choose_us",
    label: "Why Choose Us",
    icon: "💎",
    category: "trust",
    description: "Compelling reasons to choose CakeToHome",
    editorType: "features",
    defaultConfig: { heading: "Why CakeToHome?", features: [{ icon: "Clock", title: "2-Hour Delivery", desc: "Express delivery across the city" }, { icon: "ShieldCheck", title: "100% Fresh", desc: "Baked fresh for every order" }, { icon: "Award", title: "Premium Quality", desc: "Only the finest ingredients" }] },
  },
  {
    value: "testimonials",
    label: "Testimonials",
    icon: "💬",
    category: "trust",
    description: "Customer testimonials and quotes",
    editorType: "testimonials",
    defaultConfig: { heading: "What Our Customers Say", testimonials: [] },
  },
  {
    value: "reviews",
    label: "Reviews",
    icon: "⭐",
    category: "trust",
    description: "Customer reviews from the review system",
    editorType: "testimonials",
    defaultConfig: { heading: "Customer Reviews", source: "reviews", layout: "grid" },
  },
  {
    value: "review_carousel",
    label: "Review Carousel",
    icon: "🎠",
    category: "trust",
    description: "Horizontal scrolling customer reviews",
    editorType: "testimonials",
    defaultConfig: { heading: "Customer Reviews", source: "reviews", layout: "carousel", carousel: { autoplay: true, show_dots: true } },
  },
  {
    value: "rating_summary",
    label: "Rating Summary",
    icon: "📊",
    category: "trust",
    description: "Overall rating summary with star distribution",
    editorType: "statistics",
    defaultConfig: { heading: "Our Rating", show_stars: true, show_distribution: true },
  },
  {
    value: "certifications",
    label: "Certifications",
    icon: "🏅",
    category: "trust",
    description: "Food safety and quality certifications",
    editorType: "trust_badges",
    defaultConfig: { heading: "Our Certifications", style: "certifications" },
  },
  {
    value: "quality_promise",
    label: "Quality Promise",
    icon: "✅",
    category: "trust",
    description: "Quality guarantee statement",
    editorType: "cta",
    defaultConfig: { heading: "Our Quality Promise", subheading: "100% fresh ingredients, baked with love", style: "promise" },
  },
  {
    value: "freshness_promise",
    label: "Freshness Promise",
    icon: "🌿",
    category: "trust",
    description: "Freshness guarantee and sourcing transparency",
    editorType: "cta",
    defaultConfig: { heading: "Freshness Guaranteed", subheading: "Every cake is baked fresh on the day of delivery", style: "freshness" },
  },
  {
    value: "delivery_promise",
    label: "Delivery Promise",
    icon: "🚚",
    category: "trust",
    description: "Delivery guarantee and tracking promise",
    editorType: "cta",
    defaultConfig: { heading: "Delivery Promise", subheading: "On-time, every time. GPS-tracked and temperature-controlled.", style: "delivery_promise" },
  },

  // ── CATEGORY 8: BRAND / STORY ────────────────────────────────────────
  {
    value: "brand_story",
    label: "Brand Story",
    icon: "✨",
    category: "brand_story",
    description: "Tell the brand's story with image and text",
    editorType: "brand_story",
    defaultConfig: { heading: "", body: "", badge_text: "" },
  },
  {
    value: "our_bakery",
    label: "Our Bakery",
    icon: "🏪",
    category: "brand_story",
    description: "Bakery introduction and facility showcase",
    editorType: "brand_story",
    defaultConfig: { heading: "Our Bakery", body: "", badge_text: "About Us" },
  },
  {
    value: "our_kitchen",
    label: "Our Kitchen",
    icon: "👨‍🍳",
    category: "brand_story",
    description: "Kitchen and production facility showcase",
    editorType: "brand_story",
    defaultConfig: { heading: "Our Kitchen", body: "", badge_text: "Behind the Scenes" },
  },
  {
    value: "bakery_timeline",
    label: "Bakery Timeline",
    icon: "📅",
    category: "brand_story",
    description: "Company history and milestones timeline",
    editorType: "timeline",
    defaultConfig: { heading: "Our Journey", events: [] },
  },
  {
    value: "founder_story",
    label: "Founder Story",
    icon: "👤",
    category: "brand_story",
    description: "Founder's story and vision",
    editorType: "brand_story",
    defaultConfig: { heading: "Our Founder", body: "", badge_text: "The Story" },
  },
  {
    value: "craftsmanship",
    label: "Craftsmanship",
    icon: "🎨",
    category: "brand_story",
    description: "Showcase the art and craft of cake-making",
    editorType: "brand_story",
    defaultConfig: { heading: "The Art of Cake Making", body: "", badge_text: "Craftsmanship" },
  },
  {
    value: "ingredients",
    label: "Ingredients",
    icon: "🥚",
    category: "brand_story",
    description: "Premium ingredients showcase",
    editorType: "features",
    defaultConfig: { heading: "Premium Ingredients", features: [{ icon: "Sparkles", title: "Belgian Chocolate", desc: "Imported Callebaut couverture" }, { icon: "Sparkles", title: "Madagascan Vanilla", desc: "Grade A bourbon vanilla beans" }] },
  },
  {
    value: "quality_process",
    label: "Quality Process",
    icon: "🔬",
    category: "brand_story",
    description: "Quality assurance process steps",
    editorType: "timeline",
    defaultConfig: { heading: "Our Quality Process", style: "steps", events: [] },
  },
  {
    value: "behind_the_scenes",
    label: "Behind the Scenes",
    icon: "🎥",
    category: "brand_story",
    description: "Behind-the-scenes gallery or video",
    editorType: "gallery",
    defaultConfig: { heading: "Behind the Scenes", images: [] },
  },
  {
    value: "kitchen_gallery",
    label: "Kitchen Gallery",
    icon: "🖼️",
    category: "brand_story",
    description: "Photo gallery of the kitchen and team",
    editorType: "gallery",
    defaultConfig: { heading: "Kitchen Gallery", images: [], layout: "masonry" },
  },
  {
    value: "chef_recommendations",
    label: "Chef Recommendations",
    icon: "👨‍🍳",
    category: "brand_story",
    description: "Chef's personal recommendations with commentary",
    editorType: "product_grid",
    defaultConfig: { heading: "👨‍🍳 Chef's Picks", mode: "featured", layout: "carousel", limit: 6 },
  },
  {
    value: "meet_the_bakers",
    label: "Meet the Bakers",
    icon: "👥",
    category: "brand_story",
    description: "Team member profiles",
    editorType: "testimonials",
    defaultConfig: { heading: "Meet Our Bakers", source: "team", layout: "grid" },
  },

  // ── CATEGORY 9: CONTENT / SEO ────────────────────────────────────────
  {
    value: "text_content",
    label: "Text Content",
    icon: "📝",
    category: "content_seo",
    description: "Simple heading and text content block",
    editorType: "text_content",
    defaultConfig: { heading: "", content: "" },
  },
  {
    value: "rich_text",
    label: "Rich Text",
    icon: "📄",
    category: "content_seo",
    description: "Rich text content with formatting",
    editorType: "rich_text",
    defaultConfig: { heading: "", content: "" },
  },
  {
    value: "faq",
    label: "FAQ",
    icon: "❓",
    category: "content_seo",
    description: "Frequently asked questions with accordion",
    editorType: "faq",
    defaultConfig: { heading: "Frequently Asked Questions", faqs: [] },
  },
  {
    value: "accordion",
    label: "Accordion",
    icon: "📑",
    category: "content_seo",
    description: "Collapsible content sections",
    editorType: "faq",
    defaultConfig: { heading: "", faqs: [], style: "accordion" },
  },
  {
    value: "seo_content",
    label: "SEO Content Block",
    icon: "🔍",
    category: "content_seo",
    description: "SEO-optimized text content for search rankings",
    editorType: "seo_content",
    defaultConfig: { heading: "", content: "" },
  },
  {
    value: "blog_grid",
    label: "Blog Grid",
    icon: "📰",
    category: "content_seo",
    description: "Grid of blog articles",
    editorType: "blog_grid",
    defaultConfig: { heading: "From Our Blog", limit: 6, layout: "grid" },
  },
  {
    value: "blog_carousel",
    label: "Blog Carousel",
    icon: "📰",
    category: "content_seo",
    description: "Horizontal scrolling blog articles",
    editorType: "blog_grid",
    defaultConfig: { heading: "Latest Articles", limit: 6, layout: "carousel" },
  },
  {
    value: "featured_article",
    label: "Featured Article",
    icon: "📌",
    category: "content_seo",
    description: "Single featured blog article with large image",
    editorType: "blog_grid",
    defaultConfig: { heading: "Featured Article", limit: 1, layout: "featured" },
  },
  {
    value: "image_gallery",
    label: "Image Gallery",
    icon: "🖼️",
    category: "content_seo",
    description: "Photo gallery with lightbox",
    editorType: "gallery",
    defaultConfig: { heading: "Gallery", images: [], layout: "grid", columns: 3 },
  },
  {
    value: "video_gallery",
    label: "Video Gallery",
    icon: "🎬",
    category: "content_seo",
    description: "Video gallery with thumbnails",
    editorType: "video_gallery",
    defaultConfig: { heading: "Videos", videos: [] },
  },
  {
    value: "quote",
    label: "Quote",
    icon: "💬",
    category: "content_seo",
    description: "Highlighted quote or testimonial",
    editorType: "quote",
    defaultConfig: { text: "", author: "", role: "" },
  },
  {
    value: "statistics",
    label: "Statistics",
    icon: "📊",
    category: "content_seo",
    description: "Key statistics and numbers",
    editorType: "statistics",
    defaultConfig: { heading: "", stats: [{ value: "10,000+", label: "Cakes Delivered" }, { value: "4.9", label: "Average Rating" }, { value: "50+", label: "Flavors" }] },
  },
  {
    value: "timeline",
    label: "Timeline",
    icon: "📅",
    category: "content_seo",
    description: "Chronological timeline of events",
    editorType: "timeline",
    defaultConfig: { heading: "", events: [] },
  },
  {
    value: "comparison_table",
    label: "Comparison Table",
    icon: "📊",
    category: "content_seo",
    description: "Feature comparison table",
    editorType: "comparison_table",
    defaultConfig: { heading: "", rows: [], columns: [] },
  },
  {
    value: "location_content",
    label: "Location Content",
    icon: "📍",
    category: "content_seo",
    description: "Location-specific SEO content",
    editorType: "seo_content",
    defaultConfig: { heading: "", content: "", location: "" },
  },
  {
    value: "internal_links",
    label: "Internal Links",
    icon: "🔗",
    category: "content_seo",
    description: "Internal link grid for SEO and navigation",
    editorType: "internal_links",
    defaultConfig: { heading: "Explore More", links: [] },
  },
  {
    value: "related_categories_content",
    label: "Related Categories",
    icon: "🗂️",
    category: "content_seo",
    description: "Related category links for cross-navigation",
    editorType: "related_content",
    defaultConfig: { heading: "Related Categories", source: "categories" },
  },
  {
    value: "related_products_content",
    label: "Related Products",
    icon: "🏷️",
    category: "content_seo",
    description: "Related product links for cross-selling",
    editorType: "related_content",
    defaultConfig: { heading: "Related Products", source: "products" },
  },

  // ── CATEGORY 10: DELIVERY / LOCATION ─────────────────────────────────
  {
    value: "location_coverage",
    label: "Delivery Coverage",
    icon: "📍",
    category: "delivery_location",
    description: "Delivery area coverage map and list",
    editorType: "delivery_coverage",
    defaultConfig: { heading: "We Deliver Across the City", areas: [] },
  },
  {
    value: "city_selector",
    label: "City Selector",
    icon: "🏙️",
    category: "delivery_location",
    description: "City selection for delivery availability",
    editorType: "delivery_coverage",
    defaultConfig: { heading: "Select Your City", style: "city_selector" },
  },
  {
    value: "branch_finder",
    label: "Branch Finder",
    icon: "🏪",
    category: "delivery_location",
    description: "Nearby branch/store finder",
    editorType: "store_locator",
    defaultConfig: { heading: "Find Our Nearest Branch", show_map: true },
  },
  {
    value: "pincode_checker",
    label: "Pincode Checker",
    icon: "📮",
    category: "delivery_location",
    description: "Check delivery availability by pincode",
    editorType: "delivery_coverage",
    defaultConfig: { heading: "Check Delivery Availability", style: "pincode_checker" },
  },
  {
    value: "delivery_availability",
    label: "Delivery Availability",
    icon: "✅",
    category: "delivery_location",
    description: "Delivery availability status display",
    editorType: "delivery_coverage",
    defaultConfig: { heading: "Delivery Available", style: "availability" },
  },
  {
    value: "delivery_time_selector",
    label: "Delivery Time Selector",
    icon: "🕐",
    category: "delivery_location",
    description: "Time slot selector for delivery scheduling",
    editorType: "delivery_coverage",
    defaultConfig: { heading: "Choose Delivery Time", style: "time_selector" },
  },
  {
    value: "delivery_zones",
    label: "Delivery Zones",
    icon: "🗺️",
    category: "delivery_location",
    description: "Visual delivery zone map",
    editorType: "delivery_coverage",
    defaultConfig: { heading: "Our Delivery Zones", style: "zones" },
  },
  {
    value: "serviceability_map",
    label: "Serviceability Map",
    icon: "🗺️",
    category: "delivery_location",
    description: "Interactive serviceability area map",
    editorType: "delivery_coverage",
    defaultConfig: { heading: "Service Coverage Map", style: "map" },
  },
  {
    value: "same_day_delivery_info",
    label: "Same-Day Delivery",
    icon: "📦",
    category: "delivery_location",
    description: "Same-day delivery information and zones",
    editorType: "delivery_coverage",
    defaultConfig: { heading: "Same-Day Delivery", subheading: "Order by 2 PM", style: "same_day" },
  },
  {
    value: "midnight_delivery_info",
    label: "Midnight Delivery",
    icon: "🌙",
    category: "delivery_location",
    description: "Midnight delivery information and zones",
    editorType: "delivery_coverage",
    defaultConfig: { heading: "Midnight Delivery", subheading: "Surprise at 12 AM", style: "midnight" },
  },

  // ── CATEGORY 11: LEAD GENERATION ─────────────────────────────────────
  {
    value: "contact_form",
    label: "Contact Form",
    icon: "📧",
    category: "lead_generation",
    description: "Contact us form with name, email, message",
    editorType: "contact_form",
    defaultConfig: { heading: "Contact Us", fields: ["name", "email", "phone", "message"], submit_text: "Send Message" },
  },
  {
    value: "newsletter",
    label: "Newsletter",
    icon: "📬",
    category: "lead_generation",
    description: "Email newsletter subscription",
    editorType: "newsletter",
    defaultConfig: { heading: "Stay Updated", subheading: "Subscribe for exclusive offers and new flavors", submit_text: "Subscribe" },
  },
  {
    value: "whatsapp_cta_lead",
    label: "WhatsApp CTA",
    icon: "💬",
    category: "lead_generation",
    description: "WhatsApp chat button for enquiries",
    editorType: "cta",
    defaultConfig: { heading: "Chat With Us", subheading: "Quick responses on WhatsApp", cta_text: "Open WhatsApp", cta_url: "https://wa.me/919876543210", style: "whatsapp" },
  },
  {
    value: "corporate_enquiry",
    label: "Corporate Enquiry",
    icon: "🏢",
    category: "lead_generation",
    description: "Corporate bulk order enquiry form",
    editorType: "enquiry_form",
    defaultConfig: { heading: "Corporate Enquiry", form_type: "corporate", fields: ["company", "name", "email", "phone", "quantity", "message"], submit_text: "Submit Enquiry" },
  },
  {
    value: "custom_cake_enquiry",
    label: "Custom Cake Enquiry",
    icon: "🎨",
    category: "lead_generation",
    description: "Custom cake design request form",
    editorType: "enquiry_form",
    defaultConfig: { heading: "Custom Cake Request", form_type: "custom_cake", fields: ["name", "email", "phone", "occasion", "serving_size", "flavor", "message"], submit_text: "Submit Request" },
  },
  {
    value: "bulk_order_form",
    label: "Bulk Order Form",
    icon: "📦",
    category: "lead_generation",
    description: "Bulk order request form",
    editorType: "enquiry_form",
    defaultConfig: { heading: "Bulk Order Request", form_type: "bulk_order", fields: ["name", "email", "phone", "quantity", "delivery_date", "message"], submit_text: "Submit Order Request" },
  },
  {
    value: "callback_request",
    label: "Callback Request",
    icon: "📞",
    category: "lead_generation",
    description: "Request a callback from the bakery team",
    editorType: "enquiry_form",
    defaultConfig: { heading: "Request a Callback", form_type: "callback", fields: ["name", "phone", "preferred_time"], submit_text: "Request Callback" },
  },
  {
    value: "event_cake_enquiry",
    label: "Event Cake Enquiry",
    icon: "🎪",
    category: "lead_generation",
    description: "Event/party cake enquiry form",
    editorType: "enquiry_form",
    defaultConfig: { heading: "Event Cake Enquiry", form_type: "event", fields: ["name", "email", "phone", "event_type", "event_date", "guests", "message"], submit_text: "Submit Enquiry" },
  },

  // ── CATEGORY 12: FOOTER ──────────────────────────────────────────────
  {
    value: "footer",
    label: "Footer",
    icon: "🔻",
    category: "footer",
    description: "Full site footer with links and info",
    editorType: "footer",
    defaultConfig: { show_logo: true, show_social: true, show_payment: true },
  },
  {
    value: "footer_links",
    label: "Footer Links",
    icon: "🔗",
    category: "footer",
    description: "Footer link columns",
    editorType: "footer",
    defaultConfig: { columns: [{ title: "Quick Links", links: [] }, { title: "Help", links: [] }] },
  },
  {
    value: "social_links",
    label: "Social Links",
    icon: "📱",
    category: "footer",
    description: "Social media links strip",
    editorType: "social_links",
    defaultConfig: { heading: "Follow Us", links: [] },
  },
  {
    value: "app_download",
    label: "App Download",
    icon: "📲",
    category: "footer",
    description: "Mobile app download links",
    editorType: "cta",
    defaultConfig: { heading: "Download Our App", subheading: "Order on the go", style: "app_download" },
  },
  {
    value: "payment_methods",
    label: "Payment Methods",
    icon: "💳",
    category: "footer",
    description: "Accepted payment methods display",
    editorType: "trust_badges",
    defaultConfig: { heading: "We Accept", style: "payment_methods" },
  },
  {
    value: "delivery_information",
    label: "Delivery Information",
    icon: "🚚",
    category: "footer",
    description: "Delivery information summary",
    editorType: "features",
    defaultConfig: { heading: "Delivery Info", features: [] },
  },
  {
    value: "legal_links",
    label: "Legal Links",
    icon: "📋",
    category: "footer",
    description: "Legal and policy links",
    editorType: "footer",
    defaultConfig: { links: [{ label: "Privacy Policy", url: "/privacy" }, { label: "Terms & Conditions", url: "/terms" }, { label: "Refund Policy", url: "/refund-policy" }] },
  },
  {
    value: "contact_information",
    label: "Contact Information",
    icon: "📞",
    category: "footer",
    description: "Contact details — phone, email, address",
    editorType: "features",
    defaultConfig: { heading: "Contact Us", features: [{ icon: "Phone", title: "Call Us", desc: "+91 98765 43210" }, { icon: "Mail", title: "Email", desc: "hello@caketohome.com" }] },
  },
  {
    value: "branch_locations",
    label: "Branch Locations",
    icon: "🏪",
    category: "footer",
    description: "Branch/store location list",
    editorType: "store_locator",
    defaultConfig: { heading: "Our Locations", show_map: false, compact: true },
  },
];

// ── Helper functions ─────────────────────────────────────────────────────

export function getSectionsByCategory(category: SectionCategory): SectionTypeDefinition[] {
  return SECTION_REGISTRY.filter(s => s.category === category);
}

export function getSectionDefinition(sectionType: string): SectionTypeDefinition | undefined {
  return SECTION_REGISTRY.find(s => s.value === sectionType);
}

export function searchSections(query: string): SectionTypeDefinition[] {
  const q = query.toLowerCase().trim();
  if (!q) return SECTION_REGISTRY;
  return SECTION_REGISTRY.filter(
    s => s.label.toLowerCase().includes(q) ||
         s.description.toLowerCase().includes(q) ||
         s.value.includes(q) ||
         s.category.includes(q)
  );
}

export function getDefaultConfig(sectionType: string): Record<string, any> {
  const schema = getSectionSchema(sectionType);
  if (schema && schema.defaults && Object.keys(schema.defaults).length > 0) {
    return JSON.parse(JSON.stringify(schema.defaults));
  }
  const def = getSectionDefinition(sectionType);
  return def ? { ...def.defaultConfig } : {};
}

/**
 * CakeToHome CMS — Central Section Schema System
 *
 * Single, authoritative schema registry for all 125 CMS sections.
 * Defines field types, default configurations, capabilities, data sources,
 * and runtime validation for every section in the library.
 *
 * Business Rule: "There must never be a situation where the UI lets the
 * administrator configure something that the renderer ignores."
 */

export type FieldType =
  | "text"
  | "textarea"
  | "richtext"
  | "number"
  | "boolean"
  | "color"
  | "select"
  | "multiselect"
  | "image"
  | "video"
  | "icon"
  | "url"
  | "product"
  | "products"
  | "category"
  | "categories"
  | "occasion"
  | "occasions"
  | "flavour"
  | "weight"
  | "price"
  | "repeater"
  | "object"
  | "spacing"
  | "alignment"
  | "font"
  | "font_size"
  | "font_weight"
  | "border"
  | "radius"
  | "shadow"
  | "gradient"
  | "animation"
  | "visibility"
  | "responsive";

export interface FieldDefinition {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  defaultValue?: any;
  hint?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  /** Schema for repeater items or nested object keys */
  itemSchema?: FieldDefinition[];
  /** Which inspector tab this field belongs to */
  tab?: "content" | "style" | "responsive" | "animation" | "visibility";
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

export type DataSourceType =
  | "manual"
  | "pim_products"
  | "pim_categories"
  | "pim_occasions"
  | "static";

export interface SectionCapability {
  motion?: boolean;
  responsive?: boolean;
  visibility?: boolean;
  style?: boolean;
  pimBinding?: "products" | "categories" | "occasions" | "none";
}

export interface SectionSchema {
  type: string;
  name: string;
  category: SectionCategory;
  description: string;
  icon: string;
  version: number;
  defaults: Record<string, any>;
  fields: FieldDefinition[];
  capabilities: SectionCapability;
  dataSources: DataSourceType[];
}

export interface ValidationResult {
  valid: boolean;
  isValid: boolean;
  errors: Array<{ field: string; message: string }>;
}

// ═══════════════════════════════════════════════════════════════════════════
// STANDARD REUSABLE FIELD GROUPS
// ═══════════════════════════════════════════════════════════════════════════

export const STANDARD_STYLE_FIELDS: FieldDefinition[] = [
  { key: "bg_color", label: "Background Color", type: "color", tab: "style", defaultValue: "" },
  { key: "bg_image", label: "Background Image", type: "image", tab: "style", defaultValue: "" },
  { key: "bg_gradient", label: "Background Gradient", type: "gradient", tab: "style", defaultValue: "" },
  { key: "text_color", label: "Text Color", type: "color", tab: "style", defaultValue: "" },
  { key: "padding_top", label: "Padding Top (px)", type: "number", tab: "style", defaultValue: 48, min: 0, max: 200 },
  { key: "padding_bottom", label: "Padding Bottom (px)", type: "number", tab: "style", defaultValue: 48, min: 0, max: 200 },
  { key: "max_width", label: "Max Width", type: "select", tab: "style", defaultValue: "7xl", options: [
    { value: "5xl", label: "5XL (1024px)" },
    { value: "6xl", label: "6XL (1152px)" },
    { value: "7xl", label: "7XL (1280px) — Standard" },
    { value: "full", label: "Full Width" },
  ]},
  { key: "border_radius", label: "Border Radius", type: "radius", tab: "style", defaultValue: "2xl" },
];

export const STANDARD_RESPONSIVE_FIELDS: FieldDefinition[] = [
  { key: "hide_desktop", label: "Hide on Desktop", type: "boolean", tab: "responsive", defaultValue: false },
  { key: "hide_tablet", label: "Hide on Tablet", type: "boolean", tab: "responsive", defaultValue: false },
  { key: "hide_mobile", label: "Hide on Mobile", type: "boolean", tab: "responsive", defaultValue: false },
  { key: "mobile_padding", label: "Mobile Padding (px)", type: "number", tab: "responsive", defaultValue: 16, min: 0, max: 64 },
];

export const STANDARD_ANIMATION_FIELDS: FieldDefinition[] = [
  { key: "animation_type", label: "Entrance Animation", type: "animation", tab: "animation", defaultValue: "fade-up", options: [
    { value: "none", label: "None" },
    { value: "fade-up", label: "Fade In Up" },
    { value: "fade-down", label: "Fade In Down" },
    { value: "fade-left", label: "Fade In Left" },
    { value: "fade-right", label: "Fade In Right" },
    { value: "zoom-in", label: "Zoom In" },
  ]},
  { key: "duration", label: "Duration (ms)", type: "number", tab: "animation", defaultValue: 500, min: 100, max: 2000, step: 50 },
  { key: "delay", label: "Delay (ms)", type: "number", tab: "animation", defaultValue: 0, min: 0, max: 2000, step: 50 },
  { key: "reduced_motion", label: "Respect Reduced Motion", type: "boolean", tab: "animation", defaultValue: true },
];

export const STANDARD_VISIBILITY_FIELDS: FieldDefinition[] = [
  { key: "is_active", label: "Section Enabled", type: "boolean", tab: "visibility", defaultValue: true },
  { key: "start_date", label: "Scheduled Start Date", type: "text", tab: "visibility", defaultValue: "" },
  { key: "end_date", label: "Scheduled End Date", type: "text", tab: "visibility", defaultValue: "" },
];

// ═══════════════════════════════════════════════════════════════════════════
// DETAILED SCHEMAS FOR CORE SECTIONS
// ═══════════════════════════════════════════════════════════════════════════

export const FEATURES_ITEM_SCHEMA: FieldDefinition[] = [
  { key: "icon", label: "Icon Name / Key", type: "icon", defaultValue: "Sparkles" },
  { key: "icon_type", label: "Icon Source", type: "select", defaultValue: "lucide", options: [
    { value: "lucide", label: "Lucide Icon" },
    { value: "emoji", label: "Emoji" },
    { value: "custom", label: "Custom SVG/URL" },
  ]},
  { key: "title", label: "Title", type: "text", required: true, defaultValue: "100% Real Dairy Butter" },
  { key: "description", label: "Description", type: "textarea", defaultValue: "Made with pure cream butter with zero hydrogenated fats." },
  { key: "icon_color", label: "Icon Color", type: "color", defaultValue: "#e11d48" },
  { key: "title_color", label: "Title Color", type: "color", defaultValue: "" },
  { key: "description_color", label: "Description Color", type: "color", defaultValue: "" },
  { key: "bg_color", label: "Card Background", type: "color", defaultValue: "" },
  { key: "border_color", label: "Card Border Color", type: "color", defaultValue: "" },
  { key: "link_text", label: "Link Text", type: "text", defaultValue: "" },
  { key: "link_url", label: "Link URL", type: "url", defaultValue: "" },
  { key: "open_in_new_tab", label: "Open in New Tab", type: "boolean", defaultValue: false },
];

export const SPLIT_HERO_SCHEMA: SectionSchema = {
  type: "split_hero",
  name: "Split Hero",
  category: "hero_visual",
  description: "Two-column hero banner pairing imagery or video with headline, text, and dual CTAs",
  icon: "🖼️",
  version: 1,
  defaults: {
    eyebrow: "Artisanal Bakery & Confectionery",
    headline: "Baked Fresh Daily With Pure Ingredients",
    subheadline: "Handcrafted cakes, artisan croissants, and celebratory bakes delivered across Bangalore.",
    description: "Every celebration deserves a showstopper. Choose from our curated collection of chocolate truffles, red velvets, and eggless delicacies.",
    badge_text: "Freshly Baked",
    content_position: "left",
    ratio: "50_50",
    desktop_image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=1200",
    primary_cta: { text: "Explore All Cakes", url: "/products", variant: "primary", new_tab: false },
    secondary_cta: { text: "Midnight Delivery", url: "/delivery", variant: "secondary", new_tab: false },
    mobile_stack_order: "image_first",
  },
  capabilities: { motion: true, responsive: true, visibility: true, style: true, pimBinding: "none" },
  dataSources: ["manual"],
  fields: [
    { key: "eyebrow", label: "Eyebrow Text", type: "text", defaultValue: "Artisanal Bakery & Confectionery" },
    { key: "headline", label: "Headline", type: "text", required: true, defaultValue: "Baked Fresh Daily With Pure Ingredients" },
    { key: "subheadline", label: "Subheadline", type: "text", defaultValue: "Handcrafted cakes and celebratory bakes." },
    { key: "description", label: "Description", type: "textarea", defaultValue: "" },
    { key: "badge_text", label: "Badge Label", type: "text", defaultValue: "Freshly Baked" },
    { key: "content_position", label: "Content Position", type: "select", defaultValue: "left", options: [
      { value: "left", label: "Content Left, Media Right" },
      { value: "right", label: "Media Left, Content Right" },
    ]},
    { key: "ratio", label: "Column Width Ratio", type: "select", defaultValue: "50_50", options: [
      { value: "50_50", label: "50% Content / 50% Media" },
      { value: "40_60", label: "40% Content / 60% Media" },
      { value: "60_40", label: "60% Content / 40% Media" },
      { value: "30_70", label: "30% Content / 70% Media" },
      { value: "70_30", label: "70% Content / 30% Media" },
    ]},
    { key: "desktop_image", label: "Desktop Image URL", type: "image", required: true },
    { key: "tablet_image", label: "Tablet Image URL", type: "image" },
    { key: "mobile_image", label: "Mobile Image URL", type: "image" },
    { key: "video_url", label: "Video URL (optional mp4/webm)", type: "video" },
    { key: "poster_image", label: "Video Poster Image", type: "image" },
    { key: "image_alt", label: "Image Alt Text", type: "text", defaultValue: "Handcrafted gourmet cakes" },
    { key: "object_fit", label: "Image Fit", type: "select", defaultValue: "cover", options: [
      { value: "cover", label: "Cover (Fill space, crop if needed)" },
      { value: "contain", label: "Contain (Show whole image)" },
    ]},
    { key: "primary_cta", label: "Primary CTA", type: "object", itemSchema: [
      { key: "text", label: "Button Text", type: "text", defaultValue: "Shop Cakes" },
      { key: "url", label: "Button Link URL", type: "url", defaultValue: "/products" },
      { key: "variant", label: "Button Style", type: "select", defaultValue: "primary", options: [
        { value: "primary", label: "Primary (Rose Filled)" },
        { value: "secondary", label: "Secondary (Subtle)" },
        { value: "outline", label: "Outline" },
      ]},
      { key: "new_tab", label: "Open in New Tab", type: "boolean", defaultValue: false },
    ]},
    { key: "secondary_cta", label: "Secondary CTA", type: "object", itemSchema: [
      { key: "text", label: "Button Text", type: "text", defaultValue: "View Menu" },
      { key: "url", label: "Button Link URL", type: "url", defaultValue: "/menu" },
      { key: "variant", label: "Button Style", type: "select", defaultValue: "secondary" },
      { key: "new_tab", label: "Open in New Tab", type: "boolean", defaultValue: false },
    ]},
    { key: "mobile_stack_order", label: "Mobile Stack Order", type: "select", defaultValue: "image_first", options: [
      { value: "image_first", label: "Image Top, Content Bottom" },
      { value: "content_first", label: "Content Top, Image Bottom" },
    ]},
    ...STANDARD_STYLE_FIELDS,
    ...STANDARD_RESPONSIVE_FIELDS,
    ...STANDARD_ANIMATION_FIELDS,
    ...STANDARD_VISIBILITY_FIELDS,
  ],
};

export const OCCASIONS_GRID_SCHEMA: SectionSchema = {
  type: "occasions_grid",
  name: "Occasions Grid",
  category: "occasions",
  description: "Curated celebration cards categorized by occasion with direct PIM database bindings",
  icon: "🎁",
  version: 1,
  defaults: {
    heading: "Celebrate Every Occasion",
    subheading: "Handcrafted cakes tailored for birthdays, anniversaries, and joyful milestones",
    data_source: "pim",
    occasion_mode: "all_active",
    selected_occasions: [],
    layout: "grid",
    columns: 4,
    show_count: true,
    view_all_text: "View All Occasions →",
    view_all_url: "/occasions",
  },
  capabilities: { motion: true, responsive: true, visibility: true, style: true, pimBinding: "occasions" },
  dataSources: ["manual", "pim_occasions"],
  fields: [
    { key: "heading", label: "Section Heading", type: "text", required: true, defaultValue: "Celebrate Every Occasion" },
    { key: "subheading", label: "Section Subheading", type: "textarea", defaultValue: "Handcrafted cakes tailored for your moments." },
    { key: "data_source", label: "Data Source", type: "select", defaultValue: "pim", options: [
      { value: "pim", label: "PIM Database Occasions (Live)" },
      { value: "manual", label: "Manual Occasion Cards" },
    ]},
    { key: "occasion_mode", label: "Occasion Selection Mode", type: "select", defaultValue: "all_active", options: [
      { value: "all_active", label: "All Active Occasions" },
      { value: "selected", label: "Select Specific Occasions" },
      { value: "featured", label: "Featured Occasions Only" },
    ]},
    { key: "selected_occasions", label: "Chosen Occasions", type: "occasions", hint: "Choose which PIM occasions to display." },
    { key: "layout", label: "Layout Mode", type: "select", defaultValue: "grid", options: [
      { value: "grid", label: "Grid (Standard)" },
      { value: "carousel", label: "Carousel (Horizontal Scroll)" },
    ]},
    { key: "columns", label: "Desktop Columns", type: "number", defaultValue: 4, min: 2, max: 6 },
    { key: "view_all_text", label: "View All Button Text", type: "text", defaultValue: "View All Occasions →" },
    { key: "view_all_url", label: "View All Link URL", type: "url", defaultValue: "/occasions" },
    ...STANDARD_STYLE_FIELDS,
    ...STANDARD_RESPONSIVE_FIELDS,
    ...STANDARD_ANIMATION_FIELDS,
    ...STANDARD_VISIBILITY_FIELDS,
  ],
};

export const PRODUCT_GRID_SCHEMA: SectionSchema = {
  type: "product_grid",
  name: "Product Grid",
  category: "products_pim",
  description: "Dynamic product display connected to live PostgreSQL PIM catalog with advanced filtering and sorting",
  icon: "🏷️",
  version: 1,
  defaults: {
    heading: "Bestselling Cakes",
    subheading: "Our most loved creations, freshly baked upon order",
    data_source: "pim_query",
    mode: "best_sellers",
    limit: 8,
    sort: "best_selling",
    show_image: true,
    show_badge: true,
    show_rating: true,
    show_review_count: true,
    show_description: true,
    show_price: true,
    show_compare_price: true,
    show_weight: true,
    show_flavour: true,
    show_quick_add: true,
    show_wishlist: true,
    show_stock: true,
    columns: 4,
    gap: 24,
  },
  capabilities: { motion: true, responsive: true, visibility: true, style: true, pimBinding: "products" },
  dataSources: ["manual", "pim_products"],
  fields: [
    { key: "heading", label: "Section Heading", type: "text", required: true, defaultValue: "Bestselling Cakes" },
    { key: "subheading", label: "Section Subheading", type: "textarea", defaultValue: "Our most loved creations" },
    { key: "data_source", label: "Product Source", type: "select", defaultValue: "pim_query", options: [
      { value: "pim_query", label: "Live PIM Query (Dynamic)" },
      { value: "manual", label: "Manual Product Selection" },
    ]},
    { key: "mode", label: "PIM Collection Preset", type: "select", defaultValue: "best_sellers", options: [
      { value: "best_sellers", label: "Bestsellers" },
      { value: "new_arrivals", label: "New Arrivals" },
      { value: "featured", label: "Featured" },
      { value: "trending", label: "Trending" },
      { value: "all", label: "All Active Cakes" },
      { value: "category", label: "By Category" },
      { value: "occasion", label: "By Occasion" },
    ]},
    { key: "category_filter", label: "Filter by Category", type: "category" },
    { key: "occasion_filter", label: "Filter by Occasion", type: "occasion" },
    { key: "flavor_filter", label: "Filter by Flavour", type: "flavour" },
    { key: "weight_filter", label: "Filter by Weight", type: "weight" },
    { key: "price_min", label: "Min Price (₹)", type: "number", min: 0 },
    { key: "price_max", label: "Max Price (₹)", type: "number", min: 0 },
    { key: "limit", label: "Product Count Limit", type: "number", defaultValue: 8, min: 1, max: 48 },
    { key: "sort", label: "Sort By", type: "select", defaultValue: "best_selling", options: [
      { value: "best_selling", label: "Bestselling" },
      { value: "newest", label: "Newest First" },
      { value: "price_low_high", label: "Price: Low to High" },
      { value: "price_high_low", label: "Price: High to Low" },
      { value: "rating", label: "Highest Rated" },
    ]},
    { key: "show_image", label: "Show Thumbnail Image", type: "boolean", defaultValue: true },
    { key: "show_badge", label: "Show Dietary/Merch Badges", type: "boolean", defaultValue: true },
    { key: "show_rating", label: "Show Star Rating", type: "boolean", defaultValue: true },
    { key: "show_price", label: "Show Price", type: "boolean", defaultValue: true },
    { key: "show_compare_price", label: "Show Strikethrough Price", type: "boolean", defaultValue: true },
    { key: "show_weight", label: "Show Weight Tag", type: "boolean", defaultValue: true },
    { key: "show_flavour", label: "Show Flavour Label", type: "boolean", defaultValue: true },
    { key: "show_quick_add", label: "Show Quick Add Button", type: "boolean", defaultValue: true },
    { key: "show_wishlist", label: "Show Wishlist Toggle", type: "boolean", defaultValue: true },
    { key: "show_stock", label: "Show Stock Availability", type: "boolean", defaultValue: true },
    { key: "columns", label: "Desktop Columns", type: "number", defaultValue: 4, min: 1, max: 6 },
    ...STANDARD_STYLE_FIELDS,
    ...STANDARD_RESPONSIVE_FIELDS,
    ...STANDARD_ANIMATION_FIELDS,
    ...STANDARD_VISIBILITY_FIELDS,
  ],
};

export const FEATURES_SCHEMA: SectionSchema = {
  type: "features",
  name: "Features / Benefits",
  category: "trust",
  description: "Highlight bakery USPs, trust credentials, fresh guarantee, and artisanal benefits",
  icon: "✨",
  version: 1,
  defaults: {
    heading: "Why Celebrate With CakeToHome",
    subtitle: "We take immense pride in every handcrafted layer, delivering pure joy to your doorstep",
    alignment: "center",
    columns: 4,
    features: [
      {
        id: "feat_1",
        icon: "Sparkles",
        icon_type: "lucide",
        title: "100% Real Dairy Butter",
        description: "Made exclusively with pure dairy cream butter. Zero margarine, zero hydrogenated fats.",
        icon_color: "#e11d48",
      },
      {
        id: "feat_2",
        icon: "Clock",
        icon_type: "lucide",
        title: "Freshly Baked on Order",
        description: "Baking starts only after your order is confirmed. Never frozen, never pre-stocked.",
        icon_color: "#f59e0b",
      },
      {
        id: "feat_3",
        icon: "Truck",
        icon_type: "lucide",
        title: "Midnight & 2-Hour Delivery",
        description: "Temperature-controlled fleet ensures your tiered cakes arrive in pristine, chilled condition.",
        icon_color: "#059669",
      },
      {
        id: "feat_4",
        icon: "ShieldCheck",
        icon_type: "lucide",
        title: "Eggless & Dietary Options",
        description: "Dedicated preparation zones for certified eggless, sugar-free, and vegan bakes.",
        icon_color: "#7c3aed",
      },
    ],
  },
  capabilities: { motion: true, responsive: true, visibility: true, style: true, pimBinding: "none" },
  dataSources: ["manual"],
  fields: [
    { key: "heading", label: "Section Heading", type: "text", required: true, defaultValue: "Why Celebrate With CakeToHome" },
    { key: "subtitle", label: "Section Subtitle", type: "textarea", defaultValue: "We take pride in every handcrafted bake" },
    { key: "alignment", label: "Text Alignment", type: "alignment", defaultValue: "center" },
    { key: "columns", label: "Desktop Columns", type: "select", defaultValue: "4", options: [
      { value: "1", label: "1 Column" },
      { value: "2", label: "2 Columns" },
      { value: "3", label: "3 Columns" },
      { value: "4", label: "4 Columns" },
      { value: "6", label: "6 Columns" },
      { value: "8", label: "8 Columns" },
      { value: "12", label: "12 Columns" },
    ]},
    { key: "features", label: "Feature Items", type: "repeater", itemSchema: FEATURES_ITEM_SCHEMA },
    ...STANDARD_STYLE_FIELDS,
    ...STANDARD_RESPONSIVE_FIELDS,
    ...STANDARD_ANIMATION_FIELDS,
    ...STANDARD_VISIBILITY_FIELDS,
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// CENTRAL SECTION SCHEMAS REGISTRY MAP
// ═══════════════════════════════════════════════════════════════════════════

const CORE_SCHEMAS: Record<string, SectionSchema> = {
  split_hero: SPLIT_HERO_SCHEMA,
  occasions_grid: OCCASIONS_GRID_SCHEMA,
  product_grid: PRODUCT_GRID_SCHEMA,
  features: FEATURES_SCHEMA,
};

/**
 * Retrieve the full formal schema for a given section type.
 * Generates an extensible dynamic schema if a specialized core schema is not mapped.
 */
export function getSectionSchema(type: string, fallbackDefinition?: any): SectionSchema {
  if (CORE_SCHEMAS[type]) {
    return CORE_SCHEMAS[type];
  }

  // Generate generic schema conforming to SectionSchema interface
  return {
    type,
    name: fallbackDefinition?.label || type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
    category: fallbackDefinition?.category || "content_seo",
    description: fallbackDefinition?.description || `Configuration schema for ${type}`,
    icon: fallbackDefinition?.icon || "📝",
    version: 1,
    defaults: fallbackDefinition?.defaultConfig || {},
    capabilities: { motion: true, responsive: true, visibility: true, style: true, pimBinding: "none" },
    dataSources: ["manual"],
    fields: [
      { key: "heading", label: "Heading", type: "text", defaultValue: fallbackDefinition?.defaultConfig?.heading || "" },
      { key: "subheading", label: "Subheading", type: "textarea", defaultValue: fallbackDefinition?.defaultConfig?.subheading || "" },
      ...STANDARD_STYLE_FIELDS,
      ...STANDARD_RESPONSIVE_FIELDS,
      ...STANDARD_ANIMATION_FIELDS,
      ...STANDARD_VISIBILITY_FIELDS,
    ],
  };
}

/**
 * Validate section configuration against required fields, URLs, and data source integrity.
 * Prevents broken configurations from silently publishing.
 */
export function validateSectionConfig(type: string, config: Record<string, any> = {}): ValidationResult {
  const schema = getSectionSchema(type);
  const errors: Array<{ field: string; message: string }> = [];

  for (const field of schema.fields) {
    const val = config[field.key];

    // Check required fields
    if (field.required) {
      if (val === undefined || val === null || (typeof val === "string" && val.trim() === "")) {
        errors.push({
          field: field.key,
          message: `${field.label} is required for section "${schema.name}".`,
        });
      }
    }

    // Check URL syntax when provided
    if (field.type === "url" && val && typeof val === "string") {
      const isRelative = val.startsWith("/") || val.startsWith("#") || val.startsWith("?");
      const isAbsolute = /^https?:\/\//i.test(val);
      if (!isRelative && !isAbsolute) {
        errors.push({
          field: field.key,
          message: `${field.label} must be a valid URL starting with "/" or "http(s)://".`,
        });
      }
    }

    // Check repeater items if present
    if (field.type === "repeater" && Array.isArray(val) && field.itemSchema) {
      val.forEach((item, idx) => {
        field.itemSchema?.forEach((subField) => {
          if (subField.required) {
            const subVal = item?.[subField.key];
            if (subVal === undefined || subVal === null || (typeof subVal === "string" && subVal.trim() === "")) {
              errors.push({
                field: `${field.key}[${idx}].${subField.key}`,
                message: `Item #${idx + 1}: ${subField.label} is required.`,
              });
            }
          }
        });
      });
    }
  }

  return {
    valid: errors.length === 0,
    isValid: errors.length === 0,
    errors,
  };
}

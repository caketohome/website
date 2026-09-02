/**
 * CakeToHome Canonical Domain Types
 * Strict, shared domain types across PostgreSQL, Services, and UI
 */

export interface ProductDomain {
  id: string;
  product_id?: string;
  title: string;
  name?: string;
  handle: string;
  slug?: string;
  description: string;
  short_description?: string;
  thumbnail: string;
  gallery?: string[];
  status: "published" | "draft" | "archived";
  price: number;
  selling_price?: number;
  cost_price?: number;
  mrp?: number;
  rating?: number;
  review_count?: number;
  category: string;
  category_slug?: string;
  primary_category_id?: string;
  secondary_category_ids?: string[];
  category_ids?: string[];
  flavour?: string;
  cake_base?: string;
  filling?: string;
  cream?: string;
  texture?: string;
  weight?: string;
  variants_json?: { weights: string[] };
  add_ons_json?: Record<string, any>;
  tags?: string;
  occasion?: string;
  occasion_ids?: string[];
  brand?: string;
  cake_type?: string;
  gst_rate?: number;
  tax_class?: string;
  tax_configuration_id?: string;
  hsn_code?: string;
  hsn_description?: string;
  uqc?: string;
  taxability?: string;
  tax_inclusive?: boolean;
  is_featured?: boolean;
  is_bestseller?: boolean;
  is_new_arrival?: boolean;
  sugar_free?: boolean;
  gluten_free?: boolean;
  vegan?: boolean;
  daily_capacity?: number;
  shelf_life_days?: number;
  prep_time_minutes?: number;
  seo_title?: string;
  seo_description?: string;
  seo_keywords?: string;
  max_delivery_distance_km?: number | null;
  pim_config?: Record<string, any>;
  flavors?: string[];
  shapes?: string[];
  fillings?: string[];
  creams?: string[];
  weight_prices?: ProductWeightPriceDomain[];
  enable_flavor_selection?: boolean;
  enable_shape_selection?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ProductWeightPriceDomain {
  id?: string;
  product_id?: string;
  weight_name: string;
  normalized_grams?: number;
  multiplier?: number;
  selling_price: number;
  mrp: number;
  cost_price?: number;
  serves_min?: number;
  serves_max?: number;
  is_enabled?: boolean;
}

export interface VariantOptionDomain {
  id: string;
  type: "flavor" | "shape" | "filling" | "cream" | string;
  name: string;
  display_name: string;
  price_modifier: number;
  extra_price?: number;
  additional_price?: number;
  display_order: number;
  status: "active" | "inactive";
  is_enabled: boolean;
  enabled?: boolean;
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface BranchDomain {
  id: string;
  name: string;
  code: string;
  phone: string;
  email: string;
  address: string;
  city_id: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  is_open: boolean;
  is_archived?: boolean;
  status: "active" | "archived";
  operational_status?: "operational" | "paused" | "closed";
  extended_status?: "open" | "busy" | "paused" | "closed";
  branch_type?: "main_hub" | "dark_kitchen" | "express_counter";
  manager_id?: string | null;
  manager_account?: any | null;
  max_delivery_radius_km: number;
  weekly_schedule?: Record<string, any>;
  fulfillment_rules?: {
    allow_pickup?: boolean;
    allow_delivery?: boolean;
    same_day_cutoff?: string; // HH:MM in 24-hr format
    express_cutoff?: string;
    midnight_cutoff?: string;
    prep_time_minutes?: number;
  };
  delivery_zones?: DeliveryZoneDomain[];
  deliverable_areas?: string[];
  capacity_settings?: Record<string, any>;
  product_availability?: Record<string, "available" | "out_of_stock" | "disabled">;
  created_at?: string;
  updated_at?: string;
}

export interface DeliveryZoneDomain {
  id: string;
  branch_id: string;
  pincode?: string;
  name?: string;
  delivery_fee: number;
  base_fee?: number;
  radius_km: number;
  polygon_coordinates?: [number, number][];
  priority?: number;
  estimated_delivery_minutes?: number;
  enabled: boolean;
}

export interface CustomerDomain {
  id: string;
  customer_uid: string;
  first_name: string;
  last_name: string;
  name: string;
  full_name?: string;
  email: string;
  phone: string;
  normalized_phone?: string;
  role: "CUSTOMER" | "ADMIN" | "SUPER_ADMIN" | "BRANCH_MANAGER" | "DELIVERY_PARTNER";
  wallet_balance: number;
  addresses?: CustomerAddressDomain[];
  preferences?: Record<string, any>;
  orders_count?: number;
  total_spend?: number;
  created_at?: string;
  updated_at?: string;
}

export interface CustomerAddressDomain {
  id: string;
  customer_id?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  address_1: string;
  address_2?: string;
  city: string;
  postal_code: string;
  pincode?: string;
  phone: string;
  landmark?: string;
  latitude?: number;
  longitude?: number;
  is_default?: boolean;
  type?: "HOME" | "WORK" | "OTHER";
  label?: string;
}

export interface OrderItemDomain {
  id?: string;
  item_id?: string;
  product_id: string;
  product_name: string; // Historical snapshot
  title?: string;
  thumbnail?: string;
  variant_name?: string;
  weight?: string;
  quantity: number;
  unit_price: number; // Historical snapshot
  price?: number;
  selling_price?: number;
  mrp?: number;
  discount?: number;
  tax_rate?: number;
  tax_amount?: number;
  customization?: {
    eggless?: boolean;
    sugar_free?: boolean;
    message?: string;
    photo_url?: string;
    flavor?: string;
    shape?: string;
    filling?: string;
    cream?: string;
  };
  total_line_amount: number;
}

export interface OrderDomain {
  id: string;
  order_id?: string;
  display_id?: string;
  order_number: string;
  customer_id: string;
  customer_uid: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  branch_id: string;
  branch_name?: string;
  total_amount: number;
  total?: number;
  subtotal?: number;
  discount_amount?: number;
  tax_amount?: number;
  delivery_fee?: number;
  currency: string;
  status: "pending" | "confirmed" | "preparing" | "ready_for_pickup" | "out_for_delivery" | "delivered" | "cancelled";
  payment_status: "pending" | "authorized" | "captured" | "failed" | "refunded";
  payment_method: "cash" | "card" | "upi" | "wallet" | "cod" | "online";
  delivery: {
    type: "standard" | "express" | "midnight" | "pickup";
    date: string; // YYYY-MM-DD
    slot: string; // e.g. "18:00 - 20:00"
    fee: number;
  };
  delivery_address?: CustomerAddressDomain;
  delivery_latitude?: number | null;
  delivery_longitude?: number | null;
  delivery_partner_id?: string | null;
  delivery_partner_name?: string | null;
  items: OrderItemDomain[];
  created_at: string;
  updated_at: string;
}

export interface CmsPageDomain {
  id: string;
  slug: string;
  title: string;
  type: "landing" | "policy" | "info" | "campaign";
  status: "draft" | "published" | "archived";
  meta_title: string;
  meta_description: string;
  canonical_url: string;
  og_image: string;
  sections: any[];
  draft_config?: Record<string, any>;
  published_config?: Record<string, any> | null;
  version_history?: any[];
  created_at: string;
  updated_at: string;
  published_at?: string | null;
}

export interface OfferDomain {
  id: string;
  name: string;
  code: string;
  type: "flat" | "percentage";
  discount_type?: "flat" | "percentage";
  discount_value: number;
  min_order: number;
  min_order_value?: number;
  max_discount_value?: number | null;
  is_active: boolean;
  status?: "active" | "inactive";
  description?: string;
  rules?: Record<string, any>;
  starts_at?: string;
  ends_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CustomerFavoriteDomain {
  id: string;
  customer_uid: string;
  product_id: string;
  created_at: string;
}

export interface ProductReviewDomain {
  id: string;
  product_id: string;
  customer_uid: string;
  customer_id?: string;
  customer_name: string;
  order_id?: string | null;
  order_item_id?: string | null;
  rating: number;
  title?: string;
  review_text?: string;
  body?: string;
  purchased_variant?: string | null;
  is_verified_purchase: boolean;
  verified_purchase?: boolean;
  status: "PENDING" | "APPROVED" | "REJECTED" | "HIDDEN";
  admin_response?: {
    author?: string;
    message: string;
    responded_at: string;
  } | null;
  reply?: string | null;
  replied_at?: string | null;
  helpful_votes?: number;
  created_at: string;
  updated_at: string;
  published_at?: string | null;
}

export const DEFAULT_FEATURE_FLAGS: Record<string, boolean> = {
  customer_accounts: true,
  cms: true,
  homepage_builder: true,
  seo: true,
  blog: true,
  dynamic_navigation: true,
  product_meta: true,
  reviews: true,
  wishlist: true,
  subscriptions: true,
  product_videos: true,
  custom_cakes: true,
  delivery_slots: true,
  pincode_zones: true,
  kds_pipeline: true,
  driver_fleet: true,
  wallet_loyalty: true,
  crm_campaigns: true,
  security_audit: true,
};

export const SETTING_GROUPS = {
  GENERAL: "general",
  FEATURE_FLAGS: "feature_flags",
  DELIVERY: "delivery",
  PAYMENT: "payment",
  NOTIFICATIONS: "notifications",
} as const;

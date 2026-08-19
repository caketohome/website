/**
 * CakeToHome — Enterprise Customer CRM & Identity Types
 * Comprehensive data contracts for customer identity, dynamic lifecycles,
 * customer 360 profile views, dynamic segmentation, communications telemetry,
 * multi-city branch mapping, and live business analytics.
 */

// ── 1. Customer Lifecycle & Tier Classifications ──────────────────────────────
export type CustomerLifecycleStage =
  | "NEW"            // Registered account with 0 completed orders
  | "FIRST_PURCHASE" // Exactly 1 completed order
  | "REPEAT_BUYER"   // 2+ completed orders (frequent re-engagement)
  | "VIP"            // High lifetime spend (₹5,000+) or high order frequency
  | "AT_RISK"        // Previously active, but zero orders in configured days (e.g. >45 days)
  | "DORMANT";       // Zero activity or orders in configured days (e.g. >90 days)

export type CustomerTier = "STANDARD" | "SILVER" | "GOLD" | "VIP_PLATINUM";

export type CustomerCartStatus = "NO_CART" | "ACTIVE_CART" | "ABANDONED_CART" | "RECOVERED";

// ── 2. Real Communication & Consent States ──────────────────────────────────
export type WhatsAppStatus =
  | "CONNECTED"   // Verified 10-digit phone with active WhatsApp delivery handshake
  | "OPTED_IN"    // Customer consented to WhatsApp transactional & marketing updates
  | "OPTED_OUT"   // Customer explicitly unsubscribed from WhatsApp outreach
  | "INVALID"     // Number format invalid or WhatsApp API delivery rejection
  | "UNKNOWN";    // Unprobed / pending verification

export type ConsentStatus = "SUBSCRIBED" | "UNSUBSCRIBED" | "UNKNOWN";

export interface CustomerConsent {
  whatsapp_status: WhatsAppStatus;
  whatsapp_opt_in: boolean;
  marketing_email: ConsentStatus;
  marketing_sms: ConsentStatus;
  marketing_whatsapp: ConsentStatus;
  transactional: "SUBSCRIBED";
  opt_in_timestamp?: string;
  updated_at: string;
}

// ── 3. Contact Channels & Location Scopes ────────────────────────────────────
export interface CustomerAddress {
  id?: string;
  address_1: string;
  address_2?: string;
  landmark?: string;
  city: string;
  city_id?: string;
  state?: string;
  postal_code: string;
  is_default?: boolean;
  type?: "HOME" | "OFFICE" | "OTHER";
}

export interface CustomerNote {
  id: string;
  customer_uid: string;
  author_id: string;
  author_name: string;
  content: string;
  category: "GENERAL" | "DELIVERY_PREFERENCE" | "COMPLAINT" | "VIP_REQUEST" | "RECOVERY" | "OCCASION_REMINDER";
  created_at: string;
  updated_at?: string;
}

// ── 4. Canonical Customer Entity (Database & API Contract) ───────────────────
export interface CustomerRecord {
  id: string;
  customer_uid: string; // Canonical persistent ID (e.g. cth_cus_9876543210)
  customer_number: string; // Display number (e.g. CTH-CUST-000101)
  name: string;
  first_name?: string;
  last_name?: string;
  phone: string;
  normalized_phone: string; // 10-digit Indian standard
  email?: string;
  normalized_email?: string;
  whatsapp_number?: string;
  account_id?: string; // Linked Auth User ID
  customer_type: "guest" | "registered" | "corporate";
  customer_source: string; // "STOREFRONT" | "ORGANIC" | "GOOGLE_ADS" | "REFERRAL" | "ADMIN_PORTAL"
  
  // Dynamic Lifecycle & Classification
  lifecycle_stage: CustomerLifecycleStage;
  tier: CustomerTier;
  is_vip: boolean;
  repeat_customer: boolean;
  risk_score: number; // 0 (healthy) to 100 (high churn risk)
  customer_intelligence_score?: number;
  assigned_telecaller_id?: string;
  assigned_telecaller_name?: string;

  // Real Financial & Order Metrics (Computed from database orders)
  orders_count: number;
  total_orders?: number;
  total_spend: number;
  total_revenue?: number;
  aov: number; // Average Order Value
  first_purchase_date?: string | null;
  first_order_at?: string | null;
  last_order_at?: string | null;
  last_order_date?: string | null;

  // Session & Activity Timestamps
  created_at: string;
  updated_at: string;
  last_active_at: string;
  last_login_at?: string | null;
  last_cart_activity_at?: string | null;

  // Cart Status
  cart_status: CustomerCartStatus;
  active_cart_id?: string | null;
  active_cart_value?: number;

  // Authoritative Multi-City & Branch Assignment (Dynamically resolved)
  assigned_branch_id?: string;
  branch_id?: string;
  branch_name?: string;
  preferred_store?: string;
  city_id?: string;
  city_name?: string;
  delivery_pincode?: string;
  delivery_zone?: string;

  // Sub-Entities & Consents
  addresses: CustomerAddress[];
  notes: CustomerNote[];
  tags: string[];
  consent: CustomerConsent;
  loyalty?: CustomerLoyalty;

  // Deduplication & Identity Merging
  merged_into_uid?: string;
  merged_uids?: string[];

  // Profile extensions
  full_name?: string;
  profile_image?: string;
  date_of_birth?: string | null;
  preferences?: CustomerPreferences;
}

export interface CustomerStatsDTO {
  orders: number;
  total_spent: number;
  favourite_cake?: string;
  last_order_date?: string | null;
}

export interface CustomerPreferences {
  favourite_flavour?: string;
  whatsapp_notifications?: boolean;
  sms_notifications?: boolean;
  marketing_emails?: boolean;
}

export interface CustomerProfileDTO {
  id: string;
  customer_uid: string;
  full_name: string;
  name: string;
  first_name: string;
  last_name: string;
  phone: string;
  normalized_phone: string;
  email: string;
  profile_image?: string;
  date_of_birth?: string | null;
  tier: string;
  lifecycle_stage: string;
  created_at: string;
  updated_at: string;
  last_login_at?: string | null;
  stats: CustomerStatsDTO;
  addresses: CustomerAddress[];
  preferences?: CustomerPreferences;
}

// ── 5. Real Communication & Interaction Log ─────────────────────────────────
export interface CrmCommunicationLog {
  id: string;
  customer_uid: string;
  channel: "WHATSAPP" | "SMS" | "EMAIL" | "PHONE_CALL";
  direction: "OUTBOUND" | "INBOUND";
  template_name?: string;
  subject_or_title: string;
  body_preview: string;
  status: "SENT" | "DELIVERED" | "READ" | "FAILED" | "REPLIED" | "CLICKED";
  dispatched_at: string;
  delivered_at?: string | null;
  read_at?: string | null;
  error_message?: string | null;
  metadata?: Record<string, any>;
  campaign_id?: string;
}

// ── 6. Activity Timeline Events ──────────────────────────────────────────────
export type ActivityEventType =
  | "ACCOUNT_CREATED"
  | "OTP_REQUESTED"
  | "OTP_VERIFIED"
  | "LOGIN"
  | "LOGOUT"
  | "PRODUCT_VIEWED"
  | "CATEGORY_VIEWED"
  | "CART_CREATED"
  | "CART_ITEM_ADDED"
  | "CART_ITEM_REMOVED"
  | "CART_UPDATED"
  | "CHECKOUT_STARTED"
  | "ADDRESS_ENTERED"
  | "PAYMENT_STARTED"
  | "PAYMENT_INITIATED"
  | "PAYMENT_FAILED"
  | "ORDER_PLACED"
  | "ORDER_CONFIRMED"
  | "ORDER_DELIVERED"
  | "ORDER_CANCELLED"
  | "ORDER_REFUNDED"
  | "COUPON_APPLIED"
  | "COMMUNICATION_SENT"
  | "RECOVERY_MESSAGE_SENT"
  | "RECOVERY_LINK_CLICKED"
  | "CART_RECOVERED"
  | "CALL_INITIATED"
  | "NOTE_ADDED"
  | "TAG_ADDED"
  | "CUSTOMER_MERGED";

export interface CustomerActivityEvent {
  id: string;
  customer_uid: string;
  event_type: ActivityEventType;
  title: string;
  description?: string;
  source: "STOREFRONT" | "ADMIN_CRM" | "AUTOMATION" | "SYSTEM";
  staff_id?: string;
  staff_name?: string;
  branch_id?: string;
  city_id?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

// ── 7. Customer 360 Complete Profile Contract (12 Sections) ─────────────────
export interface CustomerProductPurchased {
  product_id: string;
  title: string;
  variant_title?: string;
  total_quantity: number;
  total_spend: number;
  first_bought_at: string;
  last_bought_at: string;
  category_name?: string;
}

export interface CustomerFavoriteCategory {
  category_id?: string;
  category_name: string;
  order_count: number;
  total_spend: number;
}

export interface CustomerPaymentRecord {
  order_id: string;
  order_number: string;
  amount: number;
  currency: string;
  payment_method: string;
  gateway: "RAZORPAY" | "STRIPE" | "UPI" | "COD" | "WALLET";
  gateway_transaction_id?: string;
  status: "PAID" | "PENDING" | "FAILED" | "REFUNDED";
  created_at: string;
}

export interface CustomerDeliveryRecord {
  order_id: string;
  order_number: string;
  branch_id: string;
  branch_name: string;
  rider_name?: string;
  rider_phone?: string;
  delivery_status: "DELIVERED" | "OUT_FOR_DELIVERY" | "CONFIRMED" | "CANCELLED";
  pickup_otp?: string;
  delivery_otp?: string;
  delivered_at?: string | null;
  customer_rating?: number;
}

export interface CustomerProfile extends CustomerRecord {
  // 1. Core Orders & Transactions
  orders: any[];
  payment_history: CustomerPaymentRecord[];
  delivery_history: CustomerDeliveryRecord[];
  
  // 2. Purchased Catalog Insights
  products_purchased: CustomerProductPurchased[];
  favorite_categories: CustomerFavoriteCategory[];

  // 3. Cart & Recovery
  carts: any[];
  abandoned_carts: any[];
  recovery_attempts: any[];

  // 4. Communication & Engagement Telemetry
  communication_history: CrmCommunicationLog[];
  activity_timeline: CustomerActivityEvent[];
  reorder_opportunities: any[];
  reorder_opportunity?: any;
  journey_funnel?: {
    visited: boolean;
    registered: boolean;
    product_viewed: boolean;
    cart_added: boolean;
    checkout_started: boolean;
    payment_started: boolean;
    order_completed: boolean;
  };

  // 5. Financial & Recency Analytics
  financial_summary: {
    lifetime_value: number;
    average_order_value: number;
    total_orders_completed: number;
    days_since_last_order: number | null;
    order_frequency_days: number | null;
    first_order_date: string | null;
    last_order_date: string | null;
  };

  // 6. Purchase Intelligence & Behavioral Insights
  customer_intelligence_score?: number; // 0-100 score combining RFM, engagement, and conversion speed
  retention_score?: number;             // 0-100 retention confidence score
  winback_probability?: number;         // 0-100 winback success likelihood
  next_expected_purchase_date?: string | null;
  favourite_flavours?: string[];
  favourite_cakes?: string[];
  average_order_size_items?: number;
  top_occasions?: string[];

  // 7. Full Data Lineage & Audit Traceability
  data_lineage?: CustomerDataLineage;

  // 8. Staff Reminders & Scheduled Follow-Ups
  reminders?: CustomerFollowUpReminder[];
  assigned_telecaller_id?: string;
  assigned_telecaller_name?: string;
}

// ── 7B. Customer Data Lineage Trace Contract ─────────────────────────────────
export interface CustomerDataLineage {
  customer_uid: string;
  customer_name: string;
  origin_source: "STOREFRONT" | "CHECKOUT" | "ADMIN_MANUAL" | "IMPORTED" | "OTP_VERIFICATION";
  account_created_at: string;
  initial_checkout_order_id?: string;
  initial_checkout_order_number?: string;

  // Convenience flat properties
  customer_source?: string;
  registered_at?: string;
  total_orders_count?: number;
  most_recent_order_id?: string;
  payment_gateway?: string;
  captured_payments_count?: number;
  lifetime_captured_inr?: number;
  latest_payment_method?: string;
  payment_status?: string;
  assigned_branch_name?: string;
  city_name?: string;
  primary_pincode?: string;
  routing_method?: string;
  successful_deliveries_count?: number;
  latest_delivery_partner_name?: string;
  latest_delivery_status?: string;
  whatsapp_messages_delivered?: number;
  sms_dispatched?: number;
  calls_logged?: number;

  payment_gateway_summary?: {
    primary_gateway: "RAZORPAY" | "STRIPE" | "UPI" | "COD" | "WALLET";
    total_captured_transactions: number;
    latest_transaction_id?: string;
    latest_payment_status?: string;
  };
  fulfillment_hub_summary?: {
    assigned_branch_id: string;
    assigned_branch_name: string;
    city_name: string;
    delivery_pincode: string;
    matching_method: "DEFAULT_ADDRESS" | "ORDER_HISTORY" | "ACTIVE_HUB_FALLBACK";
  };
  delivery_fulfillment_summary?: {
    total_delivered_orders: number;
    latest_rider_name?: string;
    latest_delivery_otp?: string;
    latest_delivered_at?: string | null;
  };
  communication_audit_summary?: {
    total_whatsapp_messages: number;
    whatsapp_delivered_count: number;
    whatsapp_read_count: number;
    total_sms_sent: number;
    total_emails_sent: number;
    total_calls_logged: number;
    opt_in_status: WhatsAppStatus;
  };
}

// ── 7C. Staff Follow-Up & Action Contracts ──────────────────────────────────
export interface CustomerFollowUpReminder {
  id: string;
  customer_uid: string;
  customer_name: string;
  customer_phone: string;
  due_date: string; // ISO string
  due_time?: string;
  reason: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  assigned_staff_id?: string;
  assigned_staff_name?: string;
  status: "PENDING" | "COMPLETED" | "CANCELLED";
  created_at: string;
  completed_at?: string;
}

export interface CustomerStaffAction {
  id: string;
  customer_uid: string;
  action_type: "ASSIGN_TELECALLER" | "SCHEDULE_REMINDER" | "ADD_NOTE" | "UPDATE_CONSENT" | "MERGE_IDENTITY";
  staff_id: string;
  staff_name: string;
  details: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

// ── 8. Dynamic Segmentation Models ──────────────────────────────────────────
export interface AdvancedFilterRule {
  field:
    | "orders_count"
    | "total_spend"
    | "aov"
    | "lifecycle_stage"
    | "tier"
    | "cart_status"
    | "whatsapp_status"
    | "branch_id"
    | "city_id"
    | "city_name"
    | "days_since_last_order"
    | "days_since_registered"
    | "occasion"
    | "product_purchased"
    | "tag";
  operator: "equals" | "not_equals" | "greater_than" | "less_than" | "contains" | "in";
  value: any;
}

export interface CustomerSegment {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon?: string;
  combinator: "AND" | "OR";
  rules: AdvancedFilterRule[];
  conditions_json?: string;
  is_system: boolean;
  active?: boolean;
  created_by?: string;
  customer_count?: number;
  created_at: string;
  updated_at?: string;
}

// ── 8B. Real Database CRM Health Report Contract ─────────────────────────────
export interface CrmHealthReport {
  total_customers: number;
  customers_with_orders: number;
  customers_without_orders: number;
  duplicate_rate: string;
  missing_branch_mapping: number;
  missing_phone: number;
  healthy: boolean;
  environment_mode: "development" | "production";
  database_driver: "postgres" | "json-fallback";
  generated_at: string;
}

// ── 9. Configurable Lifecycle Rules Engine ──────────────────────────────────
export interface CrmLifecycleConfig {
  at_risk_days_threshold: number; // e.g. 45 days without order
  dormant_days_threshold: number; // e.g. 90 days without activity/order
  vip_min_spend: number;          // e.g. ₹5,000 lifetime spend
  vip_min_orders: number;         // e.g. 5 completed orders
  repeat_buyer_min_orders: number;// e.g. 2 completed orders
  new_customer_max_days: number;  // e.g. 7 days since registration
  updated_at: string;
}

export const DEFAULT_LIFECYCLE_CONFIG: CrmLifecycleConfig = {
  at_risk_days_threshold: 45,
  dormant_days_threshold: 90,
  vip_min_spend: 5000,
  vip_min_orders: 5,
  repeat_buyer_min_orders: 2,
  new_customer_max_days: 7,
  updated_at: "2026-08-01T00:00:00.000Z",
};

// ── 10. Live CRM Analytics Data Contract ─────────────────────────────────────
export interface CrmAnalyticsSummary {
  total_customers: number;
  active_customers: number;
  new_customers_this_month: number;
  repeat_purchase_rate_pct: number;
  average_customer_ltv: number;
  vip_customers_count: number;
  at_risk_customers_count: number;
  dormant_customers_count: number;
  whatsapp_reachable_count: number;
  whatsapp_opted_out_count: number;
  segment_revenue_breakdown: Record<string, number>;
  lifecycle_breakdown: Record<CustomerLifecycleStage, number>;
  tier_breakdown: Record<CustomerTier, number>;
  city_breakdown: Record<string, number>;
  generated_at: string;
}

export interface CustomerLoyalty {
  points_balance: number;
  points_earned: number;
  points_redeemed: number;
  tier: CustomerTier;
  last_updated: string;
}

export interface AbandonedCartRecord {
  id: string;
  cart_id: string;
  customer_uid?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  items_count: number;
  items: Array<{
    product_id: string;
    product_name: string;
    variant_title?: string;
    unit_price: number;
    quantity: number;
    total_price: number;
    thumbnail?: string;
    cake_message?: string;
  }>;
  subtotal: number;
  discount_total: number;
  tax_total: number;
  delivery_fee: number;
  grand_total: number;
  branch_id?: string;
  branch_name?: string;
  city_id?: string;
  city_name?: string;
  delivery_pincode?: string;
  delivery_date?: string;
  delivery_slot?: string;
  status:
    | "NEW"
    | "ELIGIBLE"
    | "CONTACTED"
    | "MESSAGE_SENT"
    | "MESSAGE_DELIVERED"
    | "MESSAGE_CLICKED"
    | "RECOVERY_STARTED"
    | "RECOVERED"
    | "EXPIRED"
    | "OPTED_OUT";
  abandoned_at: string;
  last_activity_at: string;
  last_contact_at?: string | null;
  last_recovery_channel?: "WHATSAPP" | "SMS" | "EMAIL" | "PHONE" | null;
  recovery_attempts_count: number;
  recovery_token?: string;
  recovery_order_id?: string;
  recovered_at?: string | null;
  drop_reason?: string;
  whatsapp_eligible: boolean;
  created_at: string;
  updated_at: string;
}

// ── 11. Customer Deduplication Models ────────────────────────────────────────
export interface DuplicateMatchReason {
  field: "phone" | "email" | "name" | "account_id";
  primary_value: string;
  duplicate_value: string;
  weight: number;
}

export interface CustomerDuplicateCandidate {
  id: string;
  primary_customer: CustomerRecord;
  duplicate_customer: CustomerRecord;
  customer_a?: CustomerRecord;
  customer_b?: CustomerRecord;
  matching_fields?: string[];
  match_reasons?: any;
  confidence_score: number;
  match_details: DuplicateMatchReason[];
  recommended_action: "AUTO_MERGE" | "MANUAL_REVIEW" | "IGNORE";
  status: "PENDING" | "MERGED" | "DISMISSED";
  detected_at: string;
}

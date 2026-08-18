/**
 * CakeToHome — Enterprise CRM & Customer Lifecycle Types
 */

export type CustomerLifecycleStage =
  | "NEW"               // Just created, no orders, < 7 days old
  | "REGISTERED"        // Account registered, exploring catalog
  | "FIRST_PURCHASE"    // Exactly 1 completed order
  | "ACTIVE"            // 2+ orders, active in last 30 days
  | "REPEAT_BUYER"      // 3+ orders, frequent reordering
  | "LOYAL"             // High spend (₹5,000+) or VIP tier
  | "AT_RISK"           // Previously active, no order in 45-90 days
  | "DORMANT";          // No activity/orders in 90+ days

export type CustomerTier = "STANDARD" | "SILVER" | "GOLD" | "VIP_PLATINUM";

export type CustomerCartStatus = "NO_CART" | "ACTIVE_CART" | "ABANDONED_CART" | "RECOVERED";

export type WhatsAppEligibility = "ELIGIBLE" | "OPTED_OUT" | "UNAVAILABLE" | "NOT_CONFIGURED";

export type ConsentStatus = "SUBSCRIBED" | "UNSUBSCRIBED" | "UNKNOWN";

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
  category?: "GENERAL" | "DELIVERY_PREFERENCE" | "COMPLAINT" | "VIP_REQUEST" | "RECOVERY";
  created_at: string;
  updated_at?: string;
}

export interface CustomerLoyalty {
  points_balance: number;
  points_earned: number;
  points_redeemed: number;
  tier: CustomerTier;
  last_updated: string;
}

export interface CustomerConsent {
  whatsapp_status: WhatsAppEligibility;
  marketing_email: ConsentStatus;
  marketing_sms: ConsentStatus;
  marketing_whatsapp: ConsentStatus;
  transactional: "SUBSCRIBED";
  updated_at: string;
}

export interface CustomerRecord {
  id: string;
  customer_uid: string; // Canonical stable identifier (e.g. cth_cus_001)
  customer_number: string; // Display number (e.g. CTH-CUST-000101)
  name: string;
  first_name?: string;
  last_name?: string;
  phone: string;
  normalized_phone: string; // 10-digit clean string
  email?: string;
  normalized_email?: string;
  account_id?: string; // Linked Auth User ID
  customer_type: "guest" | "registered" | "corporate";
  lifecycle_stage: CustomerLifecycleStage;
  tier: CustomerTier;
  is_vip: boolean;

  // Order & Financial Stats
  orders_count: number;
  total_spend: number;
  aov: number;
  first_order_at?: string | null;
  last_order_at?: string | null;

  // Activity & Session Tracking
  created_at: string;
  updated_at: string;
  last_active_at: string;
  last_login_at?: string | null;
  last_cart_activity_at?: string | null;

  // Cart Status
  cart_status: CustomerCartStatus;
  active_cart_id?: string | null;
  active_cart_value?: number;

  // Location / Context
  branch_id?: string;
  branch_name?: string;
  city_id?: string;
  city_name?: string;
  delivery_pincode?: string;

  // Sub-resources
  addresses: CustomerAddress[];
  notes: CustomerNote[];
  tags: string[];
  loyalty: CustomerLoyalty;
  consent: CustomerConsent;

  // Attribution
  acquisition_channel?: string;
  merged_into_uid?: string; // If merged into another customer
  merged_uids?: string[]; // Child UIDs merged into this record
}

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
  | "POPUP_DISPLAYED"
  | "POPUP_CLICKED"
  | "RECOVERY_MESSAGE_SENT"
  | "RECOVERY_MESSAGE_DELIVERED"
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

export interface CustomerJourneyFunnel {
  visited: boolean;
  registered: boolean;
  product_viewed: boolean;
  cart_added: boolean;
  checkout_started: boolean;
  payment_started: boolean;
  order_completed: boolean;
  last_funnel_step?: string;
  drop_off_reason?: string;
}

export interface CustomerProfile extends CustomerRecord {
  orders: any[];
  carts: any[];
  abandoned_carts: any[];
  activity_timeline: CustomerActivityEvent[];
  journey_funnel: CustomerJourneyFunnel;
  recovery_attempts: any[];
  reorder_opportunity?: any;
  reorder_opportunities?: any[];
}

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
  match_reasons: any;
  match_details?: DuplicateMatchReason[];
  confidence_score: number; // 0 to 100
  recommended_action: "AUTO_MERGE" | "MANUAL_REVIEW" | "IGNORE";
  status: "PENDING" | "MERGED" | "DISMISSED";
  detected_at: string;
}

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
    | "days_since_last_order"
    | "days_since_registered"
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
  is_system: boolean;
  customer_count?: number;
}

export interface CrmAnalyticsSummary {
  total_customers: number;
  active_customers: number;
  new_customers_this_week: number;
  new_customers_this_month: number;
  new_customers_no_order: number;
  first_time_buyers: number;
  repeat_customers: number;
  high_value_customers: number;
  at_risk_customers: number;
  dormant_customers: number;
  whatsapp_contactable: number;
  total_customer_spend: number;
  overall_aov: number;
  lifecycle_breakdown: Record<CustomerLifecycleStage, number>;
  tier_breakdown: Record<CustomerTier, number>;
  acquisition_breakdown: Record<string, number>;
  date_range: {
    start: string;
    end: string;
    preset: string;
  };
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
    eggless?: boolean;
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

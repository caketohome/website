/**
 * CakeToHome Enterprise Abandoned Cart Recovery Types & Contracts
 * Comprehensive data contracts for cart abandonment detection, recovery campaigns,
 * multi-channel communication events, revenue attribution, dynamic KPIs, and CRM sync.
 */

export type AbandonedCartStatus =
  | "ACTIVE"            // Freshly abandoned cart (within recovery window)
  | "RECOVERY_PENDING"   // Scheduled for automated recovery outreach
  | "MESSAGE_SENT"       // Outreach message (WhatsApp/SMS/Email) dispatched
  | "CLICKED"            // Customer clicked recovery link / restored cart
  | "RECOVERED"          // Customer completed checkout / order placed
  | "EXPIRED"            // Past maximum recovery threshold (e.g. >7 days)
  | "FAILED";            // Outreach failed or cart marked irrecoverable

export type RecoveryChannel = "WHATSAPP" | "SMS" | "EMAIL" | "TELECALLER" | "SYSTEM";

export type RecoveryEventType =
  | "cart.abandoned"
  | "message.sent"
  | "message.delivered"
  | "message.clicked"
  | "checkout.started"
  | "order.created"
  | "cart.recovered"
  | "telecaller.assigned";

export interface AbandonedCartItem {
  id: string;
  product_id: string;
  variant_id?: string;
  title: string;
  name?: string;
  thumbnail?: string;
  unit_price: number;
  price?: number;
  quantity: number;
  total_price: number;
  subtotal?: number;
  weight?: string;
  shape?: string;
  flavour?: string;
  cake_message?: string | null;
  eggless?: boolean;
  selected_addons?: any[];
  special_instructions?: string | null;
}

export interface AbandonedCartRecord {
  id: string;
  cart_uid: string;
  customer_uid?: string | null;
  session_id: string;
  customer_name: string;
  phone: string;
  normalized_phone?: string;
  email: string;
  items: AbandonedCartItem[];
  items_json?: string;
  cart_value: number;
  currency: string;
  branch_id: string;
  branch_name: string;
  city_id?: string;
  city: string;
  status: AbandonedCartStatus;
  recovery_status?: string;
  abandoned_at: string;
  recovered_order_id?: string | null;
  recovered_revenue: number;
  recovery_attempt_count: number;
  last_recovery_at?: string | null;
  recovery_token?: string;
  recovery_channel?: RecoveryChannel | null;
  campaign_id?: string | null;
  assigned_telecaller_id?: string | null;
  assigned_telecaller_name?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  last_activity_at?: string;
}

export interface RecoveryCampaign {
  id: string;
  name: string;
  trigger_type: "TIME_DELAY" | "CART_VALUE" | "CUSTOMER_TIER";
  delay_minutes: number;
  channel: RecoveryChannel;
  template_id: string;
  discount_rule: {
    code: string;
    discount_pct: number;
    max_discount?: number;
  } | string | null;
  min_cart_value?: number | null;
  customer_tier?: string | null;
  active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface RecoveryEvent {
  id: string;
  cart_id: string;
  customer_uid?: string | null;
  event_type: RecoveryEventType;
  channel: RecoveryChannel;
  message: string;
  status: "SUCCESS" | "DELIVERED" | "CLICKED" | "PENDING" | "FAILED";
  provider_response?: any;
  created_at: string;
}

export interface AbandonedCartMetrics {
  total_abandoned: number;
  active_abandoned: number;
  revenue_at_risk: number;
  recovered_revenue: number;
  lost_revenue: number;
  recovered_count: number;
  recovery_rate_pct: number;
  average_cart_value: number;
  average_recovery_time_minutes: number;
  whatsapp_reachable_count: number;
}

export interface RecoveryFunnelStep {
  step: string;
  label: string;
  count: number;
  value?: number;
  percentage: number;
  conversion_rate_pct?: number;
  drop_off_percentage: number;
}

export interface RecoveryChannelPerformance {
  channel: RecoveryChannel;
  messages_sent: number;
  clicks: number;
  recovered_orders: number;
  recovered_revenue: number;
  conversion_rate_pct: number;
  sent_count?: number;
  delivered_count?: number;
  clicked_count?: number;
  recovered_count?: number;
  recovery_rate_pct?: number;
}

export interface TopAbandonedProduct {
  product_id: string;
  title: string;
  thumbnail?: string;
  abandoned_count: number;
  recovered_count?: number;
  revenue_at_risk?: number;
  total_lost_revenue: number;
  recovery_rate_pct?: number;
  unit_price: number;
}

export interface RecoveryAttributionRecord {
  cart_id: string;
  recovered_order_id: string;
  recovered_revenue: number;
  recovery_channel: RecoveryChannel;
  campaign_id?: string | null;
  message_id?: string | null;
  conversion_time: string;
  time_to_recover_minutes: number;
}

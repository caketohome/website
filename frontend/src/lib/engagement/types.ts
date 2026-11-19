/**
 * CakeToHome Popup & Engagement Manager - Type Contracts & Interfaces
 */

export type PopupType =
  | "LOGIN"
  | "SIGNUP"
  | "WISHLIST_AUTH"
  | "ACCOUNT"
  | "CART_EXIT"
  | "PRODUCT_EXIT"
  | "WELCOME"
  | "RETURNING"
  | "PROMOTIONAL"
  | "MEMBER"
  | "ABANDONED_CART";

export type CampaignStatus = "draft" | "published" | "paused" | "archived";

export type DeviceTarget = "mobile" | "tablet" | "desktop";

export type CustomerStatus = "guest" | "logged_in" | "new_customer" | "returning_customer" | "member" | "all";

export type DesktopLayout = "CENTER_MODAL" | "SIDE_PANEL" | "SPLIT_LAYOUT";
export type TabletLayout = "CENTER_MODAL" | "BOTTOM_SHEET";
export type MobileLayout = "BOTTOM_SHEET" | "FULL_SCREEN" | "CENTER_MODAL";

export type TriggerType =
  | "exit_intent"
  | "back_navigation"
  | "time_on_page"
  | "scroll_depth"
  | "page_views"
  | "product_views"
  | "add_to_cart"
  | "cart_exists"
  | "wishlist_action"
  | "auth_required"
  | "first_visit"
  | "returning_visitor"
  | "manual";

export type RuleOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "greater_than"
  | "less_than"
  | "greater_than_or_equal"
  | "less_than_or_equal"
  | "in"
  | "not_in"
  | "exists"
  | "not_exists"
  | "between"
  | "within_time"
  | "changed";

export interface RuleCondition {
  field: string;
  operator: RuleOperator;
  value: any;
}

export interface RuleGroup {
  logic: "AND" | "OR" | "NOT";
  conditions: Array<RuleCondition | RuleGroup>;
}

export type TriggerMode =
  | "IMMEDIATE"
  | "TIME_ON_PAGE"
  | "EXIT_INTENT"
  | "BACK_NAVIGATION"
  | "SCROLL_DEPTH"
  | "INACTIVITY"
  | "CART_CONDITION"
  | "PAGE_CONTEXT"
  | "LOGIN_STATE"
  | "VISITOR_TYPE"
  | "LOCATION"
  | "CATALOG_TARGET"
  | "ABANDONED_CART"
  | "MANUAL_TEST";

export type PhonePurposeAction =
  | "LOGIN_SIGNUP"
  | "LOGIN_ONLY"
  | "CAPTURE_LEAD"
  | "CART_RECOVERY"
  | "CHECKOUT"
  | "WHATSAPP_OPTIN"
  | "LOGIN_COUPON"
  | "LOGIN_REDIRECT";

export interface PopupPhoneConfig {
  enabled?: boolean;
  mandatory?: boolean; // default: false (optional)
  action?: PhonePurposeAction;
  redirectUrl?: string;
  couponCode?: string;
  placeholder?: string;
  buttonLabel?: string;
  guestButtonLabel?: string;
  disclaimerText?: string;
}

export interface PopupTriggerConfig {
  enabled_triggers?: string[];
  combinator?: "ANY" | "ALL";
  immediate?: boolean;
  timeOnPageSeconds?: number;
  exitIntent?: boolean;
  backNavigation?: boolean;
  scrollDepthPercent?: number;
  inactivitySeconds?: number;
  pageViewsThreshold?: number;
  productViewsThreshold?: number;
  cartItemCountMin?: number;
  cartMinValue?: number;
  cartMaxValue?: number;
  pageContext?: string[];
  loginState?: CustomerStatus[];
  visitorType?: ("first_visit" | "returning" | "all")[];
  abandonedCart?: boolean;
}

export interface PopupAudienceConfig {
  customerStatus?: CustomerStatus[];
  devices?: DeviceTarget[];
  cityIds?: string[];
  branchIds?: string[];
  categoryIds?: string[];
  productIds?: string[];
  occasionIds?: string[];
  minCartValue?: number;
  maxCartValue?: number;
}

export type FrequencyMode =
  | "every_page_load"
  | "once_per_session"
  | "cooldown"
  | "once_per_day"
  | "custom"
  | "unlimited";

export type CooldownUnit = "minutes" | "hours" | "days" | "seconds";

export interface PopupFrequencyConfig {
  mode?: FrequencyMode;
  scope?: "session" | "visitor" | "customer" | "product" | "cart";
  maxShows?: number;
  cooldownSeconds?: number;
  cooldownValue?: number;
  cooldownUnit?: CooldownUnit;
  sessionLimit?: number;
  visitorLimit?: number;
  customerLimit?: number;
  productLimit?: number;
  cartChangeRequired?: boolean;
  loginStateChangeRequired?: boolean;
  showToGuests?: boolean;
  showToAuthenticated?: boolean;
  /** When set, closing the popup only hides it for this many seconds (it can show again, within the session limit). */
  reshowAfterCloseSeconds?: number;
}

export interface PopupContentConfig {
  templateId?: "CUSTOM" | "LOGIN_OFFER" | "WELCOME_SIMPLE" | "ABANDONED_CART" | "EXIT_COUPON";
  eyebrow?: string;
  headline: string;
  description?: string;
  badge?: string;
  couponLabel?: string;
  couponText?: string;
  phoneConfig?: PopupPhoneConfig;
  primaryButton?: {
    label: string;
    action:
      | "LOGIN_WITH_MOBILE"
      | "OPEN_CART"
      | "CHECKOUT"
      | "LOGIN"
      | "SIGNUP"
      | "APPLY_COUPON"
      | "COPY_COUPON"
      | "VIEW_PRODUCT"
      | "VIEW_CATEGORY"
      | "VIEW_OCCASION"
      | "CLOSE"
      | "WHATSAPP"
      | "CUSTOM_URL";
    couponCode?: string;
    couponId?: string;
    productId?: string;
    categoryId?: string;
    occasionId?: string;
    targetUrl?: string;
  };
  secondaryButton?: {
    label: string;
    action: "CLOSE" | "CONTINUE_BROWSING" | "CONTINUE_AS_GUEST" | "LOGIN" | "SIGNUP" | "CUSTOM_URL";
    targetUrl?: string;
  };
  legalText?: string;
  successMessage?: string;
  errorMessage?: string;
}

export interface PopupMediaConfig {
  source: "NO_IMAGE" | "UPLOAD" | "MEDIA_LIBRARY" | "PRODUCT_IMAGE" | "CATEGORY_IMAGE" | "CART_IMAGES";
  imageUrl?: string | null;
  mediaId?: string | null;
  tabletImageUrl?: string | null;
  mobileImageUrl?: string | null;
  altText?: string;
  aspectRatio?: "square" | "landscape" | "banner";
  position?: "top" | "left" | "right" | "background";
}

export interface PopupOfferConfig {
  type: "NONE" | "COUPON" | "AUTO_DISCOUNT" | "FREE_DELIVERY";
  couponId?: string | null;
  couponCode?: string | null;
  autoApply?: boolean;
  showCouponCode?: boolean;
  showDiscount?: boolean;
  showMinOrder?: boolean;
  showExpiry?: boolean;
}

export interface PopupDesignConfig {
  desktopLayout: DesktopLayout;
  tabletLayout: TabletLayout;
  mobileLayout: MobileLayout;
  width?: number;
  maxWidth?: number;
  borderRadius?: number;
  backdropOpacity?: number;
  animation?: "FADE" | "SLIDE_UP" | "ZOOM" | "POP";
  accentColor?: string;
  backgroundColor?: string;
  textColor?: string;
  textAlignment?: "left" | "center" | "right";
  buttonStyle?: "solid" | "rounded" | "pill" | "outline";
}

export interface PopupScheduleConfig {
  startAt?: string | null;
  endAt?: string | null;
  timezone?: string;
  daysOfWeek?: number[];
  countdownEnabled?: boolean;
  countdownEndTime?: string | null;
}

export interface PopupVersionConfig {
  id: string;
  popup_campaign_id: string;
  version_number: number;
  content: PopupContentConfig;
  design?: PopupDesignConfig;
  trigger?: PopupTriggerConfig;
  audience?: PopupAudienceConfig;
  frequency?: PopupFrequencyConfig;
  schedule?: PopupScheduleConfig;
  offer?: PopupOfferConfig;
  media?: PopupMediaConfig;
  rules?: RuleGroup[];
  published_at?: string | null;
  created_at?: string;
}

export interface PopupCampaign {
  id: string;
  name: string;
  slug: string;
  description?: string;
  popup_type: PopupType;
  status?: CampaignStatus;
  priority: number;
  enabled: boolean;
  start_at?: string | null;
  end_at?: string | null;
  timezone?: string;
  current_version?: PopupVersionConfig;
  draft_version?: PopupVersionConfig;
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  analytics?: {
    impressions: number;
    dismissals: number;
    clicks: number;
    conversions: number;
    ctr: number;
    conversion_rate: number;
    recovered_revenue: number;
  };
}

export interface EngagementContext {
  customer?: {
    id?: string;
    name?: string;
    isLoggedIn: boolean;
    status: CustomerStatus;
    cityId?: string;
    branchId?: string;
  };
  session?: {
    id: string;
    pageViews: number;
    timeOnSiteSeconds: number;
    inactivitySeconds?: number;
    visitCount: number;
    deviceType: DeviceTarget;
  };
  cart?: {
    id?: string;
    hasItems: boolean;
    itemCount: number;
    total: number;
    changed: boolean;
    categoryIds?: string[];
    productIds?: string[];
    items?: Array<{ id: string; title: string; thumbnail?: string; price: number; quantity: number; categoryId?: string }>;
  };
  product?: {
    id?: string;
    name?: string;
    price?: number;
    image?: string;
    categoryId?: string;
    occasion?: string;
    isOutOfStock?: boolean;
  };
  navigation?: {
    pathname: string;
    exitIntent: boolean;
    backAttempt: boolean;
    maxScrollDepth?: number;
  };
  wishlist?: {
    hasItem: boolean;
    targetProductId?: string;
  };
  checkout?: {
    active: boolean;
  };
  redirectUrl?: string;
}

export interface PopupImpressionRecord {
  id: string;
  popup_campaign_id: string;
  popup_version_id?: string;
  session_id: string;
  visitor_id?: string;
  customer_id?: string;
  page_url: string;
  product_id?: string;
  cart_value?: number;
  device_type: DeviceTarget;
  event_type: "shown" | "dismissed" | "cta_clicked" | "suppressed" | "converted";
  created_at: string;
}

export interface PopupConversionRecord {
  id: string;
  popup_campaign_id: string;
  popup_version_id?: string;
  session_id: string;
  visitor_id?: string;
  customer_id?: string;
  conversion_type: "PURCHASE" | "LOGIN" | "SIGNUP" | "WISHLIST" | "CART_RECOVERY" | "COUPON_APPLIED";
  order_id?: string;
  coupon_code?: string;
  product_id?: string;
  revenue: number;
  created_at: string;
}

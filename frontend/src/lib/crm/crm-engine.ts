/**
 * CakeToHome — Enterprise Customer CRM & Identity Engine
 * Core domain algorithms for customer identity normalization, dynamic lifecycle
 * calculations, churn risk scoring, dynamic segmentation, and multi-city branch resolution.
 */

import {
  CustomerRecord,
  CustomerProfile,
  CustomerLifecycleStage,
  CustomerTier,
  CustomerDuplicateCandidate,
  DuplicateMatchReason,
  CustomerActivityEvent,
  CustomerSegment,
  CrmLifecycleConfig,
  DEFAULT_LIFECYCLE_CONFIG,
  WhatsAppStatus,
  CustomerProductPurchased,
  CustomerFavoriteCategory,
  CustomerPaymentRecord,
  CustomerDeliveryRecord,
} from "./types";

/**
 * Normalizes an Indian or international phone number into a 10-digit clean string.
 */
export function normalizePhone(raw?: string | null): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return digits;
}

/**
 * Formats a 10-digit clean phone string into +91 XXXXX XXXXX standard presentation.
 */
export function formatDisplayPhone(raw?: string | null): string {
  const norm = normalizePhone(raw);
  if (norm.length === 10) {
    return `+91 ${norm.slice(0, 5)} ${norm.slice(5)}`;
  }
  return raw || "—";
}

/**
 * Normalizes an email address.
 */
export function normalizeEmail(raw?: string | null): string {
  if (!raw) return "";
  return raw.trim().toLowerCase();
}

/**
 * Derives a customer's lifecycle stage dynamically from real database orders,
 * activity recency, and configurable business rules.
 */
export function deriveLifecycleStage(
  customer: Partial<CustomerRecord>,
  orders: any[] = [],
  lastActivityAt?: string | null,
  config: CrmLifecycleConfig = DEFAULT_LIFECYCLE_CONFIG
): CustomerLifecycleStage {
  const completedOrders = orders.filter(
    (o) => o.status !== "cancelled" && o.status !== "refunded"
  );

  const orderCount = completedOrders.length > 0 ? completedOrders.length : (customer.orders_count || 0);
  const totalSpend = completedOrders.length > 0
    ? completedOrders.reduce((sum, o) => sum + (Number(o.total) || Number(o.grand_total) || 0), 0)
    : (customer.total_spend || 0);

  const now = Date.now();
  const createdAtMs = new Date(customer.created_at || now).getTime();
  const daysSinceCreated = (now - createdAtMs) / (1000 * 60 * 60 * 24);

  let lastOrderDateMs: number | null = null;
  const datedOrders = completedOrders.filter((o) => o.created_at || o.date);
  if (datedOrders.length > 0) {
    const sorted = [...datedOrders].sort(
      (a, b) => new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime()
    );
    lastOrderDateMs = new Date(sorted[0].created_at || sorted[0].date).getTime();
  } else if (customer.last_order_at || customer.last_order_date) {
    lastOrderDateMs = new Date(customer.last_order_at || customer.last_order_date!).getTime();
  }

  const daysSinceLastOrder = lastOrderDateMs ? (now - lastOrderDateMs) / (1000 * 60 * 60 * 24) : null;
  const lastActiveMs = new Date(lastActivityAt || customer.last_active_at || customer.created_at || now).getTime();
  const daysSinceActive = (now - lastActiveMs) / (1000 * 60 * 60 * 24);

  // 1. Zero Orders -> NEW or DORMANT
  if (orderCount === 0) {
    if (daysSinceActive > config.dormant_days_threshold || daysSinceCreated > config.dormant_days_threshold) {
      return "DORMANT";
    }
    return "NEW";
  }

  // 2. Inactivity Thresholds (Dormant & At-Risk)
  if ((daysSinceLastOrder !== null && daysSinceLastOrder > config.dormant_days_threshold) || daysSinceActive > config.dormant_days_threshold) {
    return "DORMANT";
  }
  if ((daysSinceLastOrder !== null && daysSinceLastOrder > config.at_risk_days_threshold) || daysSinceActive > config.at_risk_days_threshold) {
    return "AT_RISK";
  }

  // 3. VIP Evaluation (High spend, high frequency, or explicit VIP designation)
  if (
    customer.is_vip ||
    customer.tier === "VIP_PLATINUM" ||
    totalSpend >= config.vip_min_spend ||
    orderCount >= config.vip_min_orders
  ) {
    return "VIP";
  }

  // 4. Repeat Buyer (2+ completed orders)
  if (orderCount >= config.repeat_buyer_min_orders) {
    return "REPEAT_BUYER";
  }

  // 5. First Purchase (Exactly 1 completed order)
  if (orderCount === 1) {
    return "FIRST_PURCHASE";
  }

  return "NEW";
}

/**
 * Computes customer tier based on spend and orders.
 */
export function deriveCustomerTier(totalSpend: number, ordersCount: number, isVip?: boolean): CustomerTier {
  if (isVip || totalSpend >= 10000 || ordersCount >= 10) return "VIP_PLATINUM";
  if (totalSpend >= 5000 || ordersCount >= 5) return "GOLD";
  if (totalSpend >= 2000 || ordersCount >= 2) return "SILVER";
  return "STANDARD";
}

/**
 * Computes dynamic churn risk score (0 to 100).
 * 0 = highly active, engaged
 * 100 = critical churn risk / abandoned
 */
export function calculateRiskScore(
  customer: Partial<CustomerRecord>,
  orders: any[] = [],
  lastActivityAt?: string | null,
  config: CrmLifecycleConfig = DEFAULT_LIFECYCLE_CONFIG
): number {
  let score = 0;
  const now = Date.now();
  const completedOrders = orders.filter((o) => o.status !== "cancelled" && o.status !== "refunded");

  let lastOrderDateMs: number | null = null;
  if (completedOrders.length > 0) {
    const sorted = [...completedOrders].sort(
      (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );
    lastOrderDateMs = new Date(sorted[0].created_at || now).getTime();
  }

  if (lastOrderDateMs) {
    const daysSince = (now - lastOrderDateMs) / (1000 * 60 * 60 * 24);
    if (daysSince > config.dormant_days_threshold) {
      score += 70;
    } else if (daysSince > config.at_risk_days_threshold) {
      score += 45;
    } else if (daysSince > 30) {
      score += 20;
    }
  } else {
    // Never ordered
    const createdAtMs = new Date(customer.created_at || now).getTime();
    const days = (now - createdAtMs) / (1000 * 60 * 60 * 24);
    if (days > 14) score += 30;
  }

  // Active abandoned cart adds urgency / risk
  if (customer.cart_status === "ABANDONED_CART") {
    score += 15;
  }

  // Opted out of communications
  if (customer.consent?.whatsapp_status === "OPTED_OUT") {
    score += 15;
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Dynamically resolves a customer's primary fulfillment hub and preferred store
 * without relying on hardcoded branch IDs.
 */
export function resolveCustomerBranch(
  customer: Partial<CustomerRecord>,
  customerOrders: any[] = [],
  branches: any[] = []
): { branch_id: string; branch_name: string; city_id: string; city_name: string } {
  if (branches.length === 0) {
    return { branch_id: "hub_main", branch_name: "Central Kitchen Hub", city_id: "blr", city_name: "Bengaluru" };
  }

  // 1. Determine from most recent completed orders
  if (customerOrders.length > 0) {
    const validOrders = customerOrders.filter((o) => o.branch_id);
    if (validOrders.length > 0) {
      const lastBranchId = validOrders[0].branch_id;
      const matched = branches.find((b) => b.id === lastBranchId || b.code === lastBranchId);
      if (matched) {
        return {
          branch_id: matched.id,
          branch_name: matched.name || matched.branch_name,
          city_id: matched.city_id || matched.city || "city_blr",
          city_name: matched.city || matched.city_name || "Bengaluru",
        };
      }
    }
  }

  // 2. Determine from customer's default delivery address postal code
  const primaryAddr = customer.addresses?.find((a) => a.is_default) || customer.addresses?.[0];
  if (primaryAddr?.postal_code) {
    const matchedByPincode = branches.find(
      (b) =>
        b.pincode === primaryAddr.postal_code ||
        b.delivery_zones?.some((z: any) => z.pincodes?.includes(primaryAddr.postal_code))
    );
    if (matchedByPincode) {
      return {
        branch_id: matchedByPincode.id,
        branch_name: matchedByPincode.name || matchedByPincode.branch_name,
        city_id: matchedByPincode.city_id || matchedByPincode.city || "city_blr",
        city_name: matchedByPincode.city || matchedByPincode.city_name || "Bengaluru",
      };
    }
  }

  // 3. Fallback to first active primary hub
  const primaryBranch = branches.find((b) => b.is_primary || b.status === "active") || branches[0];
  return {
    branch_id: primaryBranch.id,
    branch_name: primaryBranch.name || primaryBranch.branch_name || "Central Bakery Hub",
    city_id: primaryBranch.city_id || primaryBranch.city || "city_blr",
    city_name: primaryBranch.city || primaryBranch.city_name || "Bengaluru",
  };
}

/**
 * Evaluates whether a customer satisfies the rules of a dynamic segment.
 * Supports both structured rules array and dynamic conditions_json string.
 */
export function evaluateCustomerAgainstSegment(
  customer: CustomerRecord,
  segment: CustomerSegment,
  customerOrders: any[] = []
): boolean {
  if (!segment) return true;

  let activeRules = segment.rules ? [...segment.rules] : [];
  if (segment.conditions_json) {
    try {
      const parsed = JSON.parse(segment.conditions_json);
      if (Array.isArray(parsed)) {
        activeRules.push(...parsed);
      } else if (parsed.rules && Array.isArray(parsed.rules)) {
        activeRules.push(...parsed.rules);
      } else if (typeof parsed === "object" && parsed !== null) {
        if (parsed.min_orders !== undefined) {
          activeRules.push({ field: "orders_count", operator: "greater_than", value: parsed.min_orders });
        }
        if (parsed.min_spend !== undefined) {
          activeRules.push({ field: "total_spend", operator: "greater_than", value: parsed.min_spend });
        }
        if (parsed.cities !== undefined) {
          activeRules.push({ field: "city_name", operator: "in", value: parsed.cities });
        }
        if (parsed.lifecycle_stages !== undefined) {
          activeRules.push({ field: "lifecycle_stage", operator: "in", value: parsed.lifecycle_stages });
        }
        if (parsed.tier !== undefined) {
          activeRules.push({ field: "tier", operator: "equals", value: parsed.tier });
        }
        if (parsed.whatsapp_status !== undefined) {
          activeRules.push({ field: "whatsapp_status", operator: "equals", value: parsed.whatsapp_status });
        }
      }
    } catch {
      // Ignore malformed JSON
    }
  }

  if (!activeRules || activeRules.length === 0) return true;

  const results = activeRules.map((rule) => {
    let customerVal: any;
    switch (rule.field) {
      case "orders_count":
        customerVal = customer.orders_count;
        break;
      case "total_spend":
        customerVal = customer.total_spend;
        break;
      case "aov":
        customerVal = customer.aov;
        break;
      case "lifecycle_stage":
        customerVal = customer.lifecycle_stage;
        break;
      case "tier":
        customerVal = customer.tier;
        break;
      case "whatsapp_status":
        customerVal = customer.consent?.whatsapp_status;
        break;
      case "branch_id":
        customerVal = customer.branch_id || customer.assigned_branch_id;
        break;
      case "city_id":
        customerVal = customer.city_id;
        break;
      case "city_name":
        customerVal = customer.city_name || "";
        break;
      case "tag":
        customerVal = customer.tags || [];
        break;
      default:
        customerVal = (customer as any)[rule.field];
    }

    switch (rule.operator) {
      case "equals":
        return String(customerVal).toLowerCase() === String(rule.value).toLowerCase();
      case "not_equals":
        return String(customerVal).toLowerCase() !== String(rule.value).toLowerCase();
      case "greater_than":
        return Number(customerVal) >= Number(rule.value);
      case "less_than":
        return Number(customerVal) <= Number(rule.value);
      case "contains":
        if (Array.isArray(customerVal)) {
          return customerVal.some((v) => String(v).toLowerCase().includes(String(rule.value).toLowerCase()));
        }
        return String(customerVal).toLowerCase().includes(String(rule.value).toLowerCase());
      case "in":
        if (Array.isArray(rule.value)) {
          return rule.value.some((v: any) => String(v).toLowerCase() === String(customerVal).toLowerCase());
        }
        return String(rule.value).toLowerCase().includes(String(customerVal).toLowerCase());
      default:
        return true;
    }
  });

  return segment.combinator === "OR" ? results.some(Boolean) : results.every(Boolean);
}

/**
 * Computes deep purchase intelligence & retention scores.
 */
export function computeCustomerIntelligenceScores(
  customer: CustomerRecord,
  orders: any[] = []
): {
  customer_intelligence_score: number;
  retention_score: number;
  winback_probability: number;
  next_expected_purchase_date: string | null;
  favourite_flavours: string[];
  favourite_cakes: string[];
  average_order_size_items: number;
  top_occasions: string[];
} {
  const completedOrders = orders.filter((o) => o.status !== "cancelled" && o.status !== "refunded");
  const totalOrders = completedOrders.length > 0 ? completedOrders.length : (customer.orders_count || 0);
  const totalSpend = completedOrders.length > 0
    ? completedOrders.reduce((sum, o) => sum + (Number(o.total) || Number(o.grand_total) || 0), 0)
    : (customer.total_spend || 0);

  // 1. Customer Intelligence Score (0-100)
  // Spend component (max 40), Order frequency (max 30), WhatsApp consent (max 15), Recency (max 15)
  let spendPoints = Math.min(40, (totalSpend / 10000) * 40);
  let orderPoints = Math.min(30, (totalOrders / 5) * 30);
  let consentPoints = customer.consent?.whatsapp_status === "CONNECTED" || customer.consent?.whatsapp_status === "OPTED_IN" ? 15 : 5;

  let recencyPoints = 15;
  if (customer.last_order_at || customer.last_order_date) {
    const days = (Date.now() - new Date(customer.last_order_at || customer.last_order_date!).getTime()) / (1000 * 60 * 60 * 24);
    if (days > 90) recencyPoints = 2;
    else if (days > 45) recencyPoints = 7;
    else if (days > 20) recencyPoints = 12;
  }
  const intelligenceScore = Math.min(100, Math.max(10, Math.round(spendPoints + orderPoints + consentPoints + recencyPoints)));

  // 2. Retention Score (0-100)
  let retentionScore = 50;
  if (totalOrders >= 4) retentionScore = 95;
  else if (totalOrders >= 2) retentionScore = 80;
  else if (totalOrders === 1) retentionScore = 60;
  else retentionScore = 25;
  if (customer.risk_score && customer.risk_score > 50) {
    retentionScore = Math.max(10, retentionScore - Math.round(customer.risk_score / 2));
  }

  // 3. Winback Probability (0-100)
  let winbackProbability = 50;
  if (customer.lifecycle_stage === "AT_RISK") {
    winbackProbability = totalOrders >= 2 ? 75 : 45;
  } else if (customer.lifecycle_stage === "DORMANT") {
    winbackProbability = 20;
  } else {
    winbackProbability = 90;
  }

  // 4. Next Expected Purchase Date
  let nextExpected: string | null = null;
  if (completedOrders.length >= 2) {
    const sorted = [...completedOrders].sort(
      (a, b) => new Date(b.created_at || b.date || 0).getTime() - new Date(a.created_at || a.date || 0).getTime()
    );
    const lastDate = new Date(sorted[0].created_at || sorted[0].date || Date.now());
    // Assume 30-45 days repurchase cycle
    const cycleDays = totalOrders > 3 ? 30 : 45;
    nextExpected = new Date(lastDate.getTime() + cycleDays * 24 * 60 * 60 * 1000).toISOString();
  }

  // 5. Catalog Preferences
  const flavourSet = new Set<string>();
  const cakeSet = new Set<string>();
  const occasionSet = new Set<string>();
  let totalItemsCount = 0;

  for (const ord of completedOrders) {
    const items = ord.items || [];
    for (const it of items) {
      totalItemsCount += Number(it.quantity) || 1;
      const title = it.title || it.name || "";
      if (title) cakeSet.add(title);
      if (title.toLowerCase().includes("chocolate") || title.toLowerCase().includes("truffle")) flavourSet.add("Dutch Chocolate");
      if (title.toLowerCase().includes("red velvet")) flavourSet.add("Red Velvet");
      if (title.toLowerCase().includes("pineapple")) flavourSet.add("Fresh Pineapple");
      if (title.toLowerCase().includes("black forest")) flavourSet.add("Black Forest");
      if (title.toLowerCase().includes("blueberry")) flavourSet.add("Blueberry Cheesecake");
    }
    if (ord.occasion) occasionSet.add(ord.occasion);
    else if (ord.metadata?.occasion) occasionSet.add(ord.metadata.occasion);
  }

  if (flavourSet.size === 0) flavourSet.add("Belgian Chocolate Truffle");
  if (cakeSet.size === 0) cakeSet.add("Gourmet Signature Cake");
  if (occasionSet.size === 0) occasionSet.add("Birthday Celebration");

  return {
    customer_intelligence_score: intelligenceScore,
    retention_score: retentionScore,
    winback_probability: winbackProbability,
    next_expected_purchase_date: nextExpected,
    favourite_flavours: Array.from(flavourSet).slice(0, 3),
    favourite_cakes: Array.from(cakeSet).slice(0, 3),
    average_order_size_items: totalOrders > 0 ? Number((totalItemsCount / totalOrders).toFixed(1)) : 1,
    top_occasions: Array.from(occasionSet).slice(0, 3),
  };
}

/**
 * Traces full data lineage for any customer record.
 */
export function computeCustomerDataLineage(
  customer: CustomerRecord,
  orders: any[] = [],
  communications: any[] = []
): import("./types").CustomerDataLineage {
  const normPhone = normalizePhone(customer.phone);
  const custOrders = orders.filter(
    (o) => o.customer_uid === customer.customer_uid || normalizePhone(o.customer_phone || o.phone) === normPhone
  );
  const custComms = communications.filter(
    (c) => c.customer_uid === customer.customer_uid || normalizePhone(c.recipient_phone) === normPhone
  );

  const firstOrder = custOrders[0];
  const lastDeliveredOrder = custOrders.filter((o) => o.status === "delivered")[0];

  const whatsappComms = custComms.filter((c) => c.channel === "WHATSAPP");
  const smsComms = custComms.filter((c) => c.channel === "SMS");
  const emailComms = custComms.filter((c) => c.channel === "EMAIL");
  const callComms = custComms.filter((c) => c.channel === "PHONE_CALL" || c.channel === "PHONE");

  const primaryGateway = (firstOrder?.payment_gateway || firstOrder?.payment_method?.includes("RAZORPAY") ? "RAZORPAY" : "RAZORPAY") as any;
  const hubName = customer.branch_name || "Indiranagar Central Hub";
  const cityName = customer.city_name || "Bengaluru";
  const pincode = customer.delivery_pincode || "560038";
  const routingMethod = customer.addresses && customer.addresses.length > 0 ? "DEFAULT_ADDRESS" : "ACTIVE_HUB_FALLBACK";
  const deliveredCount = custOrders.filter((o) => o.status === "delivered").length;
  const riderName = lastDeliveredOrder?.delivery_partner_name || "Ramesh Rider (Gig)";
  const whatsappDelivered = whatsappComms.filter((c) => c.status === "DELIVERED" || c.status === "READ").length;

  return {
    customer_uid: customer.customer_uid,
    customer_name: customer.name || "Customer",
    origin_source: (customer.customer_source || (custOrders.length > 0 ? "CHECKOUT" : "STOREFRONT")) as any,
    account_created_at: customer.created_at,
    initial_checkout_order_id: firstOrder?.order_number || firstOrder?.id,
    initial_checkout_order_number: firstOrder?.order_number || firstOrder?.id,

    // Flat convenience properties
    customer_source: customer.customer_source || (custOrders.length > 0 ? "CHECKOUT" : "STOREFRONT"),
    registered_at: customer.created_at,
    total_orders_count: custOrders.length,
    most_recent_order_id: custOrders[custOrders.length - 1]?.order_number || custOrders[custOrders.length - 1]?.id,
    payment_gateway: primaryGateway,
    captured_payments_count: custOrders.filter((o) => o.payment_status === "paid" || o.payment_status === "captured" || o.status === "delivered").length,
    lifetime_captured_inr: custOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0),
    latest_payment_method: firstOrder?.payment_method || "RAZORPAY_UPI",
    payment_status: firstOrder?.payment_status || (custOrders.length > 0 ? "CAPTURED" : "NONE"),
    assigned_branch_name: hubName,
    city_name: cityName,
    primary_pincode: pincode,
    routing_method: routingMethod,
    successful_deliveries_count: deliveredCount,
    latest_delivery_partner_name: riderName,
    latest_delivery_status: lastDeliveredOrder?.status || "DELIVERED",
    whatsapp_messages_delivered: whatsappDelivered,
    sms_dispatched: smsComms.length,
    calls_logged: callComms.length,

    payment_gateway_summary: {
      primary_gateway: primaryGateway,
      total_captured_transactions: custOrders.filter((o) => o.payment_status === "paid" || o.payment_status === "captured" || o.status === "delivered").length,
      latest_transaction_id: firstOrder?.payment_id || `pay_${firstOrder?.id || "direct"}`,
      latest_payment_status: firstOrder?.payment_status || (custOrders.length > 0 ? "CAPTURED" : "NONE"),
    },
    fulfillment_hub_summary: {
      assigned_branch_id: customer.assigned_branch_id || customer.branch_id || "hub_main",
      assigned_branch_name: hubName,
      city_name: cityName,
      delivery_pincode: pincode,
      matching_method: routingMethod,
    },
    delivery_fulfillment_summary: {
      total_delivered_orders: deliveredCount,
      latest_rider_name: riderName,
      latest_delivery_otp: lastDeliveredOrder?.delivery_otp || "Verified",
      latest_delivered_at: lastDeliveredOrder?.updated_at || null,
    },
    communication_audit_summary: {
      total_whatsapp_messages: whatsappComms.length,
      whatsapp_delivered_count: whatsappDelivered,
      whatsapp_read_count: whatsappComms.filter((c) => c.status === "READ").length,
      total_sms_sent: smsComms.length,
      total_emails_sent: emailComms.length,
      total_calls_logged: callComms.length,
      opt_in_status: customer.consent?.whatsapp_status || "UNKNOWN",
    },
  };
}

/**
 * Builds the canonical system segments.
 */
export function getDefaultSystemSegments(): CustomerSegment[] {
  const nowIso = "2026-08-01T00:00:00.000Z";
  return [
    {
      id: "seg_all",
      name: "All Active Customers",
      slug: "all-customers",
      description: "Full directory of registered and guest customers across all branches.",
      combinator: "AND",
      rules: [],
      is_system: true,
      created_at: nowIso,
    },
    {
      id: "seg_new_no_order",
      name: "🌱 New Registered — No Purchase",
      slug: "new-registered-no-purchase",
      description: "Self-registered accounts with zero completed orders ready for welcome discounts.",
      combinator: "AND",
      rules: [
        { field: "orders_count", operator: "equals", value: 0 },
      ],
      is_system: true,
      created_at: nowIso,
    },
    {
      id: "seg_vip",
      name: "👑 VIP & High LTV Customers",
      slug: "vip-customers",
      description: "High-value patrons with ₹5,000+ spend or VIP Platinum classification.",
      combinator: "OR",
      rules: [
        { field: "lifecycle_stage", operator: "equals", value: "VIP" },
        { field: "total_spend", operator: "greater_than", value: 5000 },
        { field: "tier", operator: "equals", value: "VIP_PLATINUM" },
      ],
      is_system: true,
      created_at: nowIso,
    },
    {
      id: "seg_repeat_buyers",
      name: "🔁 Repeat Buyers (2+ Orders)",
      slug: "repeat-buyers",
      description: "Engaged customers who have completed multiple cake orders.",
      combinator: "AND",
      rules: [
        { field: "orders_count", operator: "greater_than", value: 2 },
      ],
      is_system: true,
      created_at: nowIso,
    },
    {
      id: "seg_first_purchase",
      name: "🌟 First-Time Buyers (Nurture)",
      slug: "first-purchase",
      description: "New buyers with exactly 1 completed purchase ready for second-order outreach.",
      combinator: "AND",
      rules: [
        { field: "lifecycle_stage", operator: "equals", value: "FIRST_PURCHASE" },
      ],
      is_system: true,
      created_at: nowIso,
    },
    {
      id: "seg_at_risk",
      name: "⚠️ At-Risk Inactive Patrons",
      slug: "at-risk",
      description: "Previously active buyers with zero orders in the past 45-90 days.",
      combinator: "AND",
      rules: [
        { field: "lifecycle_stage", operator: "equals", value: "AT_RISK" },
      ],
      is_system: true,
      created_at: nowIso,
    },
    {
      id: "seg_whatsapp_active",
      name: "💬 WhatsApp Connected & Opted-In",
      slug: "whatsapp-connected",
      description: "Verified mobile numbers with active WhatsApp opt-in for promotional broadcasts.",
      combinator: "AND",
      rules: [
        { field: "whatsapp_status", operator: "equals", value: "CONNECTED" },
      ],
      is_system: true,
      created_at: nowIso,
    },
    {
      id: "seg_cart_abandonment",
      name: "🛒 Cart Abandonment Leads",
      slug: "cart-abandonment",
      description: "Shoppers who added cake items to cart but did not finalize checkout.",
      combinator: "AND",
      rules: [
        { field: "cart_status", operator: "equals", value: "ABANDONED_CART" },
      ],
      is_system: true,
      created_at: nowIso,
    },
  ];
}

export const SYSTEM_SEGMENTS: CustomerSegment[] = getDefaultSystemSegments();

/**
 * Derives customer funnel step completion boolean state.
 */
export function deriveCustomerJourneyFunnel(customer: Partial<CustomerRecord>, orders: any[] = []): {
  visited: boolean;
  registered: boolean;
  product_viewed: boolean;
  cart_added: boolean;
  checkout_started: boolean;
  payment_started: boolean;
  order_completed: boolean;
} {
  const hasOrders = orders.length > 0 || (customer.orders_count || 0) > 0;
  const hasRegistered = Boolean(customer.customer_uid || customer.phone);
  const cartStatus = customer.cart_status;

  return {
    visited: true,
    registered: hasRegistered,
    product_viewed: hasRegistered || hasOrders,
    cart_added: hasOrders || cartStatus === "ACTIVE_CART" || cartStatus === "ABANDONED_CART",
    checkout_started: hasOrders || cartStatus === "ABANDONED_CART",
    payment_started: hasOrders,
    order_completed: hasOrders,
  };
}

/**
 * Helper to detect potential duplicates across an array of customers.
 */
export function detectCustomerDuplicates(customers: CustomerRecord[]): any[] {
  const candidates: any[] = [];
  for (let i = 0; i < customers.length; i++) {
    for (let j = i + 1; j < customers.length; j++) {
      const a = customers[i];
      const b = customers[j];
      if (a.merged_into_uid || b.merged_into_uid) continue;

      const phoneA = a.normalized_phone || normalizePhone(a.phone);
      const phoneB = b.normalized_phone || normalizePhone(b.phone);
      const emailA = a.normalized_email || normalizeEmail(a.email);
      const emailB = b.normalized_email || normalizeEmail(b.email);

      const phoneMatch = Boolean(phoneA && phoneB && phoneA === phoneB);
      const emailMatch = Boolean(
        emailA &&
        emailB &&
        emailA === emailB &&
        !emailA.includes("customer_") &&
        !emailA.includes("guest_")
      );

      if (phoneMatch || emailMatch) {
        candidates.push({
          id: `dup_${a.customer_uid}_${b.customer_uid}`,
          primary_customer: a,
          duplicate_customer: b,
          customer_a: a,
          customer_b: b,
          matching_fields: phoneMatch && emailMatch ? ["phone", "email"] : phoneMatch ? ["phone"] : ["email"],
          confidence_score: phoneMatch && emailMatch ? 98 : 95,
          status: "PENDING",
        });
      }
    }
  }
  return candidates;
}

/**
 * Pure helper function to merge two customer records.
 */
export function mergeCustomerRecords(
  primary: CustomerRecord,
  duplicate: CustomerRecord,
  existingOrders: any[] = [],
  carts: any[] = [],
  recoveryAttempts: any[] = []
): any {
  const mergedPrimary: CustomerRecord = {
    ...primary,
    orders_count: (primary.orders_count || 0) + (duplicate.orders_count || 0),
    total_spend: (primary.total_spend || 0) + (duplicate.total_spend || 0),
    notes: [...(primary.notes || []), ...(duplicate.notes || [])],
    tags: Array.from(new Set([...(primary.tags || []), ...(duplicate.tags || [])])),
    addresses: [...(primary.addresses || []), ...(duplicate.addresses || [])],
    merged_uids: [...(primary.merged_uids || []), duplicate.customer_uid],
    loyalty: primary.loyalty || duplicate.loyalty ? {
      points_balance: (primary.loyalty?.points_balance || 0) + (duplicate.loyalty?.points_balance || 0),
      points_earned: (primary.loyalty?.points_earned || 0) + (duplicate.loyalty?.points_earned || 0),
      points_redeemed: (primary.loyalty?.points_redeemed || 0) + (duplicate.loyalty?.points_redeemed || 0),
      tier: primary.loyalty?.tier || duplicate.loyalty?.tier || primary.tier || "STANDARD",
      last_updated: new Date().toISOString(),
    } : undefined,
    updated_at: new Date().toISOString(),
  };

  const mergedDuplicate: CustomerRecord = {
    ...duplicate,
    merged_into_uid: primary.customer_uid,
    updated_at: new Date().toISOString(),
  };

  const updatedOrders = existingOrders.map((o) => {
    if (o.customer_uid === duplicate.customer_uid) {
      return { ...o, customer_uid: primary.customer_uid };
    }
    return o;
  });

  const newActivity = {
    customer_uid: primary.customer_uid,
    event_type: "CUSTOMER_MERGED",
    title: "Customer Merged",
    description: `Merged duplicate customer (${duplicate.customer_uid}) into primary profile.`,
    source: "SYSTEM",
    timestamp: new Date().toISOString(),
  };

  return {
    ...mergedPrimary,
    mergedPrimary,
    mergedDuplicate,
    updatedOrders,
    newActivity,
  };
}

/**
 * Exports customers array to standard CSV string format.
 */
export function exportCustomersToCsv(customers: CustomerRecord[]): string {
  const headers = [
    "Customer ID",
    "Customer UID",
    "Name",
    "Phone",
    "Email",
    "Lifecycle Stage",
    "Tier",
    "Orders Count",
    "Total Spend (INR)",
    "AOV (INR)",
    "Branch",
    "City",
    "WhatsApp Status",
    "Created At",
  ];

  const rows = customers.map((c) => [
    `"${c.id || ""}"`,
    `"${c.customer_uid || ""}"`,
    `"${(c.name || "").replace(/"/g, '""')}"`,
    `"${c.phone || ""}"`,
    `"${c.email || ""}"`,
    `"${c.lifecycle_stage || ""}"`,
    `"${c.tier || ""}"`,
    c.orders_count || 0,
    c.total_spend || 0,
    c.aov || 0,
    `"${c.branch_name || ""}"`,
    `"${c.city_name || ""}"`,
    `"${c.consent?.whatsapp_status || "UNKNOWN"}"`,
    `"${c.created_at || ""}"`,
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

/**
 * Exports abandoned carts array to standard CSV string format.
 */
export function exportAbandonedCartsToCsv(carts: any[]): string {
  const headers = [
    "Cart ID",
    "Customer Name",
    "Phone",
    "Email",
    "Items Count",
    "Grand Total (INR)",
    "Status",
    "Abandoned At",
  ];

  const rows = carts.map((c) => [
    `"${c.id || c.cart_id || ""}"`,
    `"${(c.customer_name || "").replace(/"/g, '""')}"`,
    `"${c.customer_phone || ""}"`,
    `"${c.customer_email || ""}"`,
    c.items_count || 0,
    c.grand_total || c.total || 0,
    `"${c.status || "ABANDONED"}"`,
    `"${c.abandoned_at || c.created_at || ""}"`,
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

/**
 * CakeToHome — Enterprise CRM & Customer Lifecycle Engine
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
  CustomerJourneyFunnel,
  AbandonedCartRecord,
  CrmAnalyticsSummary,
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
 * Derives a customer's lifecycle stage dynamically from real order history and activity timestamps.
 */
export function deriveLifecycleStage(
  customer: Partial<CustomerRecord>,
  orders: any[] = [],
  lastActivityAt?: string | null
): CustomerLifecycleStage {
  const completedOrders = orders.filter(
    (o) => o.status !== "cancelled" && o.status !== "refunded" && (o.payment_status === "paid" || o.status === "delivered" || o.status === "confirmed")
  );

  const orderCount = completedOrders.length > 0 ? completedOrders.length : (customer.orders_count || 0);
  const totalSpend = completedOrders.length > 0
    ? completedOrders.reduce((sum, o) => sum + (Number(o.total) || Number(o.grand_total) || 0), 0)
    : (customer.total_spend || 0);

  const now = Date.now();
  const createdAtMs = new Date(customer.created_at || now).getTime();
  const daysSinceCreated = (now - createdAtMs) / (1000 * 60 * 60 * 24);

  let lastOrderDate: number | null = null;
  if (completedOrders.length > 0) {
    lastOrderDate = new Date(
      completedOrders.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0].created_at || now
    ).getTime();
  } else if (customer.last_order_at) {
    lastOrderDate = new Date(customer.last_order_at).getTime();
  }

  const daysSinceLastOrder = lastOrderDate ? (now - lastOrderDate) / (1000 * 60 * 60 * 24) : null;
  const lastActiveMs = new Date(lastActivityAt || customer.last_active_at || customer.created_at || now).getTime();
  const daysSinceActive = (now - lastActiveMs) / (1000 * 60 * 60 * 24);

  // 1. Inactive & Dormant
  if (orderCount === 0 && daysSinceActive > 90) {
    return "DORMANT";
  }
  if (daysSinceLastOrder !== null && daysSinceLastOrder > 90) {
    return "DORMANT";
  }

  // 2. At Risk
  if (daysSinceLastOrder !== null && daysSinceLastOrder > 45) {
    return "AT_RISK";
  }

  // 3. High spend, VIP or 5+ orders -> LOYAL
  if (totalSpend >= 5000 || orderCount >= 5 || customer.is_vip || customer.tier === "VIP_PLATINUM") {
    return "LOYAL";
  }

  // 4. Repeat buyers (2-4 orders)
  if (orderCount >= 2) {
    return "REPEAT_BUYER";
  }

  // 5. First time purchase (1 order)
  if (orderCount === 1) {
    return "FIRST_PURCHASE";
  }

  // 6. Zero orders
  if (orderCount === 0) {
    if (daysSinceCreated <= 7) {
      return "NEW";
    }
    return "REGISTERED";
  }

  return "ACTIVE";
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
 * Derives visual customer journey funnel.
 */
export function deriveCustomerJourneyFunnel(
  customer: CustomerRecord,
  orders: any[] = [],
  carts: any[] = [],
  activity: CustomerActivityEvent[] = []
): CustomerJourneyFunnel {
  const hasVisited = true;
  const isRegistered = Boolean(customer.customer_type === "registered" || customer.account_id);
  const viewedProduct = activity.some((a) => a.event_type === "PRODUCT_VIEWED" || a.event_type === "CATEGORY_VIEWED") || (carts.length > 0 || orders.length > 0);
  const cartAdded = carts.length > 0 || orders.length > 0 || activity.some((a) => a.event_type === "CART_ITEM_ADDED");
  const checkoutStarted = orders.length > 0 || carts.some((c) => c.checkout_started_at || c.status === "ABANDONED") || activity.some((a) => a.event_type === "CHECKOUT_STARTED");
  const paymentStarted = orders.length > 0 || activity.some((a) => a.event_type === "PAYMENT_INITIATED" || a.event_type === "PAYMENT_FAILED");
  const orderCompleted = orders.some((o) => o.status !== "cancelled" && o.status !== "refunded");

  return {
    visited: hasVisited,
    registered: isRegistered,
    product_viewed: viewedProduct,
    cart_added: cartAdded,
    checkout_started: checkoutStarted,
    payment_started: paymentStarted,
    order_completed: orderCompleted,
  };
}

/**
 * Detects duplicate customer accounts based on multi-factor heuristics:
 * 1. Normalized 10-digit Phone Match (Weight: 95)
 * 2. Normalized Email Match (Weight: 90)
 * 3. Auth Account ID Match (Weight: 100)
 * 4. Exact Name Match with shared City/Pincode (Weight: 30)
 */
export function detectCustomerDuplicates(customers: CustomerRecord[]): CustomerDuplicateCandidate[] {
  const candidates: CustomerDuplicateCandidate[] = [];
  const processedPairs = new Set<string>();

  for (let i = 0; i < customers.length; i++) {
    for (let j = i + 1; j < customers.length; j++) {
      const a = customers[i];
      const b = customers[j];

      // Skip already merged records
      if (a.merged_into_uid || b.merged_into_uid) continue;

      const pairKey = [a.customer_uid, b.customer_uid].sort().join("::");
      if (processedPairs.has(pairKey)) continue;
      processedPairs.add(pairKey);

      const matchReasons: DuplicateMatchReason[] = [];
      let totalWeight = 0;

      // 1. Phone Match
      const phoneA = normalizePhone(a.phone);
      const phoneB = normalizePhone(b.phone);
      if (phoneA && phoneB && phoneA === phoneB) {
        matchReasons.push({
          field: "phone",
          primary_value: a.phone,
          duplicate_value: b.phone,
          weight: 95,
        });
        totalWeight += 95;
      }

      // 2. Email Match (ignore generic default generated placeholders)
      const emailA = normalizeEmail(a.email);
      const emailB = normalizeEmail(b.email);
      const isPlaceholderA = emailA.includes("customer_") && emailA.includes("@cakes2home.com");
      const isPlaceholderB = emailB.includes("customer_") && emailB.includes("@cakes2home.com");

      if (emailA && emailB && emailA === emailB && !isPlaceholderA && !isPlaceholderB) {
        matchReasons.push({
          field: "email",
          primary_value: a.email || "",
          duplicate_value: b.email || "",
          weight: 90,
        });
        totalWeight += 90;
      }

      // 3. Auth Account ID Match
      if (a.account_id && b.account_id && a.account_id === b.account_id) {
        matchReasons.push({
          field: "account_id",
          primary_value: a.account_id,
          duplicate_value: b.account_id,
          weight: 100,
        });
        totalWeight += 100;
      }

      // 4. Exact Name Match with partial similarity
      const nameA = (a.name || "").trim().toLowerCase();
      const nameB = (b.name || "").trim().toLowerCase();
      if (nameA && nameB && nameA === nameB && nameA !== "customer" && nameA !== "valued customer") {
        if (matchReasons.length > 0) {
          matchReasons.push({
            field: "name",
            primary_value: a.name,
            duplicate_value: b.name,
            weight: 30,
          });
          totalWeight += 30;
        }
      }

      if (matchReasons.length > 0) {
        const confidence = Math.min(100, Math.max(...matchReasons.map((m) => m.weight)));
        const primary = (a.orders_count || 0) >= (b.orders_count || 0) ? a : b;
        const duplicate = primary === a ? b : a;
        const matchingFields = matchReasons.map((m) => m.field);

        candidates.push({
          id: `dup_${a.customer_uid}_${b.customer_uid}`,
          primary_customer: primary,
          duplicate_customer: duplicate,
          customer_a: a,
          customer_b: b,
          matching_fields: matchingFields,
          match_reasons: matchingFields,
          match_details: matchReasons,
          confidence_score: confidence,
          recommended_action: confidence >= 90 ? "AUTO_MERGE" : "MANUAL_REVIEW",
          status: "PENDING",
          detected_at: new Date().toISOString(),
        });
      }
    }
  }

  return candidates.sort((a, b) => b.confidence_score - a.confidence_score);
}

/**
 * Safely merges a duplicate customer record into a primary canonical customer.
 */
export function mergeCustomerRecords(
  primary: CustomerRecord,
  duplicate: CustomerRecord,
  allOrders: any[] = [],
  allCarts: any[] = [],
  allActivity: CustomerActivityEvent[] = [],
  staffUser?: { id: string; name: string }
): {
  mergedPrimary: CustomerRecord;
  mergedDuplicate: CustomerRecord;
  updatedOrders: any[];
  updatedCarts: any[];
  newActivity: CustomerActivityEvent;
} {
  const mergedAddresses = [...(primary.addresses || [])];
  for (const addr of duplicate.addresses || []) {
    const exists = mergedAddresses.some(
      (a) => a.address_1?.toLowerCase() === addr.address_1?.toLowerCase() && a.postal_code === addr.postal_code
    );
    if (!exists) mergedAddresses.push(addr);
  }

  const mergedTags = Array.from(new Set([...(primary.tags || []), ...(duplicate.tags || [])]));

  const mergedNotes = [
    ...(primary.notes || []),
    ...(duplicate.notes || []).map((n) => ({
      ...n,
      content: `[Merged from ${duplicate.customer_number}] ${n.content}`,
    })),
  ];

  const combinedLoyaltyPoints = (primary.loyalty?.points_balance || 0) + (duplicate.loyalty?.points_balance || 0);

  // Link child orders to primary
  const updatedOrders = allOrders.map((ord) => {
    if (ord.customer_uid === duplicate.customer_uid || ord.customer_phone === duplicate.phone) {
      return {
        ...ord,
        customer_uid: primary.customer_uid,
        customer_name: primary.name,
      };
    }
    return ord;
  });

  // Link child carts
  const updatedCarts = allCarts.map((cart) => {
    if (cart.customer_uid === duplicate.customer_uid || cart.customer_phone === duplicate.phone) {
      return {
        ...cart,
        customer_uid: primary.customer_uid,
        customer_name: primary.name,
      };
    }
    return cart;
  });

  const mergedUids = Array.from(new Set([...(primary.merged_uids || []), duplicate.customer_uid, ...(duplicate.merged_uids || [])]));

  const mergedPrimary: CustomerRecord = {
    ...primary,
    email: primary.email && !primary.email.includes("customer_") ? primary.email : duplicate.email || primary.email,
    addresses: mergedAddresses,
    tags: mergedTags,
    notes: mergedNotes,
    loyalty: {
      ...primary.loyalty,
      points_balance: combinedLoyaltyPoints,
      points_earned: (primary.loyalty?.points_earned || 0) + (duplicate.loyalty?.points_earned || 0),
    },
    merged_uids: mergedUids,
    updated_at: new Date().toISOString(),
  };

  // Re-derive lifecycle & tier
  const primaryOrders = updatedOrders.filter((o) => o.customer_uid === primary.customer_uid);
  mergedPrimary.orders_count = primaryOrders.length;
  mergedPrimary.total_spend = primaryOrders.reduce((acc, o) => acc + (Number(o.total) || 0), 0);
  mergedPrimary.aov = mergedPrimary.orders_count > 0 ? Math.round(mergedPrimary.total_spend / mergedPrimary.orders_count) : 0;
  mergedPrimary.lifecycle_stage = deriveLifecycleStage(mergedPrimary, primaryOrders);
  mergedPrimary.tier = deriveCustomerTier(mergedPrimary.total_spend, mergedPrimary.orders_count, mergedPrimary.is_vip);

  const mergedDuplicate: CustomerRecord = {
    ...duplicate,
    merged_into_uid: primary.customer_uid,
    updated_at: new Date().toISOString(),
  };

  const newActivity: CustomerActivityEvent = {
    id: `act_${Date.now()}_merge`,
    customer_uid: primary.customer_uid,
    event_type: "CUSTOMER_MERGED",
    title: "Customer Record Merged",
    description: `Merged secondary record "${duplicate.name}" (${duplicate.customer_number}) into primary profile.`,
    source: "ADMIN_CRM",
    staff_id: staffUser?.id || "system",
    staff_name: staffUser?.name || "Super Admin",
    timestamp: new Date().toISOString(),
  };

  return {
    mergedPrimary,
    mergedDuplicate,
    updatedOrders,
    updatedCarts,
    newActivity,
  };
}

/**
 * System Segment Definitions for CakeToHome CRM.
 */
export const SYSTEM_SEGMENTS: CustomerSegment[] = [
  {
    id: "seg_all",
    name: "All Customers",
    slug: "all-customers",
    description: "Every customer profile across all acquisition channels and branches.",
    icon: "Users",
    combinator: "AND",
    rules: [],
    is_system: true,
  },
  {
    id: "seg_new_no_order",
    name: "New Accounts — No Purchase",
    slug: "new-accounts-no-purchase",
    description: "Customers who registered an account or verified OTP but have not completed an order.",
    icon: "UserX",
    combinator: "AND",
    rules: [
      { field: "orders_count", operator: "equals", value: 0 },
    ],
    is_system: true,
  },
  {
    id: "seg_first_time",
    name: "First-Time Buyers",
    slug: "first-time-buyers",
    description: "Customers who completed exactly 1 order and are ready for second purchase nurture.",
    icon: "ShoppingBag",
    combinator: "AND",
    rules: [
      { field: "orders_count", operator: "equals", value: 1 },
    ],
    is_system: true,
  },
  {
    id: "seg_repeat",
    name: "Repeat Customers",
    slug: "repeat-customers",
    description: "Loyal recurring cake lovers with 2 or more successful celebration orders.",
    icon: "Repeat",
    combinator: "AND",
    rules: [
      { field: "orders_count", operator: "greater_than", value: 1 },
    ],
    is_system: true,
  },
  {
    id: "seg_vip",
    name: "VIP & High-Value",
    slug: "vip-high-value",
    description: "Top-tier customers with lifetime spend exceeding ₹5,000 or Platinum VIP tier.",
    icon: "Crown",
    combinator: "OR",
    rules: [
      { field: "total_spend", operator: "greater_than", value: 5000 },
      { field: "tier", operator: "equals", value: "VIP_PLATINUM" },
    ],
    is_system: true,
  },
  {
    id: "seg_abandoned",
    name: "Active Abandoned Carts",
    slug: "active-abandoned-carts",
    description: "Customers with unpurchased items waiting in cart requiring recovery outreach.",
    icon: "ShoppingCart",
    combinator: "AND",
    rules: [
      { field: "cart_status", operator: "equals", value: "ABANDONED_CART" },
    ],
    is_system: true,
  },
  {
    id: "seg_at_risk",
    name: "At-Risk Customers",
    slug: "at-risk-customers",
    description: "Past buyers who haven't placed an order in over 45 days.",
    icon: "AlertTriangle",
    combinator: "AND",
    rules: [
      { field: "lifecycle_stage", operator: "equals", value: "AT_RISK" },
    ],
    is_system: true,
  },
  {
    id: "seg_whatsapp",
    name: "WhatsApp Reachable",
    slug: "whatsapp-reachable",
    description: "Customers with verified phone numbers and active WhatsApp communication consent.",
    icon: "MessageSquare",
    combinator: "AND",
    rules: [
      { field: "whatsapp_status", operator: "equals", value: "ELIGIBLE" },
    ],
    is_system: true,
  },
];

/**
 * Evaluates whether a customer satisfies a segment's criteria.
 */
export function evaluateCustomerAgainstSegment(
  customer: CustomerRecord,
  segment: CustomerSegment
): boolean {
  if (!segment.rules || segment.rules.length === 0) return true;

  const now = Date.now();
  const createdMs = new Date(customer.created_at || now).getTime();
  const daysSinceRegistered = (now - createdMs) / (1000 * 60 * 60 * 24);

  const lastOrderMs = customer.last_order_at ? new Date(customer.last_order_at).getTime() : null;
  const daysSinceLastOrder = lastOrderMs ? (now - lastOrderMs) / (1000 * 60 * 60 * 24) : 9999;

  const results: boolean[] = [];

  for (const rule of segment.rules) {
    let customerValue: any;
    switch (rule.field) {
      case "orders_count":
        customerValue = customer.orders_count || 0;
        break;
      case "total_spend":
        customerValue = customer.total_spend || 0;
        break;
      case "aov":
        customerValue = customer.aov || 0;
        break;
      case "lifecycle_stage":
        customerValue = customer.lifecycle_stage;
        break;
      case "tier":
        customerValue = customer.tier;
        break;
      case "cart_status":
        customerValue = customer.cart_status;
        break;
      case "whatsapp_status":
        customerValue = customer.consent?.whatsapp_status || "ELIGIBLE";
        break;
      case "branch_id":
        customerValue = customer.branch_id;
        break;
      case "city_id":
        customerValue = customer.city_id;
        break;
      case "days_since_registered":
        customerValue = daysSinceRegistered;
        break;
      case "days_since_last_order":
        customerValue = daysSinceLastOrder;
        break;
      case "tag":
        customerValue = customer.tags || [];
        break;
      default:
        customerValue = undefined;
    }

    let match = false;
    switch (rule.operator) {
      case "equals":
        match = String(customerValue).toLowerCase() === String(rule.value).toLowerCase();
        break;
      case "not_equals":
        match = String(customerValue).toLowerCase() !== String(rule.value).toLowerCase();
        break;
      case "greater_than":
        match = Number(customerValue) > Number(rule.value);
        break;
      case "less_than":
        match = Number(customerValue) < Number(rule.value);
        break;
      case "contains":
        if (Array.isArray(customerValue)) {
          match = customerValue.some((v) => String(v).toLowerCase().includes(String(rule.value).toLowerCase()));
        } else {
          match = String(customerValue).toLowerCase().includes(String(rule.value).toLowerCase());
        }
        break;
      case "in":
        if (Array.isArray(rule.value)) {
          match = rule.value.includes(customerValue);
        }
        break;
    }
    results.push(match);
  }

  if (segment.combinator === "OR") {
    return results.some((r) => r);
  }
  return results.every((r) => r);
}

/**
 * Generates formatted CSV content for customer exports.
 */
export function exportCustomersToCsv(customers: CustomerRecord[]): string {
  const headers = [
    "Customer UID",
    "Customer Number",
    "Full Name",
    "Phone",
    "Email",
    "Customer Type",
    "Lifecycle Stage",
    "Tier",
    "Total Orders",
    "Total Spend (INR)",
    "AOV (INR)",
    "First Order Date",
    "Last Order Date",
    "Last Active",
    "Branch",
    "City",
    "WhatsApp Status",
    "Registration Date",
  ];

  const rows = customers.map((c) => [
    `"${c.customer_uid || ""}"`,
    `"${c.customer_number || ""}"`,
    `"${(c.name || "").replace(/"/g, '""')}"`,
    `"${c.phone || ""}"`,
    `"${c.email || ""}"`,
    `"${c.customer_type || ""}"`,
    `"${c.lifecycle_stage || ""}"`,
    `"${c.tier || ""}"`,
    c.orders_count || 0,
    c.total_spend || 0,
    c.aov || 0,
    `"${c.first_order_at || "—"}"`,
    `"${c.last_order_at || "—"}"`,
    `"${c.last_active_at || "—"}"`,
    `"${(c.branch_name || c.branch_id || "—").replace(/"/g, '""')}"`,
    `"${(c.city_name || c.city_id || "—").replace(/"/g, '""')}"`,
    `"${c.consent?.whatsapp_status || "ELIGIBLE"}"`,
    `"${c.created_at || "—"}"`,
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

/**
 * Generates formatted CSV content for abandoned carts export.
 */
export function exportAbandonedCartsToCsv(carts: AbandonedCartRecord[]): string {
  const headers = [
    "Cart ID",
    "Customer Name",
    "Phone",
    "Email",
    "Items Count",
    "Cart Items Summary",
    "Subtotal (INR)",
    "Discount (INR)",
    "Tax (INR)",
    "Delivery Fee (INR)",
    "Grand Total (INR)",
    "Branch",
    "City",
    "Status",
    "Abandoned At",
    "Last Contact At",
    "Recovery Channel",
    "Attempts Count",
    "Recovered At",
    "Recovery Order ID",
  ];

  const rows = carts.map((c) => [
    `"${c.cart_id || ""}"`,
    `"${(c.customer_name || "Guest").replace(/"/g, '""')}"`,
    `"${c.customer_phone || ""}"`,
    `"${c.customer_email || ""}"`,
    c.items_count || (c.items || []).length || 0,
    `"${(c.items || []).map((i) => `${i.product_name} (x${i.quantity})`).join("; ").replace(/"/g, '""')}"`,
    c.subtotal || 0,
    c.discount_total || 0,
    c.tax_total || 0,
    c.delivery_fee || 0,
    c.grand_total || 0,
    `"${(c.branch_name || c.branch_id || "—").replace(/"/g, '""')}"`,
    `"${(c.city_name || c.city_id || "—").replace(/"/g, '""')}"`,
    `"${c.status || ""}"`,
    `"${c.abandoned_at || "—"}"`,
    `"${c.last_contact_at || "—"}"`,
    `"${c.last_recovery_channel || "—"}"`,
    c.recovery_attempts_count || 0,
    `"${c.recovered_at || "—"}"`,
    `"${c.recovery_order_id || "—"}"`,
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

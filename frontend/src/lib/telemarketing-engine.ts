/**
 * CakeToHome Telemarketing Reorder & Reactivation Intelligence Engine
 * 
 * Architecture:
 * AUTH / CUSTOMER PROFILE
 *         ↓
 * CANONICAL CUSTOMER UID
 *         ↓
 * REAL COMPLETED ORDER HISTORY
 *         ↓
 * PURCHASE PATTERNS & OCCASION INTELLIGENCE
 *         ↓
 * REORDER / REACTIVATION OPPORTUNITY ENGINE
 *         ↓
 * 5-SIGNAL DETERMINISTIC SCORING ENGINE (0-100)
 *         ↓
 * OUTREACH QUEUE & STAFF ASSIGNMENT (STAFF ACCESS PROFILES)
 *         ↓
 * CALL / WHATSAPP / CONTACT LIFECYCLE
 *         ↓
 * FOLLOW-UP SCHEDULING
 *         ↓
 * ORDER CONVERSION & ATTRIBUTED REVENUE
 *         ↓
 * CRM 360 & ANALYTICS
 */

import { WebhookEngine } from "./webhook-engine";
import { normalizePhone, formatDisplayPhone } from "./crm/crm-engine";

export type ReorderPriority = "HIGH" | "MEDIUM" | "LOW";

export type OpportunityType =
  | "BIRTHDAY_REORDER"
  | "ANNIVERSARY_REORDER"
  | "SEASONAL_REORDER"
  | "PRODUCT_REORDER"
  | "CATEGORY_REORDER"
  | "HIGH_VALUE_REACTIVATION"
  | "DORMANT_CUSTOMER"
  | "RECENT_REPEAT_PURCHASE"
  | "SPECIAL_OCCASION"
  | "CUSTOMER_REQUESTED_FOLLOWUP";

export type TelemarketingContactStatus =
  | "NEW"
  | "QUEUED"
  | "ASSIGNED"
  | "CALL_DUE"
  | "CALLED"
  | "CONNECTED"
  | "NO_ANSWER"
  | "BUSY"
  | "WRONG_NUMBER"
  | "INTERESTED"
  | "NOT_INTERESTED"
  | "FOLLOW_UP"
  | "ORDER_PLACED"
  | "CONVERTED"
  | "DO_NOT_CONTACT"
  | "EXPIRED";

export interface ScoreBreakdown {
  timing_score: number; // 0-30
  occasion_score: number; // 0-25
  purchase_frequency_score: number; // 0-20
  customer_value_score: number; // 0-15
  engagement_score: number; // 0-10
  total: number; // 0-100
  signals: {
    timing_reason: string;
    occasion_reason: string;
    frequency_reason: string;
    value_reason: string;
    engagement_reason: string;
  };
}

export interface CallNote {
  id: string;
  staff_id?: string | null;
  agent_name: string;
  outcome: TelemarketingContactStatus | string;
  status?: TelemarketingContactStatus;
  note: string;
  next_followup_date?: string | null;
  created_at: string;
}

export interface ReorderCandidate {
  id: string;
  dedupe_key: string;
  customer_uid: string; // Single Canonical Identity (cth_cus_XXXXXXXXXX or cus_XXXX)
  customer_id: string; // Compatibility alias
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  city_id?: string;
  city: string;
  area?: string;
  pincode?: string;
  preferred_branch_id?: string;
  preferred_branch_name?: string;

  // Opportunity Classification
  opportunity_type: OpportunityType;

  // Historical Order Context
  reference_order_id: string;
  reference_order_number: string;
  reference_order_date: string;
  days_since_reference_order: number;
  reference_product_id?: string;
  reference_product_name: string;
  reference_category: string;
  reference_occasion: string;
  reference_order_value: number;

  // Customer Lifetime Profile
  historical_order_count: number;
  repeat_purchase_count: number;
  average_order_value: number;
  total_lifetime_spend: number;
  last_order_date: string;

  // Target Opportunity Window & Expected Date
  target_year: number;
  target_window_start: string;
  target_window_end: string;
  suggested_followup_date: string;
  expected_date: string;
  expected_date_confidence: "HIGH" | "MEDIUM" | "LOW";
  expected_date_reason?: string;

  // Scoring & Explainability
  score: number;
  priority: ReorderPriority;
  score_breakdown: ScoreBreakdown;
  reason: string;
  pitch: string; // Safe, factual pitch
  recommended_product_id?: string;
  recommended_product_name: string;
  recommended_addons?: Array<{ id: string; name: string; price: number }>;

  // Outreach & Workflow State
  contact_status: TelemarketingContactStatus;
  assigned_staff_id?: string | null;
  assigned_to?: string | null;
  assigned_at?: string | null;
  last_contacted_at?: string | null;
  next_followup_date?: string | null;
  call_notes: CallNote[];

  // Conversion & Attribution
  attributed_order_id?: string | null;
  converted_order_id?: string | null;
  attributed_revenue?: number;
  conversion_value?: number;
  converted_at?: string | null;

  // Privacy & Consent
  marketing_consent: boolean;
  do_not_contact: boolean;
  created_at: string;
  updated_at: string;
}

export interface TelemarketingMetrics {
  total_candidates: number;
  high_priority: number;
  medium_priority: number;
  low_priority: number;
  calls_due_today: number;
  follow_ups_due: number;
  orders_generated: number;
  revenue_generated: number;
  conversion_rate_pct: number;
  connected_count: number;
  contacted_count: number;
  interested_count: number;
}

/** Today's date in India (the call team works in IST). */
const istToday = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

class TelemarketingEngineStore {
  private candidates: ReorderCandidate[] = [];
  private toleranceDays: number = 14; // Default ±14 days anniversary window
  private attributionWindowDays: number = 14; // 14-day outreach conversion attribution window

  // Candidates come only from real order history (evaluateHistoricalOrders).

  /** Snapshot of every candidate (for saving to the database). */
  public exportAll(): ReorderCandidate[] {
    return this.candidates;
  }

  /** Replace in-memory candidates with the saved list (loaded from the database). */
  public importAll(list: ReorderCandidate[]) {
    this.candidates = Array.isArray(list) ? list : [];
  }

  public setToleranceDays(days: number) {
    this.toleranceDays = Math.max(1, days);
  }

  public getToleranceDays(): number {
    return this.toleranceDays;
  }

  public setAttributionWindowDays(days: number) {
    this.attributionWindowDays = Math.max(1, days);
  }

  // ── 5-Signal Deterministic Explainable Scoring Engine ───────────
  public calculateDeterministicScore(params: {
    daysDiff: number; // Days between today and anniversary/expected date
    occasion: string;
    historicalOrderCount: number;
    repeatPurchaseCount: number;
    lifetimeSpend: number;
    aov: number;
    marketingConsent?: boolean;
  }): ScoreBreakdown {
    // 1. Timing Match Score (Max 30 pts)
    let timing_score = 0;
    let timing_reason = "";
    if (params.daysDiff <= 3) {
      timing_score = 30;
      timing_reason = `Immediate celebration window (±${params.daysDiff} days). Peak reorder conversion rate.`;
    } else if (params.daysDiff <= 7) {
      timing_score = 25;
      timing_reason = `Within 1-week celebration preparation window (±${params.daysDiff} days).`;
    } else if (params.daysDiff <= 14) {
      timing_score = 18;
      timing_reason = `Within 2-week active planning window (±${params.daysDiff} days).`;
    } else {
      timing_score = 10;
      timing_reason = `Extended planning horizon (> 14 days).`;
    }

    // 2. Occasion Confidence Score (Max 25 pts)
    let occasion_score = 0;
    let occasion_reason = "";
    const occLower = (params.occasion || "").toLowerCase();
    if (occLower.includes("birthday")) {
      occasion_score = 25;
      occasion_reason = "Explicit annual birthday celebration (Highest recurring certainty).";
    } else if (occLower.includes("anniversary") || occLower.includes("wedding")) {
      occasion_score = 23;
      occasion_reason = "Explicit annual wedding/milestone anniversary.";
    } else if (occLower.includes("festival") || occLower.includes("diwali") || occLower.includes("christmas") || occLower.includes("new year")) {
      occasion_score = 18;
      occasion_reason = "Predictable calendar seasonal celebration.";
    } else if (occLower.includes("gathering") || occLower.includes("party")) {
      occasion_score = 12;
      occasion_reason = "Social celebration / group gathering.";
    } else {
      occasion_score = 8;
      occasion_reason = "General repeat indulgence order.";
    }

    // 3. Purchase Frequency Score (Max 20 pts)
    let purchase_frequency_score = 0;
    let frequency_reason = "";
    if (params.historicalOrderCount >= 4) {
      purchase_frequency_score = 20;
      frequency_reason = `High-loyalty customer with ${params.historicalOrderCount} completed orders.`;
    } else if (params.historicalOrderCount >= 2) {
      purchase_frequency_score = 15;
      frequency_reason = `Established repeat buyer with ${params.historicalOrderCount} completed orders.`;
    } else {
      purchase_frequency_score = 8;
      frequency_reason = `Single prior purchase. Opportunity to build second-order habit.`;
    }

    // 4. Customer Value Score (Max 15 pts)
    let customer_value_score = 0;
    let value_reason = "";
    if (params.lifetimeSpend >= 5000 || params.aov >= 1400) {
      customer_value_score = 15;
      value_reason = `High-LTV tier: Lifetime spend ₹${params.lifetimeSpend.toLocaleString("en-IN")} / AOV ₹${params.aov.toLocaleString("en-IN")}.`;
    } else if (params.lifetimeSpend >= 1200 || params.aov >= 900) {
      customer_value_score = 11;
      value_reason = `Solid mid-tier customer: Lifetime spend ₹${params.lifetimeSpend.toLocaleString("en-IN")}.`;
    } else {
      customer_value_score = 6;
      value_reason = `Standard order value customer: Lifetime spend ₹${params.lifetimeSpend.toLocaleString("en-IN")}.`;
    }

    // 5. Engagement & Contactability Score (Max 10 pts)
    let engagement_score = 0;
    let engagement_reason = "";
    if (params.marketingConsent !== false) {
      engagement_score = 10;
      engagement_reason = "Active customer profile with valid communication consent.";
    } else {
      engagement_score = 3;
      engagement_reason = "Communication permissions require confirmation during outreach.";
    }

    const total = Math.min(100, Math.round(timing_score + occasion_score + purchase_frequency_score + customer_value_score + engagement_score));

    return {
      timing_score,
      occasion_score,
      purchase_frequency_score,
      customer_value_score,
      engagement_score,
      total,
      signals: {
        timing_reason,
        occasion_reason,
        frequency_reason,
        value_reason,
        engagement_reason,
      },
    };
  }

  // ── Customer-Safe Dynamic Pitch & Reason Generator ───────────
  public generateSafePitch(params: {
    customerName: string;
    productName: string;
    occasion: string;
    orderDateStr: string;
    opportunityType: OpportunityType;
    cityName: string;
  }): { reason: string; pitch: string } {
    const firstName = (params.customerName || "").split(" ")[0] || "Valued Patron";

    let reason = `Customer ordered a ${params.occasion} (${params.productName}) on ${params.orderDateStr} in ${params.cityName}.`;
    let pitch = `Hi ${firstName}, last year you ordered our ${params.productName} for a ${params.occasion.toLowerCase()}. We can freshly bake and deliver a similar gourmet cake for your upcoming celebration!`;

    switch (params.opportunityType) {
      case "BIRTHDAY_REORDER":
        reason = `Customer ordered a Birthday ${params.productName} on ${params.orderDateStr} (~1 year ago). High probability of recurring annual birthday celebration.`;
        pitch = `Hi ${firstName}, last year you celebrated a special birthday with our ${params.productName}. We can prepare a freshly baked cake and customize the chocolate message plaque for your celebration this year.`;
        break;
      case "ANNIVERSARY_REORDER":
        reason = `Customer celebrated a Wedding Anniversary with ${params.productName} on ${params.orderDateStr}. Annual anniversary occasion match.`;
        pitch = `Hi ${firstName}, warm wishes from CakeToHome! Last year you celebrated an anniversary with our ${params.productName}. Would you like us to schedule a fresh cake and flower delivery for your anniversary?`;
        break;
      case "SEASONAL_REORDER":
        reason = `Customer ordered seasonal special ${params.productName} during the ${params.orderDateStr} festival season.`;
        pitch = `Hi ${firstName}, our seasonal ${params.productName} is back in our bakery! Since you enjoyed it last season, we would love to deliver a freshly handcrafted batch for your upcoming gathering.`;
        break;
      case "HIGH_VALUE_REACTIVATION":
        reason = `High-value patron previously ordered ${params.productName} on ${params.orderDateStr}. Re-engagement candidate.`;
        pitch = `Hi ${firstName}, as one of our valued premium patrons, we wanted to share our latest handcrafted master chef cake creations with exclusive priority delivery for your next celebration.`;
        break;
      default:
        reason = `Customer placed an order for ${params.productName} on ${params.orderDateStr}. Reorder outreach candidate.`;
        pitch = `Hi ${firstName}, thank you for choosing CakeToHome for your ${params.productName}. We would be delighted to assist you with any upcoming sweet celebrations or dessert orders.`;
        break;
    }

    return { reason, pitch };
  }

  // ── Candidate Generation from Real Order History ──────────
  public evaluateHistoricalOrders(
    sourceOrders: any[] = [],
    currentDateStr: string = new Date().toISOString()
  ): { evaluated: number; new_candidates: number; updated_candidates: number } {
    const today = new Date(currentDateStr);
    const targetYear = today.getUTCFullYear();

    let newCandidatesCount = 0;
    let updatedCandidatesCount = 0;

    // Group orders by customer canonical UID to calculate real profile lifetime metrics
    const ordersByCustomer = new Map<string, any[]>();
    for (const ord of sourceOrders) {
      if (ord.order_status === "CANCELLED" || ord.status === "CANCELLED" || ord.orderStatus === "CANCELLED") {
        continue;
      }
      const rawPhone = ord.customer_phone || ord.customerPhone || ord.phone || "";
      const cleanPhone = normalizePhone(rawPhone);
      const customerUid = ord.customer_uid || (cleanPhone ? `cth_cus_${cleanPhone}` : ord.customer_id || `cus_${ord.id}`);

      if (!ordersByCustomer.has(customerUid)) {
        ordersByCustomer.set(customerUid, []);
      }
      ordersByCustomer.get(customerUid)!.push(ord);
    }

    for (const [customerUid, custOrders] of ordersByCustomer.entries()) {
      if (!custOrders.length) continue;

      // Sort chronological
      custOrders.sort((a, b) => new Date(a.order_date || a.orderDate || a.created_at).getTime() - new Date(b.order_date || b.orderDate || b.created_at).getTime());

      const historicalOrderCount = custOrders.length;
      const repeatPurchaseCount = Math.max(0, historicalOrderCount - 1);
      const totalSpend = custOrders.reduce((sum, o) => sum + (Number(o.total || o.grossAmount || o.netAmount) || 0), 0);
      const aov = Math.round(totalSpend / historicalOrderCount);
      const lastOrder = custOrders[custOrders.length - 1];

      // Evaluate each completed order for occasion patterns
      for (const ord of custOrders) {
        const ordDate = new Date(ord.order_date || ord.orderDate || ord.created_at);
        if (isNaN(ordDate.getTime())) continue;

        const daysSinceOrder = Math.floor((today.getTime() - ordDate.getTime()) / (1000 * 60 * 60 * 24));

        // The occasion is the day the cake was for (delivery date), falling back to the order date.
        const rawOccasion = String(ord.delivery_date || ord.deliveryDate || ord.delivery?.date || "").slice(0, 10);
        const occasionDate = /^\d{4}-\d{2}-\d{2}$/.test(rawOccasion) ? new Date(`${rawOccasion}T00:00:00Z`) : ordDate;
        const occasionYear = occasionDate.getUTCFullYear();

        // Nearest anniversary to today (handles Dec/Jan), and only for occasions in an earlier year —
        // a cake bought for this year's occasion is not a "same time last year" reminder.
        let anniversaryDate = new Date(occasionDate);
        let daysDiff = Number.POSITIVE_INFINITY;
        for (const y of [targetYear - 1, targetYear, targetYear + 1]) {
          if (y <= occasionYear) continue;
          const cand = new Date(occasionDate);
          cand.setUTCFullYear(y);
          const diff = Math.abs(Math.floor((today.getTime() - cand.getTime()) / (1000 * 60 * 60 * 24)));
          if (diff < daysDiff) { daysDiff = diff; anniversaryDate = cand; }
        }

        // Candidate qualifies if within tolerance window (default ±14 days) or is dormant high-value
        const isAnniversaryWindow = daysDiff <= this.toleranceDays;
        // Win-back: one reminder per customer, based on their most recent order only.
        const isDormantCandidate = ord === lastOrder && daysSinceOrder >= 60 && totalSpend >= 2000;

        if (!isAnniversaryWindow && !isDormantCandidate) {
          continue;
        }

        // Determine Opportunity Type
        const occasionStr = ord.occasion || ord.occasion_name || "Previous order";
        // Only label it a birthday when the order actually says so; otherwise it's a
        // "same time last year" product reorder.
        let oppType: OpportunityType = occasionStr.toLowerCase().includes("birthday") ? "BIRTHDAY_REORDER" : "PRODUCT_REORDER";
        if (occasionStr.toLowerCase().includes("anniversary") || occasionStr.toLowerCase().includes("wedding")) {
          oppType = "ANNIVERSARY_REORDER";
        } else if (occasionStr.toLowerCase().includes("festival") || occasionStr.toLowerCase().includes("season")) {
          oppType = "SEASONAL_REORDER";
        } else if (isDormantCandidate && !isAnniversaryWindow) {
          oppType = "HIGH_VALUE_REACTIVATION";
        } else if (repeatPurchaseCount >= 2) {
          oppType = "RECENT_REPEAT_PURCHASE";
        }

        const expectedDateStr = isAnniversaryWindow ? anniversaryDate.toISOString().slice(0, 10) : istToday();
        const dedupeKey = `${customerUid}_${oppType}_${expectedDateStr}_${ord.id || ord.order_number}`;

        const scoreBreakdown = this.calculateDeterministicScore({
          daysDiff: isAnniversaryWindow ? daysDiff : 10,
          occasion: occasionStr,
          historicalOrderCount,
          repeatPurchaseCount,
          lifetimeSpend: totalSpend,
          aov,
          marketingConsent: true,
        });

        const priority: ReorderPriority = scoreBreakdown.total >= 80 ? "HIGH" : scoreBreakdown.total >= 50 ? "MEDIUM" : "LOW";
        const prodName = ord.items?.[0]?.name || ord.items?.[0]?.product_name || ord.product_name || ord.productName || "Previous order";
        const custName = ord.customer_name || ord.customerName || ord.name || "Valued Customer";
        const custPhone = formatDisplayPhone(ord.customer_phone || ord.customerPhone || ord.phone || "");

        const { reason, pitch } = this.generateSafePitch({
          customerName: custName,
          productName: prodName,
          occasion: occasionStr,
          orderDateStr: occasionDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
          opportunityType: oppType,
          cityName: ord.city || "",
        });

        const startWindow = new Date(anniversaryDate);
        startWindow.setDate(startWindow.getDate() - this.toleranceDays);
        const endWindow = new Date(anniversaryDate);
        endWindow.setDate(endWindow.getDate() + this.toleranceDays);

        const existingIdx = this.candidates.findIndex((c) => c.dedupe_key === dedupeKey);
        if (existingIdx >= 0) {
          // Update score and details without resetting contact workflow state
          this.candidates[existingIdx].score = scoreBreakdown.total;
          this.candidates[existingIdx].priority = priority;
          this.candidates[existingIdx].score_breakdown = scoreBreakdown;
          this.candidates[existingIdx].updated_at = new Date().toISOString();
          updatedCandidatesCount++;
        } else {
          const newCandidate: ReorderCandidate = {
            id: `opp_${ord.id || ord.order_number}_${targetYear}_${Math.random().toString(36).substring(2, 6)}`,
            dedupe_key: dedupeKey,
            customer_uid: customerUid,
            customer_id: customerUid,
            customer_name: custName,
            customer_phone: custPhone,
            customer_email: ord.customer_email || ord.customerEmail || ord.email || null,
            city_id: (ord.city_id || ord.city || "").toLowerCase().replace(/\s+/g, "_"),
            city: ord.city || "",
            area: ord.delivery_area || ord.area || "",
            pincode: ord.delivery_pincode || ord.pincode || "",
            preferred_branch_id: ord.branch_id || "",
            preferred_branch_name: ord.branch_name || ord.branchName || "",

            opportunity_type: oppType,
            reference_order_id: ord.id || ord.order_number,
            reference_order_number: ord.order_number || ord.id,
            reference_order_date: ord.order_date || ord.orderDate || ord.created_at,
            days_since_reference_order: daysSinceOrder,
            reference_product_id: ord.items?.[0]?.product_id || null,
            reference_product_name: prodName,
            reference_category: ord.category || "",
            reference_occasion: occasionStr,
            reference_order_value: Number(ord.total || ord.grossAmount) || 0,

            historical_order_count: historicalOrderCount,
            repeat_purchase_count: repeatPurchaseCount,
            average_order_value: aov,
            total_lifetime_spend: totalSpend,
            last_order_date: lastOrder.order_date || lastOrder.created_at,

            target_year: targetYear,
            target_window_start: startWindow.toISOString().slice(0, 10),
            target_window_end: endWindow.toISOString().slice(0, 10),
            suggested_followup_date: expectedDateStr,
            expected_date: expectedDateStr,
            expected_date_confidence: daysDiff <= 7 ? "HIGH" : daysDiff <= 14 ? "MEDIUM" : "LOW",
            expected_date_reason: isAnniversaryWindow
              ? `Annual anniversary celebration recurrence derived from ${ordDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} order.`
              : `High-value customer dormancy reactivation (> 60 days since last purchase).`,

            score: scoreBreakdown.total,
            priority,
            score_breakdown: scoreBreakdown,
            reason,
            pitch,
            recommended_product_id: ord.items?.[0]?.product_id || null,
            recommended_product_name: prodName,
            recommended_addons: [],

            contact_status: "NEW",
            assigned_staff_id: null,
            assigned_to: null,
            call_notes: [],
            marketing_consent: true,
            do_not_contact: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          this.candidates.unshift(newCandidate);
          newCandidatesCount++;

          // Emit n8n / webhook event for High Priority Opportunities
          if (priority === "HIGH") {
            WebhookEngine.emitEvent(
              "customer.reorder_candidate.created",
              {
                candidate_id: newCandidate.id,
                opportunity_id: newCandidate.id,
                customer_id: newCandidate.customer_id,
                customer_uid: newCandidate.customer_uid,
                customer_name: newCandidate.customer_name,
                customer_phone: newCandidate.customer_phone,
                priority: newCandidate.priority,
                score: newCandidate.score,
                opportunity_type: newCandidate.opportunity_type,
                previous_order_date: newCandidate.reference_order_date,
                target_followup_date: newCandidate.suggested_followup_date || newCandidate.expected_date,
                expected_date: newCandidate.expected_date,
                previous_product_id: newCandidate.reference_product_id,
                previous_occasion: newCandidate.reference_occasion,
                city_id: newCandidate.city_id,
                branch_id: newCandidate.preferred_branch_id,
                reason: newCandidate.reason,
                pitch: newCandidate.pitch,
              },
              { source: "telemarketing_reorder_engine" },
              {
                id: newCandidate.customer_uid,
                name: newCandidate.customer_name,
                phone: newCandidate.customer_phone,
                email: newCandidate.customer_email,
                city: newCandidate.city,
              }
            );
          }
        }
      }
    }

    return {
      evaluated: sourceOrders.length,
      new_candidates: newCandidatesCount,
      updated_candidates: updatedCandidatesCount,
    };
  }

  // ── Query Candidates with Rich Server-Side Filters ─────────
  public listCandidates(filters: {
    priority?: string;
    status?: string;
    city?: string;
    city_id?: string;
    branch_id?: string;
    assigned_to?: string;
    assigned_staff_id?: string;
    opportunity_type?: string;
    search?: string;
    date_filter?: string; // "today" | "tomorrow" | "next_7_days" | "this_week" | "next_30_days" | "all"
    startDate?: string;
    endDate?: string;
    customer_uid?: string;
    limit?: number;
    offset?: number;
  } = {}): { candidates: ReorderCandidate[]; total: number; metrics: TelemarketingMetrics } {
    let list = this.candidates.filter((c) => !c.do_not_contact);
    const todayStr = istToday();

    if (filters.customer_uid) {
      list = list.filter((c) => c.customer_uid === filters.customer_uid);
    }
    if (filters.priority && filters.priority !== "all") {
      list = list.filter((c) => c.priority === filters.priority);
    }
    if (filters.status && filters.status !== "all") {
      list = list.filter((c) => c.contact_status === filters.status);
    }
    if (filters.city && filters.city !== "all") {
      list = list.filter((c) => c.city.toLowerCase() === filters.city?.toLowerCase() || c.city_id === filters.city?.toLowerCase());
    }
    if (filters.branch_id && filters.branch_id !== "all") {
      list = list.filter((c) => c.preferred_branch_id === filters.branch_id);
    }
    if (filters.assigned_staff_id && filters.assigned_staff_id !== "all") {
      list = list.filter((c) => c.assigned_staff_id === filters.assigned_staff_id || c.assigned_to === filters.assigned_staff_id);
    } else if (filters.assigned_to && filters.assigned_to !== "all") {
      list = list.filter((c) => c.assigned_to === filters.assigned_to);
    }
    if (filters.opportunity_type && filters.opportunity_type !== "all") {
      list = list.filter((c) => c.opportunity_type === filters.opportunity_type);
    }
    if (filters.date_filter && filters.date_filter !== "all") {
      const now = new Date();
      if (filters.date_filter === "today") {
        list = list.filter((c) => c.expected_date === todayStr || c.suggested_followup_date === todayStr);
      } else if (filters.date_filter === "tomorrow") {
        const tom = new Date(now);
        tom.setDate(tom.getDate() + 1);
        const tomStr = tom.toISOString().slice(0, 10);
        list = list.filter((c) => c.expected_date === tomStr);
      } else if (filters.date_filter === "next_7_days") {
        const n7 = new Date(now);
        n7.setDate(n7.getDate() + 7);
        const n7Str = n7.toISOString().slice(0, 10);
        list = list.filter((c) => c.expected_date >= todayStr && c.expected_date <= n7Str);
      } else if (filters.date_filter === "next_30_days") {
        const n30 = new Date(now);
        n30.setDate(n30.getDate() + 30);
        const n30Str = n30.toISOString().slice(0, 10);
        list = list.filter((c) => c.expected_date >= todayStr && c.expected_date <= n30Str);
      }
    }
    if (filters.startDate) {
      list = list.filter((c) => c.expected_date >= filters.startDate!);
    }
    if (filters.endDate) {
      list = list.filter((c) => c.expected_date <= filters.endDate!);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.customer_name.toLowerCase().includes(q) ||
          c.customer_phone.includes(q) ||
          c.customer_uid.toLowerCase().includes(q) ||
          c.reference_order_number.toLowerCase().includes(q) ||
          c.reference_product_name.toLowerCase().includes(q) ||
          c.reference_occasion.toLowerCase().includes(q) ||
          c.city.toLowerCase().includes(q)
      );
    }

    const total = list.length;
    const offset = Number(filters.offset) || 0;
    const limit = Number(filters.limit) || 50;

    return {
      candidates: list.slice(offset, offset + limit),
      total,
      metrics: this.getCandidateMetrics(),
    };
  }

  // ── Telemarketing Executive Metrics ────────────────────────
  public getCandidateMetrics(): TelemarketingMetrics {
    const active = this.candidates.filter((c) => !c.do_not_contact);
    const todayStr = istToday();

    const highPriority = active.filter((c) => c.priority === "HIGH").length;
    const mediumPriority = active.filter((c) => c.priority === "MEDIUM").length;
    const lowPriority = active.filter((c) => c.priority === "LOW").length;

    const callsDueToday = active.filter(
      (c) =>
        (c.expected_date === todayStr || c.suggested_followup_date === todayStr) &&
        (c.contact_status === "NEW" || c.contact_status === "QUEUED" || c.contact_status === "ASSIGNED" || c.contact_status === "NO_ANSWER" || c.contact_status === "CALL_DUE")
    ).length;

    const followUpsDue = active.filter(
      (c) => c.contact_status === "FOLLOW_UP" && (c.next_followup_date ? c.next_followup_date <= todayStr : true)
    ).length;

    const ordersGenerated = active.filter((c) => c.contact_status === "ORDER_PLACED" || c.contact_status === "CONVERTED").length;
    const revenueGenerated = active.reduce((sum, c) => sum + (c.attributed_revenue || c.conversion_value || 0), 0);

    const contactedCount = active.filter((c) => c.contact_status !== "NEW" && c.contact_status !== "QUEUED").length;
    const connectedCount = active.filter((c) => ["CONNECTED", "INTERESTED", "FOLLOW_UP", "ORDER_PLACED", "CONVERTED"].includes(c.contact_status)).length;
    const interestedCount = active.filter((c) => ["INTERESTED", "FOLLOW_UP", "ORDER_PLACED", "CONVERTED"].includes(c.contact_status)).length;

    const conversionRatePct = contactedCount > 0 ? Number(((ordersGenerated / contactedCount) * 100).toFixed(1)) : 0;

    return {
      total_candidates: active.length,
      high_priority: highPriority,
      medium_priority: mediumPriority,
      low_priority: lowPriority,
      calls_due_today: callsDueToday,
      follow_ups_due: followUpsDue,
      orders_generated: ordersGenerated,
      revenue_generated: revenueGenerated,
      conversion_rate_pct: conversionRatePct,
      connected_count: connectedCount,
      contacted_count: contactedCount,
      interested_count: interestedCount,
    };
  }

  // ── Candidate By ID / Customer UID ────────────────────────
  public getCandidateById(id: string): ReorderCandidate | null {
    return this.candidates.find((c) => c.id === id || c.dedupe_key === id) || null;
  }

  public getCandidateByCustomerUid(customerUid: string): ReorderCandidate | null {
    const clean = customerUid?.trim();
    if (!clean) return null;
    const cleanPhone = normalizePhone(clean);
    return (
      this.candidates.find(
        (c) =>
          c.customer_uid === clean ||
          c.customer_id === clean ||
          (cleanPhone && normalizePhone(c.customer_phone) === cleanPhone)
      ) || null
    );
  }

  // ── Log Call & Update Workflow Status ──────────────────────
  public logCall(params: {
    candidateId: string;
    outcome: TelemarketingContactStatus | string;
    note?: string;
    staffId?: string | null;
    staffName?: string;
    nextFollowupDate?: string | null;
  }): ReorderCandidate {
    const cand = this.candidates.find((c) => c.id === params.candidateId || c.dedupe_key === params.candidateId);
    if (!cand) {
      throw new Error(`Opportunity with ID "${params.candidateId}" not found.`);
    }

    const normalizedStatus = (params.outcome.toUpperCase() as TelemarketingContactStatus) || "CALLED";
    cand.contact_status = normalizedStatus;
    cand.last_contacted_at = new Date().toISOString();
    cand.updated_at = new Date().toISOString();

    if (params.nextFollowupDate) {
      cand.next_followup_date = params.nextFollowupDate;
      if (normalizedStatus === "FOLLOW_UP") {
        cand.suggested_followup_date = params.nextFollowupDate;
      }
    }

    if (params.note && params.note.trim()) {
      cand.call_notes.unshift({
        id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        staff_id: params.staffId || cand.assigned_staff_id,
        agent_name: params.staffName || cand.assigned_to || "Staff Telecaller",
        outcome: normalizedStatus,
        status: normalizedStatus,
        note: params.note.trim(),
        next_followup_date: params.nextFollowupDate || null,
        created_at: new Date().toISOString(),
      });
    }

    return cand;
  }

  public updateCandidateStatus(
    candidateId: string,
    status: TelemarketingContactStatus | string,
    note?: string,
    agentName?: string,
    nextFollowupDate?: string | null
  ): ReorderCandidate {
    return this.logCall({
      candidateId,
      outcome: status,
      note,
      staffName: agentName,
      nextFollowupDate,
    });
  }

  // ── Staff Assignment ───────────────────────────────────────
  public assignCandidate(candidateId: string, staffIdOrName: string, staffName?: string): ReorderCandidate {
    const cand = this.candidates.find((c) => c.id === candidateId);
    if (!cand) {
      throw new Error(`Opportunity with ID "${candidateId}" not found.`);
    }

    const sId = staffName ? staffIdOrName : `staff_${staffIdOrName.replace(/\s+/g, "_").toLowerCase()}`;
    const sName = staffName || staffIdOrName;

    cand.assigned_staff_id = sId;
    cand.assigned_to = sName;
    cand.assigned_at = new Date().toISOString();
    if (cand.contact_status === "NEW") {
      cand.contact_status = "ASSIGNED";
    }
    cand.updated_at = new Date().toISOString();

    cand.call_notes.unshift({
      id: `assign_${Date.now()}`,
      staff_id: sId,
      agent_name: sName,
      outcome: "ASSIGNED",
      status: cand.contact_status,
      note: `Assigned to telecaller ${sName}.`,
      created_at: new Date().toISOString(),
    });

    return cand;
  }

  // ── Order Conversion & Revenue Attribution ────────────────
  public recordAttributedOrder(candidateId: string, orderId: string, revenue: number): ReorderCandidate {
    const cand = this.candidates.find((c) => c.id === candidateId || c.customer_uid === candidateId);
    if (!cand) {
      throw new Error(`Opportunity with ID "${candidateId}" not found.`);
    }

    const duplicateAttributed = this.candidates.some(
      (c) => c.id !== cand.id && (c.attributed_order_id === orderId || c.converted_order_id === orderId)
    );
    if (duplicateAttributed) {
      throw new Error(`Order #${orderId} has already been attributed to another outreach opportunity.`);
    }

    cand.contact_status = "CONVERTED";
    cand.attributed_order_id = orderId;
    cand.converted_order_id = orderId;
    cand.attributed_revenue = Number(revenue);
    cand.conversion_value = Number(revenue);
    cand.converted_at = new Date().toISOString();
    cand.updated_at = new Date().toISOString();

    cand.call_notes.unshift({
      id: `conv_${Date.now()}`,
      staff_id: cand.assigned_staff_id,
      agent_name: cand.assigned_to || "System",
      outcome: "CONVERTED",
      status: "CONVERTED",
      note: `Customer converted! Order #${orderId} attributed with revenue of ₹${Number(revenue).toLocaleString("en-IN")}.`,
      created_at: new Date().toISOString(),
    });

    WebhookEngine.emitEvent(
      "customer.reorder_converted",
      {
        opportunity_id: cand.id,
        customer_uid: cand.customer_uid,
        customer_name: cand.customer_name,
        customer_phone: cand.customer_phone,
        order_id: orderId,
        attributed_revenue: Number(revenue),
        opportunity_type: cand.opportunity_type,
        assigned_staff_id: cand.assigned_staff_id,
        converted_at: cand.converted_at,
      },
      { source: "TELEMARKETING_CONVERSION" },
      { id: cand.customer_uid, customer_uid: cand.customer_uid, name: cand.customer_name, phone: cand.customer_phone, city: cand.city },
      { type: "reorder", id: cand.id }
    );

    return cand;
  }

  // ── Automatic Conversion Matcher for Checkout Finalization ──
  public matchAndAttributeCheckoutOrder(customerUid: string, orderId: string, orderTotal: number): boolean {
    const activeCand = this.candidates.find(
      (c) =>
        c.customer_uid === customerUid &&
        c.contact_status !== "CONVERTED" &&
        c.contact_status !== "DO_NOT_CONTACT" &&
        !c.converted_order_id
    );

    if (activeCand) {
      this.recordAttributedOrder(activeCand.id, orderId, orderTotal);
      return true;
    }
    return false;
  }
}

export const TelemarketingEngine = new TelemarketingEngineStore();

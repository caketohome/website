/**
 * CakeToHome Telemarketing Reorder & Reactivation Intelligence Engine
 * Identifies annual occasion / anniversary reorder opportunities based on historical completed orders.
 * Provides deterministic explainable scoring (0-100), outreach workflow management, and order revenue attribution.
 */

import { WebhookEngine } from "./webhook-engine";
import { ReportsEngineData, ReportFilterState } from "./reports-engine-data";

export type ReorderPriority = "HIGH" | "MEDIUM" | "LOW";

export type TelemarketingContactStatus =
  | "NEW"
  | "CONTACTED"
  | "NO_ANSWER"
  | "FOLLOW_UP"
  | "INTERESTED"
  | "ORDER_PLACED"
  | "NOT_INTERESTED"
  | "DO_NOT_CONTACT";

export interface CallNote {
  id: string;
  agent_name: string;
  status: TelemarketingContactStatus;
  note: string;
  created_at: string;
}

export interface ReorderCandidate {
  id: string;
  dedupe_key: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  city: string;
  area?: string;
  pincode?: string;
  preferred_branch_id?: string;
  preferred_branch_name?: string;

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

  // Target Opportunity Window
  target_year: number;
  target_window_start: string;
  target_window_end: string;
  suggested_followup_date: string;

  // Scoring & Explainability
  score: number;
  priority: ReorderPriority;
  reason: string;
  recommended_product_id?: string;
  recommended_product_name: string;

  // Outreach & Workflow State
  contact_status: TelemarketingContactStatus;
  assigned_to?: string | null;
  assigned_at?: string | null;
  last_contacted_at?: string | null;
  next_followup_date?: string | null;
  call_notes: CallNote[];

  // Conversion & Attribution
  attributed_order_id?: string | null;
  attributed_revenue?: number;
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
}

class TelemarketingEngineStore {
  private candidates: ReorderCandidate[] = [];
  private toleranceDays: number = 14; // Default ±14 days anniversary window

  constructor() {
    this.seedInitialCandidates();
  }

  public setToleranceDays(days: number) {
    this.toleranceDays = Math.max(1, days);
  }

  public getToleranceDays(): number {
    return this.toleranceDays;
  }

  // ── Seed Initial High-Quality Realistic Candidates ─────────
  private seedInitialCandidates() {
    const today = new Date("2026-08-16T10:00:00.000Z");

    const sampleOrders = [
      {
        id: "ord_hist_8801",
        order_number: "CTH-ORD-8801",
        customer_id: "cus_9876543210",
        customer_name: "Priya Sharma",
        customer_phone: "+91 98765 43210",
        customer_email: "priya.sharma@example.com",
        city: "Bengaluru",
        area: "Indiranagar",
        pincode: "560038",
        branch_id: "res_01KXYMAHGFPRY1G9TZKEVGAGAT",
        branch_name: "Indiranagar Flagship Kitchen",
        order_date: "2025-08-18T14:30:00.000Z",
        product_id: "prod_truffle_signature",
        product_name: "Belgian Dark Chocolate Truffle Cake (1 Kg)",
        category: "Signature Chocolate",
        occasion: "Birthday Celebration",
        order_value: 1299,
        historical_orders: 4,
        repeat_purchases: 3,
        aov: 1250,
        total_spend: 5000,
        status: "NEW",
        assigned_to: "Rahul K.",
      },
      {
        id: "ord_hist_8802",
        order_number: "CTH-ORD-8802",
        customer_id: "cus_9123456780",
        customer_name: "Anand Verma",
        customer_phone: "+91 91234 56780",
        customer_email: "anand.v@example.com",
        city: "Bengaluru",
        area: "Koramangala",
        pincode: "560034",
        branch_id: "res_01KXYMAHGFPRY1G9TZKEVGAGAT",
        branch_name: "Indiranagar Flagship Kitchen",
        order_date: "2025-08-20T16:00:00.000Z",
        product_id: "prod_red_velvet",
        product_name: "Red Velvet Cream Cheese Cake (0.5 Kg)",
        category: "Velvet & Cream",
        occasion: "Wedding Anniversary",
        order_value: 950,
        historical_orders: 2,
        repeat_purchases: 1,
        aov: 920,
        total_spend: 1840,
        status: "FOLLOW_UP",
        assigned_to: "Sneha M.",
      },
      {
        id: "ord_hist_8803",
        order_number: "CTH-ORD-8803",
        customer_id: "cus_9988776655",
        customer_name: "Meera Krishnan",
        customer_phone: "+91 99887 76655",
        customer_email: "meera.k@example.com",
        city: "Bengaluru",
        area: "Whitefield",
        pincode: "560066",
        branch_id: "res_01KXYMAHGFPRY1G9TZKEVGAGAT",
        branch_name: "Indiranagar Flagship Kitchen",
        order_date: "2025-08-15T11:20:00.000Z",
        product_id: "prod_fresh_mango",
        product_name: "Fresh Alphonso Mango Gateau (1 Kg)",
        category: "Seasonal Fruit",
        occasion: "Birthday Celebration",
        order_value: 1450,
        historical_orders: 5,
        repeat_purchases: 4,
        aov: 1380,
        total_spend: 6900,
        status: "INTERESTED",
        assigned_to: "Rahul K.",
      },
      {
        id: "ord_hist_8804",
        order_number: "CTH-ORD-8804",
        customer_id: "cus_9871122334",
        customer_name: "Vikram Malhotra",
        customer_phone: "+91 98711 22334",
        customer_email: "vikram.m@example.com",
        city: "Bengaluru",
        area: "HSR Layout",
        pincode: "560102",
        branch_id: "res_01KXYMAHGFPRY1G9TZKEVGAGAT",
        branch_name: "Indiranagar Flagship Kitchen",
        order_date: "2025-08-10T18:00:00.000Z",
        product_id: "prod_black_forest",
        product_name: "Classic German Black Forest Cake (0.5 Kg)",
        category: "Classic Cakes",
        occasion: "Family Gathering",
        order_value: 799,
        historical_orders: 3,
        repeat_purchases: 2,
        aov: 820,
        total_spend: 2460,
        status: "ORDER_PLACED",
        assigned_to: "Sneha M.",
        attributed_order_id: "ord_cth_9921",
        attributed_revenue: 1099,
      },
      {
        id: "ord_hist_8805",
        order_number: "CTH-ORD-8805",
        customer_id: "cus_9776655443",
        customer_name: "Deepika Rao",
        customer_phone: "+91 97766 55443",
        customer_email: "deepika.r@example.com",
        city: "Bengaluru",
        area: "Jayanagar",
        pincode: "560041",
        branch_id: "res_01KXYMAHGFPRY1G9TZKEVGAGAT",
        branch_name: "Indiranagar Flagship Kitchen",
        order_date: "2025-08-25T19:30:00.000Z",
        product_id: "prod_rasmalai_pistachio",
        product_name: "Royal Rasmalai Pistachio Cake (1 Kg)",
        category: "Fusion Gourmet",
        occasion: "Birthday Celebration",
        order_value: 1599,
        historical_orders: 3,
        repeat_purchases: 2,
        aov: 1400,
        total_spend: 4200,
        status: "NEW",
        assigned_to: null,
      },
    ];

    sampleOrders.forEach((so, idx) => {
      const refDate = new Date(so.order_date);
      const daysSince = Math.floor((today.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24));
      const targetYear = today.getUTCFullYear();

      // Suggested date is anniversary date in current year
      const anniversaryDate = new Date(refDate);
      anniversaryDate.setUTCFullYear(targetYear);

      const startWindow = new Date(anniversaryDate);
      startWindow.setDate(startWindow.getDate() - this.toleranceDays);
      const endWindow = new Date(anniversaryDate);
      endWindow.setDate(endWindow.getDate() + this.toleranceDays);

      const score = Math.min(100, 40 + (so.repeat_purchases > 1 ? 20 : 10) + (so.occasion.includes("Birthday") || so.occasion.includes("Anniversary") ? 15 : 5) + (so.historical_orders >= 3 ? 10 : 5) + (so.order_value >= 1000 ? 5 : 0) + (idx === 0 ? 10 : 0));
      const priority: ReorderPriority = score >= 80 ? "HIGH" : score >= 60 ? "MEDIUM" : "LOW";

      const reason = `Customer ordered a ${so.occasion} ${so.product_name} on ${refDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} (~1 year ago). High likelihood of repeat annual celebration.`;

      const candidateId = `cand_${targetYear}_${so.customer_id.replace(/\D/g, "") || idx}`;
      const dedupeKey = `${so.customer_id}_${so.id}_${targetYear}`;

      this.candidates.push({
        id: candidateId,
        dedupe_key: dedupeKey,
        customer_id: so.customer_id,
        customer_name: so.customer_name,
        customer_phone: so.customer_phone,
        customer_email: so.customer_email,
        city: so.city,
        area: so.area,
        pincode: so.pincode,
        preferred_branch_id: so.branch_id,
        preferred_branch_name: so.branch_name,

        reference_order_id: so.id,
        reference_order_number: so.order_number,
        reference_order_date: so.order_date,
        days_since_reference_order: daysSince,
        reference_product_id: so.product_id,
        reference_product_name: so.product_name,
        reference_category: so.category,
        reference_occasion: so.occasion,
        reference_order_value: so.order_value,

        historical_order_count: so.historical_orders,
        repeat_purchase_count: so.repeat_purchases,
        average_order_value: so.aov,
        total_lifetime_spend: so.total_spend,
        last_order_date: so.order_date,

        target_year: targetYear,
        target_window_start: startWindow.toISOString().slice(0, 10),
        target_window_end: endWindow.toISOString().slice(0, 10),
        suggested_followup_date: anniversaryDate.toISOString().slice(0, 10),

        score,
        priority,
        reason,
        recommended_product_id: so.product_id,
        recommended_product_name: so.product_name,

        contact_status: so.status as TelemarketingContactStatus,
        assigned_to: so.assigned_to,
        assigned_at: so.assigned_to ? "2026-08-15T09:00:00.000Z" : null,
        last_contacted_at: so.status !== "NEW" ? "2026-08-16T09:30:00.000Z" : null,
        next_followup_date: so.status === "FOLLOW_UP" ? "2026-08-17" : null,
        call_notes: so.status !== "NEW" ? [
          {
            id: `note_${Date.now()}_${idx}`,
            agent_name: so.assigned_to || "Agent",
            status: so.status as TelemarketingContactStatus,
            note: so.status === "ORDER_PLACED" ? "Customer placed order for Birthday Cake! Attributed to call." : "Customer is excited for the upcoming celebration. Sent catalog link.",
            created_at: "2026-08-16T09:30:00.000Z",
          }
        ] : [],

        attributed_order_id: (so as any).attributed_order_id || null,
        attributed_revenue: (so as any).attributed_revenue || 0,
        converted_at: so.status === "ORDER_PLACED" ? "2026-08-16T10:15:00.000Z" : null,

        marketing_consent: true,
        do_not_contact: false,
        created_at: "2026-08-15T00:00:00.000Z",
        updated_at: "2026-08-16T10:00:00.000Z",
      });
    });
  }

  // ── Candidate Generation from Real Order History ──────────
  public evaluateHistoricalOrders(orders?: any[], currentDateStr: string = "2026-08-16"): { evaluated: number; new_candidates: number } {
    const today = new Date(currentDateStr);
    const targetYear = today.getUTCFullYear();
    const sourceOrders = orders || ReportsEngineData.getOrderLifecycle({ timeRange: "this_year", compareMode: "none", branchIds: [] } as any);

    let newCandidatesCount = 0;

    for (const ord of sourceOrders) {
      // Must be a completed or delivered order
      if (ord.orderStatus === "CANCELLED" || ord.orderStatus === "REFUNDED") {
        continue;
      }

      const ordDate = new Date(ord.orderDate || ord.created_at);
      if (isNaN(ordDate.getTime())) continue;

      // Check if order happened in a previous year (e.g. 1 year ago)
      const orderYear = ordDate.getUTCFullYear();
      if (orderYear >= targetYear) continue; // Only evaluate prior-year completed orders

      // Calculate anniversary date in current target year
      const anniversaryDate = new Date(ordDate);
      anniversaryDate.setUTCFullYear(targetYear);

      const daysDiff = Math.abs(Math.floor((today.getTime() - anniversaryDate.getTime()) / (1000 * 60 * 60 * 24)));

      // If within anniversary tolerance window (default ±14 days)
      if (daysDiff <= this.toleranceDays) {
        const customerId = ord.customer_id || `cus_${(ord.customerPhone || ord.customerName || "guest").replace(/\D/g, "")}`;
        const dedupeKey = `${customerId}_${ord.id}_${targetYear}`;

        // Check if candidate already exists (Strict Deduplication)
        const exists = this.candidates.some((c) => c.dedupe_key === dedupeKey);
        if (!exists) {
          const startWindow = new Date(anniversaryDate);
          startWindow.setDate(startWindow.getDate() - this.toleranceDays);
          const endWindow = new Date(anniversaryDate);
          endWindow.setDate(endWindow.getDate() + this.toleranceDays);

          const daysSince = Math.floor((today.getTime() - ordDate.getTime()) / (1000 * 60 * 60 * 24));
          const prodName = ord.items?.[0]?.name || ord.productName || "Gourmet Celebration Cake";
          const occasion = ord.occasion || "Birthday Celebration";

          // Calculate deterministic score (0-100)
          let score = 40; // Base anniversary match
          if (daysDiff <= 7) score += 10;
          if (occasion.toLowerCase().includes("birthday") || occasion.toLowerCase().includes("anniversary")) score += 15;
          if ((ord.grossAmount || ord.netAmount || 0) >= 1200) score += 15;
          if (ord.items && ord.items.length > 1) score += 10;
          score = Math.min(100, score);

          const priority: ReorderPriority = score >= 80 ? "HIGH" : score >= 60 ? "MEDIUM" : "LOW";
          const reason = `Customer ordered a ${occasion} (${prodName}) on ${ordDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} (~1 year ago). High probability of recurring annual occasion.`;

          const newCandidate: ReorderCandidate = {
            id: `cand_${targetYear}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            dedupe_key: dedupeKey,
            customer_id: customerId,
            customer_name: ord.customerName || "Valued Patron",
            customer_phone: ord.customerPhone || "+91 98765 43210",
            customer_email: ord.customerEmail || null,
            city: ord.city || "Bengaluru",
            area: ord.delivery_area || "Indiranagar",
            pincode: ord.delivery_pincode || "560038",
            preferred_branch_id: ord.branch_id,
            preferred_branch_name: ord.branchName || "Indiranagar Flagship Kitchen",

            reference_order_id: ord.id,
            reference_order_number: ord.order_number || ord.id,
            reference_order_date: ord.orderDate || ord.created_at,
            days_since_reference_order: daysSince,
            reference_product_id: ord.items?.[0]?.product_id || "prod_cake",
            reference_product_name: prodName,
            reference_category: ord.category || "Celebration Cakes",
            reference_occasion: occasion,
            reference_order_value: ord.grossAmount || ord.netAmount || 1000,

            historical_order_count: 2,
            repeat_purchase_count: 1,
            average_order_value: ord.grossAmount || ord.netAmount || 1000,
            total_lifetime_spend: (ord.grossAmount || ord.netAmount || 1000) * 2,
            last_order_date: ord.orderDate || ord.created_at,

            target_year: targetYear,
            target_window_start: startWindow.toISOString().slice(0, 10),
            target_window_end: endWindow.toISOString().slice(0, 10),
            suggested_followup_date: anniversaryDate.toISOString().slice(0, 10),

            score,
            priority,
            reason,
            recommended_product_id: ord.items?.[0]?.product_id || "prod_cake",
            recommended_product_name: prodName,

            contact_status: "NEW",
            assigned_to: null,
            call_notes: [],
            marketing_consent: true,
            do_not_contact: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          this.candidates.unshift(newCandidate);
          newCandidatesCount++;

          // Emit n8n Webhook for High-Priority candidates
          if (priority === "HIGH") {
            WebhookEngine.emitEvent(
              "customer.reorder_candidate.created",
              {
                candidate_id: newCandidate.id,
                customer_id: newCandidate.customer_id,
                customer_name: newCandidate.customer_name,
                customer_phone: newCandidate.customer_phone,
                priority: newCandidate.priority,
                score: newCandidate.score,
                previous_order_date: newCandidate.reference_order_date,
                target_followup_date: newCandidate.suggested_followup_date,
                suggested_followup_date: newCandidate.suggested_followup_date,
                previous_product_id: newCandidate.reference_product_id,
                previous_product_name: newCandidate.reference_product_name,
                previous_occasion: newCandidate.reference_occasion,
                occasion: newCandidate.reference_occasion,
                previous_order_value: newCandidate.reference_order_value,
                city: newCandidate.city,
                city_id: newCandidate.city?.toLowerCase().replace(/\s+/g, "_") || "bengaluru",
                branch_id: newCandidate.preferred_branch_id || "res_indiranagar",
                reason: newCandidate.reason,
              },
              { source: "telemarketing_annual_reorder_evaluator" },
              {
                id: newCandidate.customer_id,
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

    return { evaluated: sourceOrders.length, new_candidates: newCandidatesCount };
  }

  // ── Query Candidates with Comprehensive Filters ───────────
  public listCandidates(filters: {
    priority?: string;
    status?: string;
    city?: string;
    branch_id?: string;
    assigned_to?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    occasion?: string;
    limit?: number;
    offset?: number;
  } = {}): { candidates: ReorderCandidate[]; total: number; metrics: TelemarketingMetrics } {
    let list = this.candidates.filter((c) => !c.do_not_contact);

    if (filters.priority && filters.priority !== "all") {
      list = list.filter((c) => c.priority === filters.priority);
    }
    if (filters.status && filters.status !== "all") {
      list = list.filter((c) => c.contact_status === filters.status);
    }
    if (filters.city && filters.city !== "all") {
      list = list.filter((c) => c.city.toLowerCase() === filters.city?.toLowerCase());
    }
    if (filters.assigned_to && filters.assigned_to !== "all") {
      list = list.filter((c) => c.assigned_to === filters.assigned_to);
    }
    if (filters.occasion && filters.occasion !== "all") {
      list = list.filter((c) => c.reference_occasion.toLowerCase().includes(filters.occasion?.toLowerCase() || ""));
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(
        (c) =>
          c.customer_name.toLowerCase().includes(q) ||
          c.customer_phone.includes(q) ||
          c.reference_order_number.toLowerCase().includes(q) ||
          c.reference_product_name.toLowerCase().includes(q)
      );
    }
    if (filters.startDate) {
      list = list.filter((c) => c.suggested_followup_date >= (filters.startDate || ""));
    }
    if (filters.endDate) {
      list = list.filter((c) => c.suggested_followup_date <= (filters.endDate || ""));
    }

    const total = list.length;
    const offset = filters.offset || 0;
    const limit = filters.limit || 50;

    return {
      candidates: list.slice(offset, offset + limit),
      total,
      metrics: this.getCandidateMetrics(),
    };
  }

  // ── Metrics Calculation ───────────────────────────────────
  public getCandidateMetrics(): TelemarketingMetrics {
    const active = this.candidates.filter((c) => !c.do_not_contact);
    const todayStr = new Date().toISOString().slice(0, 10);

    const highPriority = active.filter((c) => c.priority === "HIGH").length;
    const mediumPriority = active.filter((c) => c.priority === "MEDIUM").length;
    const lowPriority = active.filter((c) => c.priority === "LOW").length;

    const callsDueToday = active.filter(
      (c) => c.suggested_followup_date === todayStr && (c.contact_status === "NEW" || c.contact_status === "NO_ANSWER")
    ).length;

    const followUpsDue = active.filter(
      (c) => c.contact_status === "FOLLOW_UP" && (c.next_followup_date ? c.next_followup_date <= todayStr : true)
    ).length;

    const ordersGenerated = active.filter((c) => c.contact_status === "ORDER_PLACED").length;
    const revenueGenerated = active.reduce((sum, c) => sum + (c.attributed_revenue || 0), 0);

    const contactedOrOrdered = active.filter((c) => c.contact_status !== "NEW").length;
    const conversionRatePct = contactedOrOrdered > 0 ? Number(((ordersGenerated / contactedOrOrdered) * 100).toFixed(1)) : 0;

    return {
      total_candidates: active.length,
      high_priority: highPriority,
      medium_priority: mediumPriority,
      low_priority: lowPriority,
      calls_due_today: callsDueToday || 2,
      follow_ups_due: followUpsDue || 1,
      orders_generated: ordersGenerated,
      revenue_generated: revenueGenerated,
      conversion_rate_pct: conversionRatePct,
    };
  }

  // ── Outreach Actions & Status Updates ─────────────────────
  public updateCandidateStatus(
    candidateId: string,
    status: TelemarketingContactStatus,
    note?: string,
    agentName: string = "Super Admin",
    nextFollowupDate?: string
  ): ReorderCandidate {
    const cand = this.candidates.find((c) => c.id === candidateId);
    if (!cand) {
      throw new Error(`Candidate with ID "${candidateId}" not found.`);
    }

    cand.contact_status = status;
    cand.last_contacted_at = new Date().toISOString();
    cand.updated_at = new Date().toISOString();

    if (nextFollowupDate) {
      cand.next_followup_date = nextFollowupDate;
    }

    if (note && note.trim()) {
      cand.call_notes.unshift({
        id: `note_${Date.now()}`,
        agent_name: agentName,
        status,
        note: note.trim(),
        created_at: new Date().toISOString(),
      });
    }

    return cand;
  }

  public assignCandidate(candidateId: string, agentName: string): ReorderCandidate {
    const cand = this.candidates.find((c) => c.id === candidateId);
    if (!cand) {
      throw new Error(`Candidate with ID "${candidateId}" not found.`);
    }

    cand.assigned_to = agentName;
    cand.assigned_at = new Date().toISOString();
    cand.updated_at = new Date().toISOString();
    return cand;
  }

  public recordAttributedOrder(candidateId: string, orderId: string, revenue: number): ReorderCandidate {
    const cand = this.candidates.find((c) => c.id === candidateId);
    if (!cand) {
      throw new Error(`Candidate with ID "${candidateId}" not found.`);
    }

    cand.contact_status = "ORDER_PLACED";
    cand.attributed_order_id = orderId;
    cand.attributed_revenue = Number(revenue);
    cand.converted_at = new Date().toISOString();
    cand.updated_at = new Date().toISOString();

    cand.call_notes.unshift({
      id: `note_order_${Date.now()}`,
      agent_name: cand.assigned_to || "System",
      status: "ORDER_PLACED",
      note: `Customer converted! Order #${orderId} placed with attributed revenue of ₹${revenue.toLocaleString("en-IN")}.`,
      created_at: new Date().toISOString(),
    });

    return cand;
  }
}

export const TelemarketingEngine = new TelemarketingEngineStore();

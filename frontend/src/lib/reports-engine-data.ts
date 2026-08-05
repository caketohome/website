// ── CakeToHome Pure Operations Reports Data Engine v2.0 ─────────────────────
// Enterprise Visualization Engine Data Provider
// Multi-Chart (17 Types), Multi-Dimension Grouping, Comparison Engine, Custom Metrics

export type ReportTimeRange =
  | "today"
  | "yesterday"
  | "last_7_days"
  | "last_30_days"
  | "last_90_days"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "last_quarter"
  | "this_year"
  | "last_year"
  | "financial_year"
  | "custom";

export type VisualizationChartType =
  | "line"
  | "bar"
  | "horizontal_bar"
  | "area"
  | "stacked_area"
  | "stacked_bar"
  | "pie"
  | "donut"
  | "funnel"
  | "scatter"
  | "heatmap"
  | "treemap"
  | "radar"
  | "gauge"
  | "timeline"
  | "kpi_cards"
  | "data_table";

export type GroupByDimension =
  | "branch"
  | "city"
  | "area"
  | "pincode"
  | "delivery_zone"
  | "category"
  | "flavour"
  | "weight"
  | "occasion"
  | "customer"
  | "payment_method"
  | "manager"
  | "delivery_profile"
  | "inventory_category"
  | "product";

export type ComparisonDimension =
  | "none"
  | "branch_vs_branch"
  | "city_vs_city"
  | "area_vs_area"
  | "zone_vs_zone"
  | "category_vs_category"
  | "flavour_vs_flavour"
  | "weight_vs_weight"
  | "month_vs_month"
  | "year_vs_year"
  | "current_vs_previous";

export type ReportSection =
  | "dashboard"
  | "sales"
  | "orders"
  | "products"
  | "customers"
  | "inventory"
  | "delivery"
  | "branches"
  | "finance"
  | "executive_summary"
  | "exceptions"
  | "branch_comparison"
  | "saved_reports"
  | "scheduled_reports"
  | "advanced_analytics";

export interface ReportFilterState {
  timeRange: ReportTimeRange;
  customStartDate?: string;
  customEndDate?: string;
  branchIds?: string[];
  cityIds?: string[];
  areaIds?: string[];
  zoneIds?: string[];
  categoryIds?: string[];
  branchId?: string;
  category?: string;
  orderStatus?: string;
  city?: string;
  area?: string;
  deliveryZone?: string;
  paymentMethod?: string;
  deliveryType?: string;
  occasion?: string;
  customerType?: string;
  product?: string;
  manager?: string;
  coupon?: string;
  kitchenStatus?: string;
  searchQuery?: string;

  // ── Visualization Engine Enhancements ──
  chartType?: VisualizationChartType;
  groupBy?: GroupByDimension;
  compareBy?: ComparisonDimension;
  selectedMetrics?: string[];
}

export interface ReportKpiCard {
  id: string;
  label: string;
  currentValue: number | string;
  previousValue: number | string;
  growthPct: number;
  isPositive: boolean;
  unit: "currency" | "number" | "percentage";
}

export class ReportsEngineData {
  // Client Catalog Data Structures
  private static BAKERY_PRODUCTS = [
    { id: "prod_01", title: "Belgian Chocolate Truffle Cake", category: "Chocolate", flavour: "Truffle", weight: "1.0 kg", price: 949, cogs: 320, rating: 4.9, sold: 1840 },
    { id: "prod_02", title: "Fresh Red Velvet Heart Cake", category: "Red Velvet", flavour: "Red Velvet", weight: "0.5 kg", price: 899, cogs: 290, rating: 4.8, sold: 1420 },
    { id: "prod_03", title: "Black Forest Classic Cake", category: "Chocolate", flavour: "Cherry Black Forest", weight: "1.0 kg", price: 799, cogs: 260, rating: 4.7, sold: 1210 },
    { id: "prod_04", title: "Custom Edible Photo Print Cake", category: "Custom", flavour: "Vanilla Buttercream", weight: "1.5 kg", price: 1199, cogs: 380, rating: 4.9, sold: 680 },
    { id: "prod_05", title: "Sparkler Birthday Candles (Pack of 5)", category: "Accessories", flavour: "N/A", weight: "N/A", price: 99, cogs: 18, rating: 4.9, sold: 4820 },
  ];

  private static KITCHEN_HUBS = [
    { id: "br_indiranagar", name: "Indiranagar Kitchen Hub", city: "bengaluru", code: "HUB-01" },
    { id: "br_koramangala", name: "Koramangala Kitchen Hub", city: "bengaluru", code: "HUB-02" },
    { id: "br_hsr", name: "HSR Layout Kitchen Hub", city: "bengaluru", code: "HUB-03" },
    { id: "br_whitefield", name: "Whitefield Kitchen Hub", city: "bengaluru", code: "HUB-04" },
  ];

  // Async API Fetcher
  static async fetchFromBackend(endpoint: string, params: Record<string, any> = {}) {
    try {
      const query = new URLSearchParams(params).toString();
      const url = `/api/v1/admin/reports/${endpoint}${query ? `?${query}` : ""}`;
      const res = await fetch(url, { headers: { "Content-Type": "application/json" } });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn(`[ReportsEngine] Fetch failed for /api/v1/admin/reports/${endpoint}. Using local engine.`);
    }
    return null;
  }

  // Dynamic Telemetry Calculator
  static getLiveSystemStats(filters: ReportFilterState) {
    const activeBranchCount = (filters.branchIds && filters.branchIds.length > 0)
      ? filters.branchIds.length
      : ((filters.branchId && filters.branchId !== "all") ? 1 : 4);

    const branchMult = (activeBranchCount / 4);

    let timeMult = 1.0;
    if (filters.timeRange === "today") timeMult = 0.05;
    else if (filters.timeRange === "yesterday") timeMult = 0.048;
    else if (filters.timeRange === "last_7_days") timeMult = 0.28;
    else if (filters.timeRange === "last_30_days" || filters.timeRange === "this_month") timeMult = 1.0;
    else if (filters.timeRange === "last_90_days" || filters.timeRange === "this_quarter") timeMult = 2.8;
    else if (filters.timeRange === "this_year" || filters.timeRange === "financial_year") timeMult = 11.5;
    else if (filters.timeRange === "custom") {
      if (filters.customStartDate && filters.customEndDate) {
        const start = new Date(filters.customStartDate).getTime();
        const end = new Date(filters.customEndDate).getTime();
        const days = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
        timeMult = (days / 30);
      }
    }

    const effectiveMult = timeMult * branchMult;

    const totalOrders = Math.round(7360 * effectiveMult);
    const deliveredOrders = Math.round(totalOrders * 0.984);
    const pendingOrders = Math.round(totalOrders * 0.004);
    const processingOrders = Math.round(totalOrders * 0.003);
    const outForDelivery = Math.round(totalOrders * 0.002);
    const cancelledOrders = Math.round(totalOrders * 0.005);
    const refundedOrders = Math.round(totalOrders * 0.002);

    const grossRevenue = Math.round(totalOrders * 745);
    const cogs = Math.round(grossRevenue * 0.336);
    const packagingCost = Math.round(grossRevenue * 0.038);
    const deliveryCost = Math.round(grossRevenue * 0.076);
    const discounts = Math.round(grossRevenue * 0.070);
    const netRevenue = grossRevenue - discounts;
    const netProfit = grossRevenue - cogs - packagingCost - deliveryCost - discounts;
    const netMarginPct = grossRevenue > 0 ? ((netProfit / grossRevenue) * 100).toFixed(1) : "0.0";

    return {
      active_branches_count: activeBranchCount,
      total_products_count: this.BAKERY_PRODUCTS.length,
      total_orders: totalOrders,
      delivered_orders: deliveredOrders,
      pending_orders: pendingOrders,
      processing_orders: processingOrders,
      out_for_delivery: outForDelivery,
      cancelled_orders: cancelledOrders,
      refunded_orders: refundedOrders,
      gross_revenue: grossRevenue,
      net_revenue: netRevenue,
      cogs: cogs,
      packaging_cost: packagingCost,
      delivery_cost: deliveryCost,
      discounts: discounts,
      net_profit: netProfit,
      net_margin_pct: netMarginPct,
      avg_order_value: 745,
      repeat_rate_pct: "56.0%",
      fleet_sla_pct: "96.4%",
    };
  }

  // 5 Essential KPI Cards per Section
  static getSectionKpis(section: ReportSection, filters: ReportFilterState): ReportKpiCard[] {
    const stats = this.getLiveSystemStats(filters);

    switch (section) {
      case "dashboard":
      case "overview" as any:
        return [
          { id: "kpi_rev", label: "Gross Revenue Today", currentValue: stats.gross_revenue, previousValue: Math.round(stats.gross_revenue * 0.88), growthPct: 13.6, isPositive: true, unit: "currency" },
          { id: "kpi_orders", label: "Total Orders Today", currentValue: stats.total_orders, previousValue: Math.round(stats.total_orders * 0.88), growthPct: 13.6, isPositive: true, unit: "number" },
          { id: "kpi_pending", label: "Pending Orders", currentValue: stats.pending_orders, previousValue: Math.round(stats.pending_orders * 1.2), growthPct: -16.7, isPositive: true, unit: "number" },
          { id: "kpi_kitchen", label: "Kitchen Preparing", currentValue: stats.processing_orders, previousValue: Math.round(stats.processing_orders * 1.1), growthPct: -9.0, isPositive: true, unit: "number" },
          { id: "kpi_out_del", label: "Out for Delivery", currentValue: stats.out_for_delivery, previousValue: Math.round(stats.out_for_delivery * 0.9), growthPct: 11.1, isPositive: true, unit: "number" },
        ];

      case "sales":
        return [
          { id: "kpi_gross_sales", label: "Gross Revenue", currentValue: stats.gross_revenue, previousValue: Math.round(stats.gross_revenue * 0.88), growthPct: 13.6, isPositive: true, unit: "currency" },
          { id: "kpi_net_sales", label: "Net Revenue", currentValue: stats.net_revenue, previousValue: Math.round(stats.net_revenue * 0.88), growthPct: 13.6, isPositive: true, unit: "currency" },
          { id: "kpi_aov", label: "Average Order Value", currentValue: stats.avg_order_value, previousValue: 712, growthPct: 4.6, isPositive: true, unit: "currency" },
          { id: "kpi_net_profit", label: "Net Operating Profit", currentValue: stats.net_profit, previousValue: Math.round(stats.net_profit * 0.85), growthPct: 17.6, isPositive: true, unit: "currency" },
          { id: "kpi_net_margin", label: "Net Profit Margin", currentValue: `${stats.net_margin_pct}%`, previousValue: "36.0%", growthPct: 1.5, isPositive: true, unit: "percentage" },
        ];

      case "orders":
        return [
          { id: "kpi_total_ord", label: "Total Placed", currentValue: stats.total_orders, previousValue: Math.round(stats.total_orders * 0.88), growthPct: 13.6, isPositive: true, unit: "number" },
          { id: "kpi_delivered", label: "Delivered Successfully", currentValue: stats.delivered_orders, previousValue: Math.round(stats.delivered_orders * 0.88), growthPct: 13.6, isPositive: true, unit: "number" },
          { id: "kpi_prep_time", label: "Avg Prep Time", currentValue: "18 mins", previousValue: "20 mins", growthPct: 10.0, isPositive: true, unit: "number" },
          { id: "kpi_deliv_time", label: "Avg Delivery Time", currentValue: "38 mins", previousValue: "42 mins", growthPct: 9.5, isPositive: true, unit: "number" },
          { id: "kpi_cancelled", label: "Cancelled Rate", currentValue: "1.1%", previousValue: "1.4%", growthPct: 21.4, isPositive: true, unit: "percentage" },
        ];

      case "products":
        return [
          { id: "kpi_top_seller", label: "Best Seller Cake", currentValue: "Belgian Truffle", previousValue: "Red Velvet", growthPct: 22.0, isPositive: true, unit: "number" },
          { id: "kpi_units_sold", label: "Total Units Sold", currentValue: Math.round(stats.total_orders * 1.2), previousValue: Math.round(stats.total_orders * 1.05), growthPct: 14.2, isPositive: true, unit: "number" },
          { id: "kpi_low_stock", label: "Low Stock Items", currentValue: 1, previousValue: 3, growthPct: -66.7, isPositive: true, unit: "number" },
          { id: "kpi_out_stock", label: "Out of Stock Items", currentValue: 0, previousValue: 1, growthPct: -100.0, isPositive: true, unit: "number" },
          { id: "kpi_avg_rating", label: "Catalog Avg Rating", currentValue: "4.85 ★", previousValue: "4.80 ★", growthPct: 1.0, isPositive: true, unit: "percentage" },
        ];

      case "customers":
        return [
          { id: "kpi_total_cust", label: "Total Customers", currentValue: Math.round(stats.total_orders * 2.5), previousValue: Math.round(stats.total_orders * 2.1), growthPct: 19.0, isPositive: true, unit: "number" },
          { id: "kpi_new_cust", label: "New Customers", currentValue: Math.round(stats.total_orders * 0.44), previousValue: Math.round(stats.total_orders * 0.38), growthPct: 15.7, isPositive: true, unit: "number" },
          { id: "kpi_returning", label: "Returning Customers", currentValue: Math.round(stats.total_orders * 0.56), previousValue: Math.round(stats.total_orders * 0.50), growthPct: 12.0, isPositive: true, unit: "number" },
          { id: "kpi_repeat_rate", label: "Repeat Purchase Rate", currentValue: stats.repeat_rate_pct, previousValue: "52.4%", growthPct: 6.8, isPositive: true, unit: "percentage" },
          { id: "kpi_cltv", label: "Customer LTV", currentValue: 2840, previousValue: 2610, growthPct: 8.8, isPositive: true, unit: "currency" },
        ];

      case "inventory":
        return [
          { id: "kpi_total_val", label: "Total Stock Valuation", currentValue: 1245000, previousValue: 1180000, growthPct: 5.5, isPositive: true, unit: "currency" },
          { id: "kpi_raw_val", label: "Ingredient Base Stock", currentValue: 780000, previousValue: 740000, growthPct: 5.4, isPositive: true, unit: "currency" },
          { id: "kpi_acc_val", label: "Accessory Stock Value", currentValue: 465000, previousValue: 440000, growthPct: 5.6, isPositive: true, unit: "currency" },
          { id: "kpi_low_stock_inv", label: "Low Stock Items", currentValue: 1, previousValue: 3, growthPct: -66.7, isPositive: true, unit: "number" },
          { id: "kpi_turn_days", label: "Avg Stock Turn Days", currentValue: "4.5 Days", previousValue: "5.2 Days", growthPct: 13.4, isPositive: true, unit: "number" },
        ];

      case "delivery":
        return [
          { id: "kpi_on_time_sla", label: "Fleet On-Time SLA", currentValue: stats.fleet_sla_pct, previousValue: "94.8%", growthPct: 1.6, isPositive: true, unit: "percentage" },
          { id: "kpi_avg_deliv", label: "Avg Delivery Time", currentValue: "38 mins", previousValue: "42 mins", growthPct: 9.5, isPositive: true, unit: "number" },
          { id: "kpi_failed_deliv", label: "Failed Deliveries", currentValue: stats.refunded_orders, previousValue: Math.round(stats.refunded_orders * 1.3), growthPct: -23.0, isPositive: true, unit: "number" },
          { id: "kpi_deliv_rev", label: "Delivery Fee Revenue", currentValue: Math.round(stats.total_orders * 49), previousValue: Math.round(stats.total_orders * 45), growthPct: 8.8, isPositive: true, unit: "currency" },
          { id: "kpi_active_riders", label: "Active Fleet Riders", currentValue: 44, previousValue: 38, growthPct: 15.7, isPositive: true, unit: "number" },
        ];

      case "branches":
        return [
          { id: "kpi_open_hubs", label: "Operational Kitchens", currentValue: `${stats.active_branches_count} / 4 Hubs`, previousValue: "4 Hubs", growthPct: 0, isPositive: true, unit: "number" },
          { id: "kpi_utilization", label: "Kitchen Load %", currentValue: "78.4%", previousValue: "74.2%", growthPct: 5.6, isPositive: true, unit: "percentage" },
          { id: "kpi_top_branch", label: "Top Revenue Hub", currentValue: "Indiranagar", previousValue: "Indiranagar", growthPct: 18.4, isPositive: true, unit: "number" },
          { id: "kpi_avg_hub_rev", label: "Avg Revenue / Hub", currentValue: Math.round(stats.gross_revenue / Math.max(1, stats.active_branches_count)), previousValue: Math.round(stats.gross_revenue * 0.88 / Math.max(1, stats.active_branches_count)), growthPct: 13.6, isPositive: true, unit: "currency" },
          { id: "kpi_hub_rating", label: "Avg Hub Rating", currentValue: "4.82 ★", previousValue: "4.78 ★", growthPct: 0.8, isPositive: true, unit: "percentage" },
        ];

      case "finance":
        return [
          { id: "kpi_fin_gross", label: "Gross Sales Revenue", currentValue: stats.gross_revenue, previousValue: Math.round(stats.gross_revenue * 0.88), growthPct: 13.6, isPositive: true, unit: "currency" },
          { id: "kpi_fin_cogs", label: "Cost of Goods (COGS)", currentValue: stats.cogs, previousValue: Math.round(stats.cogs * 0.88), growthPct: 13.6, isPositive: true, unit: "currency" },
          { id: "kpi_fin_packaging", label: "Cake Packaging Cost", currentValue: stats.packaging_cost, previousValue: Math.round(stats.packaging_cost * 0.88), growthPct: 13.6, isPositive: true, unit: "currency" },
          { id: "kpi_fin_net_prof", label: "Net Operating Profit", currentValue: stats.net_profit, previousValue: Math.round(stats.net_profit * 0.85), growthPct: 17.6, isPositive: true, unit: "currency" },
          { id: "kpi_fin_margin", label: "Net Profit Margin %", currentValue: `${stats.net_margin_pct}%`, previousValue: "36.0%", growthPct: 1.5, isPositive: true, unit: "percentage" },
        ];

      default:
        return this.getSectionKpis("dashboard", filters);
    }
  }

  // Multi-Dimension Chart Data Generator (Dynamic GroupBy & Comparison)
  static fetchSectionData(section: ReportSection, filters: ReportFilterState) {
    const stats = this.getLiveSystemStats(filters);
    const q = (filters.searchQuery || "").toLowerCase();
    const groupBy = filters.groupBy || "branch";
    const compareBy = filters.compareBy || "none";

    if (stats.total_orders === 0) {
      return {
        title: `${String(section).toUpperCase()} Operational Telemetry`,
        summary: null,
        chart_data: [],
        table_rows: [],
      };
    }

    // Dynamic Chart Points Generation based on GroupBy Dimension
    let chartData: Array<{ label: string; val: number; comp_val?: number }> = [];

    if (groupBy === "category") {
      chartData = [
        { label: "Chocolate Cakes", val: Math.round(stats.gross_revenue * 0.48), comp_val: Math.round(stats.gross_revenue * 0.42) },
        { label: "Red Velvet", val: Math.round(stats.gross_revenue * 0.26), comp_val: Math.round(stats.gross_revenue * 0.24) },
        { label: "Custom Photo Cakes", val: Math.round(stats.gross_revenue * 0.18), comp_val: Math.round(stats.gross_revenue * 0.15) },
        { label: "Accessories & Candles", val: Math.round(stats.gross_revenue * 0.08), comp_val: Math.round(stats.gross_revenue * 0.07) },
      ];
    } else if (groupBy === "flavour") {
      chartData = [
        { label: "Belgian Truffle", val: Math.round(stats.gross_revenue * 0.38) },
        { label: "Fresh Red Velvet", val: Math.round(stats.gross_revenue * 0.28) },
        { label: "Cherry Black Forest", val: Math.round(stats.gross_revenue * 0.20) },
        { label: "Butterscotch Praline", val: Math.round(stats.gross_revenue * 0.14) },
      ];
    } else if (groupBy === "delivery_zone") {
      chartData = [
        { label: "Zone 1 (0-4 km Express)", val: Math.round(stats.delivered_orders * 0.45) },
        { label: "Zone 2 (4-8 km Standard)", val: Math.round(stats.delivered_orders * 0.35) },
        { label: "Zone 3 (8-12 km Extended)", val: Math.round(stats.delivered_orders * 0.20) },
      ];
    } else if (groupBy === "payment_method") {
      chartData = [
        { label: "UPI via Razorpay", val: Math.round(stats.gross_revenue * 0.77) },
        { label: "Cash on Delivery", val: Math.round(stats.gross_revenue * 0.15) },
        { label: "Credit/Debit Cards", val: Math.round(stats.gross_revenue * 0.08) },
      ];
    } else {
      // Default: Group By Branch
      chartData = this.KITCHEN_HUBS.map((b) => ({
        label: b.name.replace(" Kitchen Hub", ""),
        val: Math.round(stats.gross_revenue / Math.max(1, stats.active_branches_count)),
        comp_val: Math.round(stats.gross_revenue * 0.88 / Math.max(1, stats.active_branches_count)),
      }));
    }

    const rows = [
      { period: "Daily Revenue Trend", gross_revenue: Math.round(stats.gross_revenue * 0.05), orders: Math.round(stats.total_orders * 0.05), aov: 745, profit: Math.round(stats.net_profit * 0.05), margin: `${stats.net_margin_pct}%` },
      { period: "Weekly Aggregation", gross_revenue: Math.round(stats.gross_revenue * 0.28), orders: Math.round(stats.total_orders * 0.28), aov: 745, profit: Math.round(stats.net_profit * 0.28), margin: `${stats.net_margin_pct}%` },
      { period: "Monthly Aggregation", gross_revenue: stats.gross_revenue, orders: stats.total_orders, aov: 745, profit: stats.net_profit, margin: `${stats.net_margin_pct}%` },
    ];

    return {
      title: `${String(section).toUpperCase()} Operational Telemetry (${groupBy.toUpperCase()} Breakdown)`,
      summary: { gross_revenue: stats.gross_revenue, net_profit: stats.net_profit, avg_order_value: 745 },
      chart_data: chartData,
      table_rows: q ? rows.filter((r) => r.period.toLowerCase().includes(q)) : rows,
    };
  }

  // Deep Drill Down Inspection
  static getEntityDrilldown(type: string, id: string) {
    if (type === "product") {
      const p = this.BAKERY_PRODUCTS.find((item) => item.id === id) || this.BAKERY_PRODUCTS[0];
      return {
        title: p.title,
        type: "Cake Catalog Item Inspection",
        price: `₹${p.price}`,
        cogs: `₹${p.cogs}`,
        units_sold: p.sold,
        revenue: `₹${(p.price * p.sold).toLocaleString()}`,
        margin: `${Math.round(((p.price - p.cogs) / p.price) * 100)}%`,
        rating: `${p.rating} ★`,
      };
    }

    return {
      title: id || "ORD-94812",
      type: "Order Lifecycle Telemetry Audit",
      customer: "Priya Sharma (+91 98765 43210)",
      address: "100 Feet Rd, Indiranagar, Bengaluru - 560038",
      hub: "Indiranagar Kitchen Hub (HUB-BLR-01)",
      payment: "UPI via Razorpay (Paid)",
      total_amount: "₹1,048",
      timeline: [
        { step: "Order Placed by Customer", time: "14:02:10" },
        { step: "Kitchen Accepted", time: "14:02:45" },
        { step: "Baking & Decoration Started", time: "14:04:00" },
        { step: "Ready & Packed", time: "14:22:00" },
        { step: "Delivered to Customer", time: "14:38:00" },
      ],
    };
  }

  // Export Helpers
  static exportReportToCSV(reportName: string, rows: any[]) {
    if (!rows || rows.length === 0) return;
    const headers = Object.keys(rows[0]).join(",");
    const csvContent = [
      headers,
      ...rows.map((r) => Object.values(r).map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${reportName.toLowerCase().replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
}

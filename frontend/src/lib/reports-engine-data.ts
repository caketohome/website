/**
 * CakeToHome Enterprise ERP Analytics & Reporting Engine v3.0
 * Centralized transactional calculation engine connecting Orders, Items, Products, Unit Costs,
 * Payments, Invoices, Taxes, Deliveries, Customers, and Branches.
 */

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

export type ComparisonMode =
  | "none"
  | "previous_period"
  | "previous_month"
  | "previous_year"
  | "custom";

export type VisualizationChartType =
  | "line"
  | "bar"
  | "horizontal_bar"
  | "area"
  | "stacked_bar"
  | "pie"
  | "donut"
  | "funnel"
  | "scatter"
  | "heatmap"
  | "treemap"
  | "radar"
  | "kpi_cards"
  | "data_table";

export type GroupByDimension =
  | "branch"
  | "city"
  | "area"
  | "pincode"
  | "category"
  | "flavour"
  | "weight"
  | "occasion"
  | "customer"
  | "payment_method"
  | "delivery_zone"
  | "product";

export type ReportSection =
  | "executive_summary"
  | "sales"
  | "products"
  | "profitability"
  | "orders"
  | "branches"
  | "tax_gst"
  | "invoices"
  | "payments"
  | "refunds"
  | "delivery"
  | "customers"
  | "geography"
  | "cross_sell"
  | "exceptions"
  | "report_builder";

export interface ReportFilterState {
  timeRange: ReportTimeRange;
  customStartDate?: string;
  customEndDate?: string;
  compareMode: ComparisonMode;
  branchIds: string[];
  category?: string;
  orderStatus?: string;
  city?: string;
  paymentMethod?: string;
  searchQuery?: string;
  productSortBy?: "revenue" | "quantity" | "profit" | "margin" | "refunded" | "discounted";
  topProductsMetric?: "revenue" | "quantity" | "profit";
}

export interface ReportKpiCard {
  id: string;
  label: string;
  currentValue: number;
  previousValue: number;
  growthPct: number;
  isPositive: boolean;
  unit: "currency" | "number" | "percentage";
  description?: string;
}

export interface ProductPerformanceItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  hsnCode: string;
  gstRatePct: number;
  quantitySold: number;
  grossSales: number;
  discounts: number;
  netSales: number;
  taxableValue: number;
  gstAmount: number;
  totalWithTax: number;
  unitCost: number;
  totalCogs: number;
  grossProfit: number;
  grossMarginPct: number;
  refundQuantity: number;
  refundAmount: number;
  avgSellingPrice: number;
  branchName: string;
}

export interface OrderReportItem {
  id: string;
  invoiceNumber: string;
  orderDate: string;
  deliveryDate: string;
  customerName: string;
  customerPhone: string;
  branchName: string;
  city: string;
  pincode: string;
  productNames: string;
  itemCount: number;
  grossAmount: number;
  discount: number;
  taxAmount: number;
  netAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
  deliveryStatus: string;
  cogs: number;
  profit: number;
  marginPct: number;
  prepTimeMins: number;
  dispatchTimeMins: number;
  deliveryTimeMins: number;
  totalCycleTimeMins: number;
}

export interface GstReportItem {
  hsnCode: string;
  description: string;
  uom: string;
  quantity: number;
  taxableValue: number;
  gstRatePct: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  totalValue: number;
}

export interface ExceptionAuditItem {
  id: string;
  severity: "high" | "medium" | "low";
  type: string;
  title: string;
  description: string;
  affectedCount: number;
  actionLabel: string;
  actionTab: ReportSection;
}

export class ReportsEngineData {
  // Master Catalog with Unit Cost, Cost Price, Packaging Cost, HSN Code, and GST Rate
  private static MASTER_PRODUCTS = [
    { id: "prod_01", sku: "CK-TRUF-10", name: "Belgian Chocolate Truffle Cake", category: "Cakes", hsnCode: "19059090", gstRatePct: 5, sellingPrice: 949, costPrice: 320, packagingCost: 35, totalCogs: 355 },
    { id: "prod_02", sku: "CK-REDV-05", name: "Fresh Red Velvet Heart Cake", category: "Cakes", hsnCode: "19059090", gstRatePct: 5, sellingPrice: 899, costPrice: 290, packagingCost: 35, totalCogs: 325 },
    { id: "prod_03", sku: "CK-BLKF-10", name: "Black Forest Classic Cake", category: "Cakes", hsnCode: "19059090", gstRatePct: 5, sellingPrice: 799, costPrice: 260, packagingCost: 30, totalCogs: 290 },
    { id: "prod_04", sku: "CK-PHOT-15", name: "Custom Edible Photo Print Cake", category: "Custom", hsnCode: "19059090", gstRatePct: 5, sellingPrice: 1199, costPrice: 380, packagingCost: 45, totalCogs: 425 },
    { id: "prod_05", sku: "CK-PINE-05", name: "Fresh Pineapple Glaze Cake", category: "Cakes", hsnCode: "19059090", gstRatePct: 5, sellingPrice: 699, costPrice: 210, packagingCost: 25, totalCogs: 235 },
    { id: "prod_06", sku: "ACC-CAND-05", name: "Sparkler Birthday Candles (Pack of 5)", category: "Accessories", hsnCode: "34060010", gstRatePct: 18, sellingPrice: 99, costPrice: 18, packagingCost: 5, totalCogs: 23 },
    { id: "prod_07", sku: "ACC-BALL-10", name: "Helium Birthday Balloons (Pack of 10)", category: "Accessories", hsnCode: "95059000", gstRatePct: 18, sellingPrice: 249, costPrice: 45, packagingCost: 10, totalCogs: 55 },
    { id: "prod_08", sku: "ACC-CARD-01", name: "Personalized Greeting Card", category: "Accessories", hsnCode: "49090090", gstRatePct: 12, sellingPrice: 149, costPrice: 20, packagingCost: 5, totalCogs: 25 },
  ];

  // Master Kitchen Branches
  private static MASTER_BRANCHES = [
    { id: "br_indiranagar", name: "Indiranagar Kitchen Hub", city: "Bengaluru", code: "HUB-01" },
    { id: "br_koramangala", name: "Koramangala Kitchen Hub", city: "Bengaluru", code: "HUB-02" },
    { id: "br_hsr", name: "HSR Layout Kitchen Hub", city: "Bengaluru", code: "HUB-03" },
    { id: "br_whitefield", name: "Whitefield Kitchen Hub", city: "Bengaluru", code: "HUB-04" },
  ];

  /**
   * Determine date boundaries for selected Date Range filter
   */
  public static getDateRange(filters: ReportFilterState): { start: Date; end: Date; days: number } {
    const end = new Date();
    const start = new Date();

    if (filters.timeRange === "today") {
      start.setHours(0, 0, 0, 0);
    } else if (filters.timeRange === "yesterday") {
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
    } else if (filters.timeRange === "last_7_days" || filters.timeRange === "this_week") {
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
    } else if (filters.timeRange === "last_30_days" || filters.timeRange === "this_month") {
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
    } else if (filters.timeRange === "last_month") {
      start.setMonth(start.getMonth() - 1);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setDate(0); // Last day of previous month
      end.setHours(23, 59, 59, 999);
    } else if (filters.timeRange === "last_90_days" || filters.timeRange === "this_quarter") {
      start.setDate(start.getDate() - 89);
      start.setHours(0, 0, 0, 0);
    } else if (filters.timeRange === "this_year" || filters.timeRange === "financial_year") {
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
    } else if (filters.timeRange === "custom" && filters.customStartDate && filters.customEndDate) {
      const s = new Date(filters.customStartDate);
      const e = new Date(filters.customEndDate);
      if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
        s.setHours(0, 0, 0, 0);
        e.setHours(23, 59, 59, 999);
        const days = Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)));
        return { start: s, end: e, days };
      }
    }

    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    return { start, end, days };
  }

  /**
   * Central Transactional Data Generator & Calculator Engine
   */
  public static getTransactionalMetrics(filters: ReportFilterState) {
    const { days } = this.getDateRange(filters);

    // Scaling factors based on days and multi-select branch filter
    const totalBranchCount = 4;
    const isAllSelected = !filters.branchIds || filters.branchIds.length === 0 || filters.branchIds.includes("all");
    const activeBranchCount = isAllSelected ? totalBranchCount : Math.max(1, filters.branchIds.length);
    const branchRatio = activeBranchCount / totalBranchCount;
    const volumeFactor = days * branchRatio;

    // Core Order Volume
    const totalOrders = Math.round(180 * volumeFactor);
    const deliveredOrders = Math.round(totalOrders * 0.942);
    const cancelledOrders = Math.round(totalOrders * 0.038);
    const refundedOrders = Math.round(totalOrders * 0.020);

    // Financial Reconciliation
    const avgTicketGross = 880;
    const grossRevenue = totalOrders * avgTicketGross;
    const discounts = Math.round(grossRevenue * 0.075);
    const refunds = Math.round(grossRevenue * 0.022);
    const netSalesExclTax = Math.round(grossRevenue - discounts - refunds);

    const gstCollected = Math.round(netSalesExclTax * 0.18);
    const cgst = Math.round(gstCollected / 2);
    const sgst = Math.round(gstCollected / 2);
    const totalCustomerPayable = netSalesExclTax + gstCollected;

    // COGS & Cost Accounting
    const totalCogs = Math.round(netSalesExclTax * 0.355);
    const packagingCosts = Math.round(netSalesExclTax * 0.038);
    const deliveryFleetCosts = Math.round(netSalesExclTax * 0.065);
    const totalDirectCosts = totalCogs + packagingCosts + deliveryFleetCosts;

    const grossProfit = netSalesExclTax - totalDirectCosts;
    const grossMarginPct = netSalesExclTax > 0 ? (grossProfit / netSalesExclTax) * 100 : 0;
    const aov = totalOrders > 0 ? netSalesExclTax / totalOrders : 0;

    // Comparison Multipliers
    let compMult = 0.88; // Default 12% growth vs previous period
    if (filters.compareMode === "previous_month") compMult = 0.91;
    if (filters.compareMode === "previous_year") compMult = 0.76;

    const prevGrossRevenue = Math.round(grossRevenue * compMult);
    const prevNetSales = Math.round(netSalesExclTax * compMult);
    const prevOrders = Math.round(totalOrders * compMult);
    const prevDelivered = Math.round(deliveredOrders * compMult);
    const prevAov = prevOrders > 0 ? prevNetSales / prevOrders : 0;
    const prevGrossProfit = Math.round(grossProfit * compMult);
    const prevGrossMarginPct = grossMarginPct * 0.96;
    const prevGst = Math.round(gstCollected * compMult);
    const prevDiscounts = Math.round(discounts * compMult);
    const prevRefunds = Math.round(refunds * compMult);

    return {
      days,
      totalOrders,
      deliveredOrders,
      cancelledOrders,
      refundedOrders,
      grossRevenue,
      discounts,
      refunds,
      netSalesExclTax,
      gstCollected,
      cgst,
      sgst,
      totalCustomerPayable,
      totalCogs,
      packagingCosts,
      deliveryFleetCosts,
      grossProfit,
      grossMarginPct: Number(grossMarginPct.toFixed(2)),
      aov: Math.round(aov),
      taxCollected: gstCollected,
      deliveryCharges: deliveryFleetCosts,
      averageOrderValue: Math.round(aov),
      // Previous Period Values for Comparison Engine
      prevGrossRevenue,
      prevNetSales,
      prevOrders,
      prevDelivered,
      prevAov: Math.round(prevAov),
      prevGrossProfit,
      prevGrossMarginPct: Number(prevGrossMarginPct.toFixed(2)),
      prevGst,
      prevDiscounts,
      prevRefunds,
    };
  }

  /**
   * Generate Executive Dashboard KPI Cards
   */
  public static getExecutiveKpis(filters: ReportFilterState): ReportKpiCard[] {
    const stats = this.getTransactionalMetrics(filters);

    const calcGrowth = (curr: number, prev: number) => {
      if (prev === 0) return 100;
      return Number((((curr - prev) / prev) * 100).toFixed(1));
    };

    return [
      {
        id: "kpi_net_sales",
        label: "Net Sales (Excl. Tax)",
        currentValue: stats.netSalesExclTax,
        previousValue: stats.prevNetSales,
        growthPct: calcGrowth(stats.netSalesExclTax, stats.prevNetSales),
        isPositive: stats.netSalesExclTax >= stats.prevNetSales,
        unit: "currency",
        description: "Gross revenue minus discounts and customer refunds",
      },
      {
        id: "kpi_gross_revenue",
        label: "Gross Revenue",
        currentValue: stats.grossRevenue,
        previousValue: stats.prevGrossRevenue,
        growthPct: calcGrowth(stats.grossRevenue, stats.prevGrossRevenue),
        isPositive: stats.grossRevenue >= stats.prevGrossRevenue,
        unit: "currency",
        description: "Total order value before discounts and tax",
      },
      {
        id: "kpi_orders",
        label: "Total Orders Placed",
        currentValue: stats.totalOrders,
        previousValue: stats.prevOrders,
        growthPct: calcGrowth(stats.totalOrders, stats.prevOrders),
        isPositive: stats.totalOrders >= stats.prevOrders,
        unit: "number",
        description: "Volume of orders received across all kitchen hubs",
      },
      {
        id: "kpi_delivered",
        label: "Delivered Orders",
        currentValue: stats.deliveredOrders,
        previousValue: stats.prevDelivered,
        growthPct: calcGrowth(stats.deliveredOrders, stats.prevDelivered),
        isPositive: stats.deliveredOrders >= stats.prevDelivered,
        unit: "number",
        description: "Successfully fulfilled and handed over orders",
      },
      {
        id: "kpi_aov",
        label: "Average Order Value (AOV)",
        currentValue: stats.aov,
        previousValue: stats.prevAov,
        growthPct: calcGrowth(stats.aov, stats.prevAov),
        isPositive: stats.aov >= stats.prevAov,
        unit: "currency",
        description: "Average net spend per customer order",
      },
      {
        id: "kpi_profit",
        label: "Gross Contribution Profit",
        currentValue: stats.grossProfit,
        previousValue: stats.prevGrossProfit,
        growthPct: calcGrowth(stats.grossProfit, stats.prevGrossProfit),
        isPositive: stats.grossProfit >= stats.prevGrossProfit,
        unit: "currency",
        description: "Net sales minus COGS, packaging & fleet costs",
      },
      {
        id: "kpi_margin",
        label: "Gross Margin %",
        currentValue: stats.grossMarginPct,
        previousValue: stats.prevGrossMarginPct,
        growthPct: Number((stats.grossMarginPct - stats.prevGrossMarginPct).toFixed(1)),
        isPositive: stats.grossMarginPct >= stats.prevGrossMarginPct,
        unit: "percentage",
        description: "Percentage of revenue retained as contribution profit",
      },
      {
        id: "kpi_gst",
        label: "Total GST Collected",
        currentValue: stats.gstCollected,
        previousValue: stats.prevGst,
        growthPct: calcGrowth(stats.gstCollected, stats.prevGst),
        isPositive: true,
        unit: "currency",
        description: "18% GST liability collected for government remittance",
      },
      {
        id: "kpi_discounts",
        label: "Total Discounts Given",
        currentValue: stats.discounts,
        previousValue: stats.prevDiscounts,
        growthPct: calcGrowth(stats.discounts, stats.prevDiscounts),
        isPositive: stats.discounts <= stats.prevDiscounts,
        unit: "currency",
        description: "Coupon savings, promotional & loyalty discounts",
      },
      {
        id: "kpi_refunds",
        label: "Total Customer Refunds",
        currentValue: stats.refunds,
        previousValue: stats.prevRefunds,
        growthPct: calcGrowth(stats.refunds, stats.prevRefunds),
        isPositive: stats.refunds <= stats.prevRefunds,
        unit: "currency",
        description: "Refunds issued for cancellations or quality claims",
      },
    ];
  }

  /**
   * Detailed Product Performance & Profitability Table Dataset
   */
  public static getProductPerformance(filters: ReportFilterState): ProductPerformanceItem[] {
    const stats = this.getTransactionalMetrics(filters);

    const items: ProductPerformanceItem[] = this.MASTER_PRODUCTS.map((p, idx) => {
      const share = [0.32, 0.24, 0.18, 0.12, 0.08, 0.03, 0.02, 0.01][idx] || 0.01;
      const qty = Math.round(stats.totalOrders * share * 1.4);
      const gross = Math.round(qty * p.sellingPrice);
      const disc = Math.round(gross * 0.07);
      const net = gross - disc;
      const taxable = Math.round(net / (1 + p.gstRatePct / 100));
      const gst = net - taxable;
      const totalCogs = Math.round(qty * p.totalCogs);
      const profit = net - totalCogs;
      const margin = net > 0 ? (profit / net) * 100 : 0;
      const refQty = Math.round(qty * 0.012);
      const refAmt = refQty * p.sellingPrice;

      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        category: p.category,
        hsnCode: p.hsnCode,
        gstRatePct: p.gstRatePct,
        quantitySold: qty,
        grossSales: gross,
        discounts: disc,
        netSales: net,
        taxableValue: taxable,
        gstAmount: gst,
        totalWithTax: net + gst,
        unitCost: p.totalCogs,
        totalCogs: totalCogs,
        grossProfit: profit,
        grossMarginPct: Number(margin.toFixed(2)),
        refundQuantity: refQty,
        refundAmount: refAmt,
        avgSellingPrice: p.sellingPrice,
        branchName: "All Kitchen Hubs",
      };
    });

    // Handle Sorting
    const sort = filters.productSortBy || "revenue";
    return items.sort((a, b) => {
      if (sort === "revenue") return b.netSales - a.netSales;
      if (sort === "quantity") return b.quantitySold - a.quantitySold;
      if (sort === "profit") return b.grossProfit - a.grossProfit;
      if (sort === "margin") return b.grossMarginPct - a.grossMarginPct;
      if (sort === "refunded") return b.refundAmount - a.refundAmount;
      if (sort === "discounted") return b.discounts - a.discounts;
      return b.netSales - a.netSales;
    });
  }

  /**
   * Detailed Order Lifecycle & Timestamps Table Dataset
   */
  public static getOrderLifecycle(filters: ReportFilterState): OrderReportItem[] {
    const stats = this.getTransactionalMetrics(filters);
    const limit = Math.min(25, stats.totalOrders);

    const customers = [
      { name: "Ananya Sharma", phone: "+91 98450 12345", city: "Bengaluru", pincode: "560038" },
      { name: "Vikram Malhotra", phone: "+91 98111 67890", city: "Bengaluru", pincode: "560034" },
      { name: "Priya Nair", phone: "+91 97400 45678", city: "Bengaluru", pincode: "560102" },
      { name: "Rahul Verma", phone: "+91 99000 88990", city: "Bengaluru", pincode: "560066" },
    ];

    const paymentMethods = ["UPI PhonePe", "UPI GooglePay", "COD Cash", "Credit Card", "Net Banking"];
    const branches = ["Indiranagar Hub", "Koramangala Hub", "HSR Layout Hub", "Whitefield Hub"];

    return Array.from({ length: limit }).map((_, i) => {
      const cust = customers[i % customers.length];
      const branch = branches[i % branches.length];
      const method = paymentMethods[i % paymentMethods.length];
      const prod = this.MASTER_PRODUCTS[i % this.MASTER_PRODUCTS.length];
      const qty = (i % 3) + 1;
      const gross = prod.sellingPrice * qty;
      const disc = Math.round(gross * 0.05);
      const tax = Math.round((gross - disc) * 0.18);
      const net = gross - disc + tax;
      const cogs = prod.totalCogs * qty;
      const profit = (gross - disc) - cogs;
      const margin = (gross - disc) > 0 ? (profit / (gross - disc)) * 100 : 0;

      const dateStr = new Date(Date.now() - i * 3600000 * 6).toISOString().split("T")[0];

      return {
        id: `ORD-2026-${1001 + i}`,
        invoiceNumber: `CTH-INV-2026-${String(100001 + i).padStart(6, "0")}`,
        orderDate: `${dateStr} 14:${10 + i}:00`,
        deliveryDate: dateStr,
        customerName: cust.name,
        customerPhone: cust.phone,
        branchName: branch,
        city: cust.city,
        pincode: cust.pincode,
        productNames: `${prod.name} (x${qty})`,
        itemCount: qty,
        grossAmount: gross,
        discount: disc,
        taxAmount: tax,
        netAmount: net,
        paymentMethod: method,
        paymentStatus: "PAID",
        orderStatus: i === 2 ? "CANCELLED" : "DELIVERED",
        deliveryStatus: i === 2 ? "CANCELLED" : "ON_TIME",
        cogs: cogs,
        profit: profit,
        marginPct: Number(margin.toFixed(2)),
        prepTimeMins: 22 + (i % 10),
        dispatchTimeMins: 12 + (i % 5),
        deliveryTimeMins: 28 + (i % 15),
        totalCycleTimeMins: 62 + (i % 25),
      };
    });
  }

  public static HSN_MASTER_DESCRIPTIONS: Record<string, { description: string; defaultUqc: string }> = {
    "19059090": { description: "Cakes, Pastries & Bakery Goods", defaultUqc: "PCS" },
    "34060010": { description: "Candles & Tapers", defaultUqc: "PKT" },
    "95059000": { description: "Balloons & Party Requisites", defaultUqc: "PKT" },
    "49090090": { description: "Postcards & Greeting Cards", defaultUqc: "NOS" },
    "19053100": { description: "Sweet Biscuits & Wafers", defaultUqc: "KGS" },
    "21069099": { description: "Food Preparations & Confectionery", defaultUqc: "BOX" },
  };

  /**
   * GST Tax Summary Report Dataset (Grouped by HSN/SAC + UQC + GST RATE)
   */
  public static getGstReport(filters: ReportFilterState): GstReportItem[] {
    const prods = this.getProductPerformance(filters);

    const hsnGrouped = new Map<string, GstReportItem>();

    for (const p of prods) {
      const masterInfo = this.HSN_MASTER_DESCRIPTIONS[p.hsnCode] || { description: "Bakery & Confectionery Products", defaultUqc: "NOS" };
      const uom = masterInfo.defaultUqc || "NOS";
      const compositeKey = `${p.hsnCode}_${uom}_${p.gstRatePct}`;

      const existing = hsnGrouped.get(compositeKey) || {
        hsnCode: p.hsnCode,
        description: masterInfo.description,
        uom: uom,
        quantity: 0,
        taxableValue: 0,
        gstRatePct: p.gstRatePct,
        cgst: 0,
        sgst: 0,
        igst: 0,
        totalTax: 0,
        totalValue: 0,
      };

      existing.quantity += p.quantitySold;
      existing.taxableValue += p.taxableValue;
      const tax = p.gstAmount;
      existing.cgst += Math.round(tax / 2);
      existing.sgst += Math.round(tax / 2);
      existing.totalTax += tax;
      existing.totalValue += p.totalWithTax;

      hsnGrouped.set(compositeKey, existing);
    }

    return Array.from(hsnGrouped.values());
  }

  /**
   * Tax Summary Report Dataset (Grouped by Tax Master Configuration / Tax Code / GST Rate)
   */
  public static getTaxSummaryReport(filters: ReportFilterState): {
    taxConfigurationId: string;
    taxConfigurationName: string;
    taxConfigurationCode: string;
    taxability: string;
    gstRatePct: number;
    taxableValue: number;
    cgst: number;
    sgst: number;
    igst: number;
    cess: number;
    totalTax: number;
    grossValue: number;
    invoiceCount: number;
  }[] {
    const prods = this.getProductPerformance(filters);
    const taxGrouped = new Map<string, any>();

    for (const p of prods) {
      const taxCode = p.gstRatePct === 5 ? "GST_FOOD_5" : p.gstRatePct === 12 ? "GST_FOOD_12" : p.gstRatePct === 18 ? "GST_FOOD_18" : "GST_EXEMPT";
      const taxName = p.gstRatePct === 5 ? "GST Food 5%" : p.gstRatePct === 12 ? "GST Food 12%" : p.gstRatePct === 18 ? "GST Accessories 18%" : "GST Exempt";
      const taxId = `txcfg_${taxCode.toLowerCase()}`;

      const existing = taxGrouped.get(taxCode) || {
        taxConfigurationId: taxId,
        taxConfigurationName: taxName,
        taxConfigurationCode: taxCode,
        taxability: p.gstRatePct > 0 ? "Taxable" : "Exempt",
        gstRatePct: p.gstRatePct,
        taxableValue: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        cess: 0,
        totalTax: 0,
        grossValue: 0,
        invoiceCount: 0,
      };

      existing.taxableValue += p.taxableValue;
      const tax = p.gstAmount;
      existing.cgst += Math.round(tax / 2);
      existing.sgst += Math.round(tax / 2);
      existing.totalTax += tax;
      existing.grossValue += p.totalWithTax;
      existing.invoiceCount += Math.max(1, Math.round(p.quantitySold / 2));

      taxGrouped.set(taxCode, existing);
    }

    return Array.from(taxGrouped.values());
  }

  /**
   * Exception Center Audit Findings
   */
  public static getExceptionCenterAudit(filters: ReportFilterState): ExceptionAuditItem[] {
    return [
      {
        id: "exc_01",
        severity: "medium",
        type: "missing_cost",
        title: "2 Products Missing Cost Price in PIM",
        description: "Products 'Sparkler Candles' and 'Helium Balloons' have unverified raw material cost prices.",
        affectedCount: 2,
        actionLabel: "Update PIM Costs",
        actionTab: "products",
      },
      {
        id: "exc_02",
        severity: "high",
        type: "missing_hsn",
        title: "1 Custom Product Missing HSN / GST Code",
        description: "Product 'Custom Edible Photo Print Cake' is missing explicit HSN tax classification.",
        affectedCount: 1,
        actionLabel: "Assign HSN Code",
        actionTab: "tax_gst",
      },
      {
        id: "exc_03",
        severity: "high",
        type: "low_margin",
        title: "1 Product Operating Below 25% Target Margin",
        description: "Pineapple Glaze Cake margin dropped to 23.4% due to packaging cost inflation.",
        affectedCount: 1,
        actionLabel: "Review Product Cost",
        actionTab: "products",
      },
      {
        id: "exc_04",
        severity: "medium",
        type: "uninvoiced_order",
        title: "3 Delivered Orders Pending Invoice Generation",
        description: "Orders ORD-2026-1014 to 1016 require manual invoice generation trigger.",
        affectedCount: 3,
        actionLabel: "Generate Invoices",
        actionTab: "orders",
      },
    ];
  }

  /**
   * Dynamic Branch Performance Dataset
   */
  public static getBranchPerformance(filters: ReportFilterState, dynamicBranches?: any[]) {
    const stats = this.getTransactionalMetrics(filters);

    let rawBranches: any[] = [];
    if (dynamicBranches && dynamicBranches.length > 0) {
      rawBranches = dynamicBranches;
    } else {
      rawBranches = [
        { id: "br_indiranagar", name: "Indiranagar Kitchen Hub", code: "HUB-01" },
        { id: "br_koramangala", name: "Koramangala Kitchen Hub", code: "HUB-02" },
        { id: "br_hsr", name: "HSR Layout Kitchen Hub", code: "HUB-03" },
        { id: "br_whitefield", name: "Whitefield Kitchen Hub", code: "HUB-04" },
      ];
    }

    const selectedIds = filters.branchIds || [];
    const activeList = selectedIds.length > 0
      ? rawBranches.filter((b) => selectedIds.includes(b.id))
      : rawBranches;

    const listToRender = activeList.length > 0 ? activeList : rawBranches;

    return listToRender.map((b, idx) => {
      const weightBase = 1 / listToRender.length;
      const variance = (idx % 2 === 0 ? 1.15 : 0.85) * (1 - (idx * 0.02));
      const effectiveRatio = weightBase * variance;

      const grossSales = Math.round(stats.grossRevenue * effectiveRatio);
      const netSales = Math.round(stats.netSalesExclTax * effectiveRatio);
      const orders = Math.round(stats.totalOrders * effectiveRatio);
      const delivered = Math.round(stats.deliveredOrders * effectiveRatio);
      const cancelled = Math.round(stats.cancelledOrders * effectiveRatio);
      const cogs = Math.round(netSales * (0.34 + (idx % 4) * 0.015));
      const profit = netSales - cogs;
      const margin = netSales > 0 ? Number(((profit / netSales) * 100).toFixed(2)) : 0;
      const aov = orders > 0 ? Math.round(netSales / orders) : 0;
      const onTimeDeliveryPct = Number((94.5 + (idx % 5) * 0.9).toFixed(1));
      const avgDeliveryTimeMins = 24 + (idx % 6) * 3;
      const customerCount = Math.max(1, Math.round(orders * 0.82));

      return {
        id: b.id,
        branchName: b.name || b.id,
        branchCode: b.code || `HUB-${String(idx + 1).padStart(2, "0")}`,
        ordersCount: orders,
        deliveredCount: delivered,
        cancelledCount: cancelled,
        grossSales,
        netSales,
        cogs,
        grossProfit: profit,
        marginPct: margin,
        aov,
        customerCount,
        onTimeDeliveryPct,
        avgDeliveryTimeMins,
      };
    });
  }

  /**
   * Delivery & Fleet Performance Dataset
   */
  public static getDeliveryFleetPerformance(filters: ReportFilterState) {
    const stats = this.getTransactionalMetrics(filters);
    const partners = [
      { partner: "Shadowfax Express", total: Math.round(stats.deliveredOrders * 0.45), onTime: Math.round(stats.deliveredOrders * 0.43), delayed: Math.round(stats.deliveredOrders * 0.02), avgMins: 28, rating: 4.8 },
      { partner: "Dunzo Logistics", total: Math.round(stats.deliveredOrders * 0.30), onTime: Math.round(stats.deliveredOrders * 0.28), delayed: Math.round(stats.deliveredOrders * 0.02), avgMins: 31, rating: 4.7 },
      { partner: "Porter Local", total: Math.round(stats.deliveredOrders * 0.15), onTime: Math.round(stats.deliveredOrders * 0.14), delayed: Math.round(stats.deliveredOrders * 0.01), avgMins: 35, rating: 4.6 },
      { partner: "In-House Bakery Fleet", total: Math.round(stats.deliveredOrders * 0.10), onTime: Math.round(stats.deliveredOrders * 0.098), delayed: Math.round(stats.deliveredOrders * 0.002), avgMins: 22, rating: 4.9 },
    ];

    return {
      totalDeliveries: stats.deliveredOrders,
      onTimeDeliveries: Math.round(stats.deliveredOrders * 0.94),
      delayedDeliveries: Math.round(stats.deliveredOrders * 0.06),
      avgFulfillmentMins: 34,
      partners,
    };
  }

  /**
   * Customer Analytics & Segmentation Dataset
   */
  public static getCustomerAnalytics(filters: ReportFilterState) {
    const stats = this.getTransactionalMetrics(filters);
    const totalCustomers = Math.round(stats.totalOrders * 0.75);
    const newCustomers = Math.round(totalCustomers * 0.32);
    const returningCustomers = totalCustomers - newCustomers;

    const topCustomers = [
      { id: "cust_101", name: "Ananya Sharma", phone: "+91 98450 12345", totalOrders: 14, totalSpend: 18400, aov: 1314, segment: "VIP Corporate" },
      { id: "cust_102", name: "Vikram Malhotra", phone: "+91 98111 67890", totalOrders: 9, totalSpend: 11200, aov: 1244, segment: "Repeat Consumer" },
      { id: "cust_103", name: "Priya Nair", phone: "+91 97400 45678", totalOrders: 7, totalSpend: 9450, aov: 1350, segment: "Repeat Consumer" },
      { id: "cust_104", name: "Rahul Verma", phone: "+91 99000 88990", totalOrders: 6, totalSpend: 8200, aov: 1366, segment: "Repeat Consumer" },
    ];

    return {
      totalCustomers,
      newCustomers,
      returningCustomers,
      repeatRatePct: 68.0,
      ltv: 2450,
      topCustomers,
    };
  }

  /**
   * Payments & Refunds Reconciliation Dataset
   */
  public static getPaymentsRefunds(filters: ReportFilterState) {
    const stats = this.getTransactionalMetrics(filters);

    const breakdown = [
      { method: "UPI (PhonePe / GPay)", gross: Math.round(stats.grossRevenue * 0.62), count: Math.round(stats.totalOrders * 0.62), successPct: 99.2 },
      { method: "Credit / Debit Cards", gross: Math.round(stats.grossRevenue * 0.22), count: Math.round(stats.totalOrders * 0.22), successPct: 98.4 },
      { method: "COD (Cash on Delivery)", gross: Math.round(stats.grossRevenue * 0.11), count: Math.round(stats.totalOrders * 0.11), successPct: 95.0 },
      { method: "Net Banking / Wallet", gross: Math.round(stats.grossRevenue * 0.05), count: Math.round(stats.totalOrders * 0.05), successPct: 97.8 },
    ];

    return {
      totalCollected: stats.totalCustomerPayable,
      totalRefunds: stats.refunds,
      netCollected: stats.totalCustomerPayable - stats.refunds,
      breakdown,
    };
  }

  /**
   * Geographic Sales & Address Analysis Dataset
   */
  public static getGeographicSales(filters: ReportFilterState) {
    const stats = this.getTransactionalMetrics(filters);

    const locations = [
      { city: "Bengaluru", area: "Indiranagar", pincode: "560038", orders: Math.round(stats.totalOrders * 0.35), revenue: Math.round(stats.netSalesExclTax * 0.35) },
      { city: "Bengaluru", area: "Koramangala", pincode: "560034", orders: Math.round(stats.totalOrders * 0.30), revenue: Math.round(stats.netSalesExclTax * 0.30) },
      { city: "Bengaluru", area: "HSR Layout", pincode: "560102", orders: Math.round(stats.totalOrders * 0.20), revenue: Math.round(stats.netSalesExclTax * 0.20) },
      { city: "Bengaluru", area: "Whitefield", pincode: "560066", orders: Math.round(stats.totalOrders * 0.15), revenue: Math.round(stats.netSalesExclTax * 0.15) },
    ];

    return locations;
  }

  /**
   * Cross-Sell & Upsell Co-Purchase Basket Analysis Dataset
   */
  public static getCrossSellUpsell(filters: ReportFilterState) {
    const pairs = [
      { primaryItem: "Dutch Chocolate Truffle Cake 1kg", coPurchasedItem: "Sparkler Birthday Candles (Pack of 6)", coPurchaseCount: 42, attachRatePct: 38.2, addedRevenue: 6300 },
      { primaryItem: "Red Velvet Cream Cheese Cake 1kg", coPurchasedItem: "Helium Happy Birthday Balloon", coPurchaseCount: 31, attachRatePct: 29.5, addedRevenue: 4650 },
      { primaryItem: "Fresh Fruit Exotica Cake 1kg", coPurchasedItem: "Golden Cake Knife & Server Set", coPurchaseCount: 24, attachRatePct: 22.1, addedRevenue: 7200 },
      { primaryItem: "Black Forest Classic Cake 1kg", coPurchasedItem: "Handwritten Greeting Card", coPurchaseCount: 19, attachRatePct: 18.4, addedRevenue: 1900 },
    ];

    return pairs;
  }
}

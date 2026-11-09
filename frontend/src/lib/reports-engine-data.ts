/**
 * CakeToHome Enterprise ERP Analytics & Reporting Engine v3.0 (Production)
 *
 * Core Reporting Service over Transactional Data Architecture:
 * - Daily Sales Report (KPIs, Payment Summary, Product Summary, Branch Summary)
 * - Weekly Sales Report (Revenue, Top 3 & Least Selling Cakes, Payment % Split)
 * - Monthly Sales Report (Sales Growth %, Delivery SLA, Order Lifecycle, Customer Retention)
 * - City Sales & Regional Distribution (Multi-city, sorted by Net Sales)
 * - Area & Pincode Sales Report
 * - Statutory GST B2C HSN Summary & Detailed Invoice Register
 * - Order Register & Reconciliation
 * - Single source of truth for Web Dashboard, XLSX Export, and APIs
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
  | "kpi_cards"
  | "data_table";

export type GroupByDimension =
  | "branch"
  | "city"
  | "area"
  | "pincode"
  | "category"
  | "occasion"
  | "customer"
  | "payment_method"
  | "delivery_zone"
  | "product";

export type ReportSection =
  | "executive_summary"
  | "daily_sales"
  | "weekly_sales"
  | "monthly_sales"
  | "sales"
  | "products"
  | "profitability"
  | "orders"
  | "branches"
  | "city_sales"
  | "area_pincode"
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
  city?: string;
  category?: string;
  occasion?: string;
  orderStatus?: string;
  deliveryStatus?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  searchQuery?: string;
  productSortBy?: "revenue" | "quantity" | "profit" | "margin" | "refunded" | "discounted";
  topProductsMetric?: "revenue" | "quantity" | "profit";
}

export interface ReportKpiCard {
  id: string;
  label: string;
  currentValue: number | null;  // null = data unavailable
  previousValue: number | null; // null = no prior period data
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
  occasion?: string;
  hsnCode: string;
  uqc?: string;
  gstRatePct: number;
  quantitySold: number;
  grossSales: number;
  discounts: number;
  netSales: number;
  taxableValue: number;
  gstAmount: number;
  totalWithTax: number;
  unitCost: number | null;      // null if no cost data in product metadata
  totalCogs: number | null;     // null if unitCost unavailable
  grossProfit: number | null;   // null if COGS unavailable
  grossMarginPct: number | null; // null if COGS unavailable
  refundQuantity: number;
  refundAmount: number;
  avgSellingPrice: number;
  branchName: string;
  productName?: string;
  sellingPrice?: number;
  rank?: number;
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
  area: string;
  pincode: string;
  productNames: string;
  itemCount: number;
  grossAmount: number;
  discount: number;
  taxAmount: number;
  deliveryFee: number;
  netAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
  deliveryStatus: string;
  cogs: number | null;          // null if no cost data
  profit: number | null;        // null if COGS unavailable
  marginPct: number | null;     // null if COGS unavailable
  prepTimeMins: number | null;  // null if not tracked
  dispatchTimeMins: number | null;
  deliveryTimeMins: number | null;
  totalCycleTimeMins: number | null;
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
  cess: number;
  totalTax: number;
  totalValue: number;
}

export interface GstDetailedRegisterItem {
  invoiceNumber: string;
  orderId: string;
  orderDate: string;
  customerName: string;
  customerGstin?: string;
  city: string;
  branchName: string;
  classification: "B2C" | "B2B";
  productName: string;
  sku: string;
  hsnCode: string;
  description: string;
  uqc: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxableValue: number;
  gstRatePct: number;
  cgstRatePct: number;
  cgstAmount: number;
  sgstRatePct: number;
  sgstAmount: number;
  igstRatePct: number;
  igstAmount: number;
  cessRatePct: number;
  cessAmount: number;
  totalTax: number;
  invoiceTotal: number;
}

export interface TaxSummaryItem {
  taxConfigurationName: string;
  taxConfigurationCode: string;
  taxability: string;
  gstRatePct: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  grossValue: number;
  invoiceCount: number;
}

// ── In-Memory Dynamic Store Injection ──────────────────────────────────────────
let dynamicOrders: any[] | null = null;
let dynamicProducts: any[] | null = null;
let dynamicBranches: any[] | null = null;
let dynamicCustomers: any[] | null = null;
let isPostgresAuthoritative: boolean = false;

const DEFAULT_SEED_BRANCHES = [
  { id: "res_01KXYMAHGFPRY1G9TZKEVGAGAT", name: "Indiranagar Flagship", code: "HUB-01", city: "Bengaluru", is_open: true, max_orders_per_hour: 30, current_hourly_load: 18 },
  { id: "res_02KXYMAHGFPRY1G9TZKEVGAGAU", name: "Koramangala Hub", code: "HUB-02", city: "Bengaluru", is_open: true, max_orders_per_hour: 25, current_hourly_load: 14 },
  { id: "res_03KXYMAHGFPRY1G9TZKEVGAGAV", name: "Whitefield Express", code: "HUB-03", city: "Bengaluru", is_open: true, max_orders_per_hour: 20, current_hourly_load: 11 },
  { id: "res_04KXYMAHGFPRY1G9TZKEVGAGAW", name: "Jayanagar Artisan Kitchen", code: "HUB-04", city: "Bengaluru", is_open: true, max_orders_per_hour: 22, current_hourly_load: 9 },
];

const DEFAULT_SEED_PRODUCTS = [
  { id: "prod_1", title: "Belgian Dark Truffle Signature Cake", name: "Belgian Dark Truffle Signature Cake", sku: "SKU-TRUFFLE-01", price: 699, metadata: { category: "Cakes", occasion: "Birthday", hsn_code: "19059090", uqc: "NOS", gst_rate: 5, cost_price: 245 } },
  { id: "prod_2", title: "Fresh Red Velvet Heart Cake", name: "Fresh Red Velvet Heart Cake", sku: "SKU-REDVELVET-02", price: 749, metadata: { category: "Cakes", occasion: "Anniversary", hsn_code: "19059090", uqc: "NOS", gst_rate: 5, cost_price: 260 } },
  { id: "prod_3", title: "Black Forest German Classic Cake", name: "Black Forest German Classic Cake", sku: "SKU-BLACKFOREST-03", price: 649, metadata: { category: "Cakes", occasion: "Birthday", hsn_code: "19059090", uqc: "NOS", gst_rate: 5, cost_price: 220 } },
  { id: "prod_4", title: "Fresh Mango Cream Summer Special", name: "Fresh Mango Cream Summer Special", sku: "SKU-MANGO-04", price: 799, metadata: { category: "Cakes", occasion: "Celebration", hsn_code: "19059090", uqc: "NOS", gst_rate: 5, cost_price: 280 } },
  { id: "prod_5", title: "Custom Birthday Photo Cake", name: "Custom Birthday Photo Cake", sku: "SKU-PHOTO-05", price: 899, metadata: { category: "Custom Cakes", occasion: "Birthday", hsn_code: "19059090", uqc: "NOS", gst_rate: 5, cost_price: 315 } },
  { id: "prod_6", title: "Sparkler Birthday Celebration Candles", name: "Sparkler Birthday Celebration Candles", sku: "SKU-CANDLE-06", price: 99, metadata: { category: "Accessories", occasion: "Party", hsn_code: "34060010", uqc: "PKT", gst_rate: 18, cost_price: 35 } },
  { id: "prod_7", title: "Happy Birthday Gold Foil Cake Topper", name: "Happy Birthday Gold Foil Cake Topper", sku: "SKU-TOPPER-07", price: 149, metadata: { category: "Accessories", occasion: "Birthday", hsn_code: "95059000", uqc: "PKT", gst_rate: 18, cost_price: 50 } },
  { id: "prod_8", title: "Artisan Chocolate Brownie Box", name: "Artisan Chocolate Brownie Box", sku: "SKU-BROWNIE-08", price: 449, metadata: { category: "Pastries & Brownies", occasion: "Gifting", hsn_code: "19059090", uqc: "BOX", gst_rate: 5, cost_price: 155 } },
];

const DEFAULT_SEED_ORDERS = [
  {
    id: "ord_101",
    order_number: "CTH-20260815-001",
    invoice_number: "CTH/26-27/000001",
    customer_name: "Rahul Verma",
    customer_phone: "+91 98765 43210",
    customer_email: "rahul@example.com",
    created_at: new Date().toISOString(),
    delivery_date: new Date().toISOString().slice(0, 10),
    status: "delivered",
    delivery_status: "delivered",
    payment_status: "paid",
    payment_method: "upi",
    subtotal: 798,
    discount_total: 50,
    delivery_fee: 0,
    tax_total: 37.4,
    total: 785.4,
    branch: DEFAULT_SEED_BRANCHES[0],
    branch_id: DEFAULT_SEED_BRANCHES[0].id,
    shipping_address: { address_1: "100 Feet Rd", area: "Indiranagar", city: "Bengaluru", state: "Karnataka", postal_code: "560038" },
    items: [
      { product_id: "prod_1", title: "Belgian Dark Truffle Signature Cake", quantity: 1, unit_price: 699, subtotal: 699, hsn_code: "19059090", uqc: "NOS", gst_rate: 5 },
      { product_id: "prod_6", title: "Sparkler Birthday Celebration Candles", quantity: 1, unit_price: 99, subtotal: 99, hsn_code: "34060010", uqc: "PKT", gst_rate: 18 },
    ],
  },
  {
    id: "ord_102",
    order_number: "CTH-20260815-002",
    invoice_number: "CTH/26-27/000002",
    customer_name: "Pooja Sharma",
    customer_phone: "+91 98765 22222",
    customer_email: "pooja@example.com",
    created_at: new Date().toISOString(),
    delivery_date: new Date().toISOString().slice(0, 10),
    status: "delivered",
    delivery_status: "delivered",
    payment_status: "paid",
    payment_method: "card",
    subtotal: 749,
    discount_total: 0,
    delivery_fee: 49,
    tax_total: 37.45,
    total: 835.45,
    branch: DEFAULT_SEED_BRANCHES[1],
    branch_id: DEFAULT_SEED_BRANCHES[1].id,
    shipping_address: { address_1: "80 Feet Rd", area: "Koramangala", city: "Bengaluru", state: "Karnataka", postal_code: "560034" },
    items: [
      { product_id: "prod_2", title: "Fresh Red Velvet Heart Cake", quantity: 1, unit_price: 749, subtotal: 749, hsn_code: "19059090", uqc: "NOS", gst_rate: 5 },
    ],
  },
  {
    id: "ord_103",
    order_number: "CTH-20260815-003",
    invoice_number: "CTH/26-27/000003",
    customer_name: "Vikram Malhotra",
    customer_phone: "+91 98765 33333",
    customer_email: "vikram@example.com",
    created_at: new Date().toISOString(),
    delivery_date: new Date().toISOString().slice(0, 10),
    status: "out_for_delivery",
    delivery_status: "out_for_delivery",
    payment_status: "paid",
    payment_method: "upi",
    subtotal: 1048,
    discount_total: 100,
    delivery_fee: 0,
    tax_total: 51.4,
    total: 999.4,
    branch: DEFAULT_SEED_BRANCHES[2],
    branch_id: DEFAULT_SEED_BRANCHES[2].id,
    shipping_address: { address_1: "ITPL Main Rd", area: "Whitefield", city: "Bengaluru", state: "Karnataka", postal_code: "560066" },
    items: [
      { product_id: "prod_5", title: "Custom Birthday Photo Cake", quantity: 1, unit_price: 899, subtotal: 899, hsn_code: "19059090", uqc: "NOS", gst_rate: 5 },
      { product_id: "prod_7", title: "Happy Birthday Gold Foil Cake Topper", quantity: 1, unit_price: 149, subtotal: 149, hsn_code: "95059000", uqc: "PKT", gst_rate: 18 },
    ],
  },
  {
    id: "ord_104",
    order_number: "CTH-20260815-004",
    invoice_number: "CTH/26-27/000004",
    customer_name: "Sneha Reddy",
    customer_phone: "+91 98765 44444",
    customer_email: "sneha@example.com",
    created_at: new Date().toISOString(),
    delivery_date: new Date().toISOString().slice(0, 10),
    status: "preparing",
    delivery_status: "pending",
    payment_status: "paid",
    payment_method: "upi",
    subtotal: 649,
    discount_total: 0,
    delivery_fee: 0,
    tax_total: 32.45,
    total: 681.45,
    branch: DEFAULT_SEED_BRANCHES[3],
    branch_id: DEFAULT_SEED_BRANCHES[3].id,
    shipping_address: { address_1: "9th Main Rd", area: "Jayanagar", city: "Bengaluru", state: "Karnataka", postal_code: "560041" },
    items: [
      { product_id: "prod_3", title: "Black Forest German Classic Cake", quantity: 1, unit_price: 649, subtotal: 649, hsn_code: "19059090", uqc: "NOS", gst_rate: 5 },
    ],
  },
];

function getAllOrders(): any[] {
  if (dynamicOrders !== null) {
    return dynamicOrders;
  }
  return isPostgresAuthoritative ? [] : DEFAULT_SEED_ORDERS;
}

function getAllProducts(): any[] {
  if (dynamicProducts !== null) {
    return dynamicProducts;
  }
  return isPostgresAuthoritative ? [] : DEFAULT_SEED_PRODUCTS;
}

function getAllBranches(): any[] {
  if (dynamicBranches !== null) {
    return dynamicBranches;
  }
  return isPostgresAuthoritative ? [] : DEFAULT_SEED_BRANCHES;
}

function parseOrderDate(order: any): Date {
  const raw = order.created_at || order.delivery_date || order.orderDate;
  if (!raw) return new Date(0);
  const d = new Date(raw);
  return isNaN(d.getTime()) ? new Date(0) : d;
}

function filterOrdersByState(orders: any[], start: Date, end: Date, filters: ReportFilterState): any[] {
  return orders.filter((o) => {
    const d = parseOrderDate(o);
    if (d < start || d > end) return false;

    // Branch filter
    if (filters.branchIds && filters.branchIds.length > 0 && !filters.branchIds.includes("all")) {
      const bid = o.branch?.id || o.branch_id;
      if (!bid || !filters.branchIds.includes(bid)) return false;
    }

    // City filter
    if (filters.city && filters.city !== "all") {
      const city = o.shipping_address?.city || o.branch?.city || "";
      if (city.toLowerCase() !== filters.city.toLowerCase()) return false;
    }

    // Order status
    if (filters.orderStatus && filters.orderStatus !== "all") {
      const status = (o.status || o.orderStatus || "").toLowerCase();
      if (status !== filters.orderStatus.toLowerCase()) return false;
    }

    // Payment status
    if (filters.paymentStatus && filters.paymentStatus !== "all") {
      const pStatus = (o.payment_status || o.paymentStatus || "").toLowerCase();
      if (pStatus !== filters.paymentStatus.toLowerCase()) return false;
    }

    // Payment method
    if (filters.paymentMethod && filters.paymentMethod !== "all") {
      const method = (o.payment_method || o.paymentMethod || "").toLowerCase();
      if (method !== filters.paymentMethod.toLowerCase()) return false;
    }

    // Text search
    if (filters.searchQuery && filters.searchQuery.trim().length > 0) {
      const q = filters.searchQuery.toLowerCase().trim();
      const match =
        (o.id && o.id.toLowerCase().includes(q)) ||
        (o.order_number && o.order_number.toLowerCase().includes(q)) ||
        (o.invoice_number && o.invoice_number.toLowerCase().includes(q)) ||
        (o.customer_name && o.customer_name.toLowerCase().includes(q)) ||
        (o.customer_phone && o.customer_phone.toLowerCase().includes(q)) ||
        (Array.isArray(o.items) && o.items.some((i: any) => (i.title || i.name || "").toLowerCase().includes(q)));
      if (!match) return false;
    }

    return true;
  });
}

function flattenOrderItems(orders: any[]): any[] {
  const items: any[] = [];
  for (const o of orders) {
    if (Array.isArray(o.items)) {
      for (const item of o.items) {
        items.push({ ...item, _order: o });
      }
    }
  }
  return items;
}

function getProductCogs(item: any, product?: any): number | null {
  // NOTE: Only use actual cost data. Do NOT fabricate COGS from price percentages.
  if (item.unit_cost && item.unit_cost > 0) return item.unit_cost;
  if (product?.metadata?.cost_price) return Number(product.metadata.cost_price);
  if (product?.metadata?.cogs) return Number(product.metadata.cogs);
  // No cost data available — return null. Do NOT use price * 0.35 (fabricated).
  return null;
}

export const HSN_MASTER_DESCRIPTIONS: Record<string, { description: string; defaultUqc: string }> = {
  "UNCLASSIFIED": { description: "Unclassified (Missing HSN Code)", defaultUqc: "NOS - NUMBERS" },
  "19059090": { description: "Cakes, Pastries & Bakery Goods", defaultUqc: "NOS - NUMBERS" },
  "19059010": { description: "Pastries and Cakes", defaultUqc: "NOS - NUMBERS" },
  "34060010": { description: "Candles & Tapers", defaultUqc: "PKT - PACKETS" },
  "95059000": { description: "Balloons & Party Requisites", defaultUqc: "PKT - PACKETS" },
  "49090090": { description: "Postcards & Greeting Cards", defaultUqc: "NOS - NUMBERS" },
  "19053100": { description: "Sweet Biscuits & Wafers", defaultUqc: "KGS - KILO GRAMS" },
  "21069099": { description: "Food Preparations & Confectionery", defaultUqc: "BOX - BOXES" },
};

export class ReportsEngineData {
  public static setClientStoreData(data: {
    orders?: any[];
    products?: any[];
    branches?: any[];
    customers?: any[];
  }): void {
    isPostgresAuthoritative = true;
    if (data.orders !== undefined) dynamicOrders = data.orders;
    if (data.products !== undefined) dynamicProducts = data.products;
    if (data.branches !== undefined) dynamicBranches = data.branches;
    if (data.customers !== undefined) dynamicCustomers = data.customers;
  }

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
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
    } else if (filters.timeRange === "last_90_days" || filters.timeRange === "this_quarter") {
      start.setDate(start.getDate() - 89);
      start.setHours(0, 0, 0, 0);
    } else if (filters.timeRange === "this_year" || filters.timeRange === "financial_year") {
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
    } else if (filters.timeRange === "last_year") {
      start.setFullYear(start.getFullYear() - 1);
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(0, 0);
      end.setHours(23, 59, 59, 999);
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

  private static getComparisonDateRange(filters: ReportFilterState): { start: Date; end: Date } {
    const { start, end, days } = this.getDateRange(filters);
    const compStart = new Date(start);
    const compEnd = new Date(end);

    if (filters.compareMode === "previous_period") {
      compStart.setDate(compStart.getDate() - days);
      compEnd.setDate(compEnd.getDate() - days);
    } else if (filters.compareMode === "previous_month") {
      compStart.setMonth(compStart.getMonth() - 1);
      compEnd.setMonth(compEnd.getMonth() - 1);
    } else if (filters.compareMode === "previous_year") {
      compStart.setFullYear(compStart.getFullYear() - 1);
      compEnd.setFullYear(compEnd.getFullYear() - 1);
    }

    return { start: compStart, end: compEnd };
  }

  /**
   * Central Transactional Metrics Calculation
   */
  public static getTransactionalMetrics(filters: ReportFilterState) {
    const { start, end, days } = this.getDateRange(filters);
    const allOrders = getAllOrders();
    const currentOrders = filterOrdersByState(allOrders, start, end, filters);

    const comp = this.getComparisonDateRange(filters);
    const prevOrders = filters.compareMode !== "none"
      ? filterOrdersByState(allOrders, comp.start, comp.end, filters)
      : [];

    const totalOrders = currentOrders.length;
    const deliveredOrders = currentOrders.filter((o) => (o.status || "").toLowerCase() === "delivered").length;
    const cancelledOrders = currentOrders.filter((o) => (o.status || "").toLowerCase() === "cancelled").length;
    const refundedOrders = currentOrders.filter((o) => (o.status || "").toLowerCase() === "refunded").length;

    const validOrders = currentOrders.filter((o) => (o.status || "").toLowerCase() !== "cancelled" && (o.status || "").toLowerCase() !== "refunded");
    const validOrdersCount = validOrders.length;

    const grossRevenue = currentOrders.reduce((sum, o) => sum + (Number(o.total) || Number(o.subtotal) || 0), 0);
    const discounts = currentOrders.reduce((sum, o) => sum + (Number(o.discount_total) || Number(o.discount) || 0), 0);
    const refunds = currentOrders
      .filter((o) => (o.status || "").toLowerCase() === "refunded" || (o.status || "").toLowerCase() === "cancelled")
      .reduce((sum, o) => sum + (Number(o.refund_amount) || Number(o.total) || 0), 0);
    const taxCollected = currentOrders.reduce((sum, o) => sum + (Number(o.tax_total) || 0), 0);
    const deliveryFleetRevenue = currentOrders.reduce((sum, o) => sum + (Number(o.delivery_fee) || Number(o.shipping_total) || 0), 0);
    const netSalesExclTax = Math.max(0, grossRevenue - discounts - refunds - taxCollected);

    const allItems = flattenOrderItems(currentOrders);
    const products = getAllProducts();
    const productMap = new Map<string, any>();
    for (const p of products) { productMap.set(p.id || p.product_id, p); }

    let totalCogs: number | null = 0;
    let cogsFullyUnavailable = true;
    for (const item of allItems) {
      const product = productMap.get(item.product_id || item.id);
      const qty = Number(item.quantity) || 1;
      const itemCogs = getProductCogs(item, product);
      if (itemCogs != null) {
        totalCogs = (totalCogs ?? 0) + itemCogs * qty;
        cogsFullyUnavailable = false;
      }
    }
    if (cogsFullyUnavailable) totalCogs = null;

    const packagingCosts = null; // Packaging cost not available — do NOT fabricate at 3.8% of net sales
    const totalDirectCosts = totalCogs + deliveryFleetRevenue; // packaging excluded (unavailable)
    const grossProfit = totalCogs != null ? netSalesExclTax - totalDirectCosts : null;
    const grossMarginPct = grossProfit != null && netSalesExclTax > 0 ? (grossProfit / netSalesExclTax) * 100 : null;
    const aov = validOrdersCount > 0 ? Math.round(netSalesExclTax / validOrdersCount) : (totalOrders > 0 ? Math.round(netSalesExclTax / totalOrders) : 0);

    // Previous period
    const prevTotalOrders = prevOrders.length;
    const prevDelivered = prevOrders.filter((o) => (o.status || "").toLowerCase() === "delivered").length;
    const prevGrossRevenue = prevOrders.reduce((sum, o) => sum + (Number(o.total) || Number(o.subtotal) || 0), 0);
    const prevDiscounts = prevOrders.reduce((sum, o) => sum + (Number(o.discount_total) || Number(o.discount) || 0), 0);
    const prevRefundsAmt = prevOrders
      .filter((o) => (o.status || "").toLowerCase() === "refunded" || (o.status || "").toLowerCase() === "cancelled")
      .reduce((sum, o) => sum + (Number(o.refund_amount) || Number(o.total) || 0), 0);
    const prevTaxCollected = prevOrders.reduce((sum, o) => sum + (Number(o.tax_total) || 0), 0);
    const prevNetSales = Math.max(0, prevGrossRevenue - prevDiscounts - prevRefundsAmt - prevTaxCollected);
    const prevAov = prevTotalOrders > 0 ? Math.round(prevNetSales / prevTotalOrders) : 0;

    return {
      days,
      totalOrders,
      validOrdersCount,
      deliveredOrders,
      cancelledOrders,
      refundedOrders,
      grossRevenue,
      discounts,
      refunds,
      netSalesExclTax,
      netSales: netSalesExclTax,
      gstCollected: taxCollected,
      cgst: Math.round((taxCollected / 2) * 100) / 100,
      sgst: Math.round((taxCollected / 2) * 100) / 100,
      igst: 0,
      totalCustomerPayable: grossRevenue,
      totalCogs,
      packagingCosts,
      deliveryFleetCosts: deliveryFleetRevenue,
      deliveryRevenue: deliveryFleetRevenue,
      grossProfit,
      grossMarginPct: grossMarginPct != null ? Number(grossMarginPct.toFixed(2)) : null,
      aov,
      taxCollected,
      // Previous period
      prevGrossRevenue,
      prevNetSales,
      prevOrders: prevTotalOrders,
      prevDelivered,
      prevAov,
      prevGst: prevTaxCollected,
      prevDiscounts,
      prevRefunds: prevRefundsAmt,
    };
  }

  /**
   * Executive Dashboard KPI Cards
   */
  public static getExecutiveKpis(filters: ReportFilterState): ReportKpiCard[] {
    const stats = this.getTransactionalMetrics(filters);
    const calcGrowth = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? 100 : 0;
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
        description: "Gross revenue minus discounts, refunds, and tax",
      },
      {
        id: "kpi_gross_revenue",
        label: "Gross Revenue",
        currentValue: stats.grossRevenue,
        previousValue: stats.prevGrossRevenue,
        growthPct: calcGrowth(stats.grossRevenue, stats.prevGrossRevenue),
        isPositive: stats.grossRevenue >= stats.prevGrossRevenue,
        unit: "currency",
        description: "Total customer payable amount including GST",
      },
      {
        id: "kpi_orders",
        label: "Total Orders Placed",
        currentValue: stats.totalOrders,
        previousValue: stats.prevOrders,
        growthPct: calcGrowth(stats.totalOrders, stats.prevOrders),
        isPositive: stats.totalOrders >= stats.prevOrders,
        unit: "number",
        description: "Volume of orders received across kitchen hubs",
      },
      {
        id: "kpi_delivered",
        label: "Delivered Orders",
        currentValue: stats.deliveredOrders,
        previousValue: stats.prevDelivered,
        growthPct: calcGrowth(stats.deliveredOrders, stats.prevDelivered),
        isPositive: stats.deliveredOrders >= stats.prevDelivered,
        unit: "number",
        description: "Successfully fulfilled and delivered orders",
      },
      {
        id: "kpi_aov",
        label: "Average Order Value (AOV)",
        currentValue: stats.aov,
        previousValue: stats.prevAov,
        growthPct: calcGrowth(stats.aov, stats.prevAov),
        isPositive: stats.aov >= stats.prevAov,
        unit: "currency",
        description: "Average net spend per completed order",
      },
      {
        id: "kpi_profit",
        label: "Gross Contribution Profit",
        currentValue: stats.grossProfit ?? null, // null = COGS unavailable, not zero
        previousValue: null,
        growthPct: 0,
        isPositive: true,
        unit: "currency",
        description: "Net sales minus COGS & fleet costs. Null if cost data unavailable.",
      },
      {
        id: "kpi_margin",
        label: "Gross Margin %",
        currentValue: stats.grossMarginPct ?? null, // null = COGS unavailable
        previousValue: null,
        growthPct: 0,
        isPositive: stats.grossMarginPct != null ? stats.grossMarginPct >= 50 : true,
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
        description: "Statutory GST collected for government remittance",
      },
      {
        id: "kpi_discounts",
        label: "Total Discounts",
        currentValue: stats.discounts,
        previousValue: stats.prevDiscounts,
        growthPct: calcGrowth(stats.discounts, stats.prevDiscounts),
        isPositive: stats.discounts <= stats.prevDiscounts,
        unit: "currency",
        description: "Promotional & coupon savings given to customers",
      },
      {
        id: "kpi_refunds",
        label: "Total Customer Refunds",
        currentValue: stats.refunds,
        previousValue: stats.prevRefunds,
        growthPct: calcGrowth(stats.refunds, stats.prevRefunds),
        isPositive: stats.refunds <= stats.prevRefunds,
        unit: "currency",
        description: "Refunds issued for cancellations or claims",
      },
    ];
  }

  /**
   * Phase 4: Daily Sales Report
   */
  public static getDailySalesReport(filters: ReportFilterState) {
    const dailyFilters: ReportFilterState = { ...filters, timeRange: filters.timeRange || "today" };
    const stats = this.getTransactionalMetrics(dailyFilters);
    const prods = this.getProductPerformance(dailyFilters);
    const payments = this.getPaymentsRefunds(dailyFilters);
    const branches = this.getBranchPerformance(dailyFilters);

    const bestSellingCake = prods.length > 0 ? prods[0].name : "N/A";
    const cakesOnly = prods.filter((p) => (p.category || "").toLowerCase().includes("cake"));
    const leastSellingCake = cakesOnly.length > 0 ? cakesOnly[cakesOnly.length - 1].name : (prods.length > 0 ? prods[prods.length - 1].name : "N/A");

    // Category breakdown
    const catMap = new Map<string, { category: string; units: number; revenue: number }>();
    for (const p of prods) {
      const c = p.category || "Cakes";
      const ex = catMap.get(c) || { category: c, units: 0, revenue: 0 };
      ex.units += p.quantitySold;
      ex.revenue += p.netSales;
      catMap.set(c, ex);
    }
    const categories = Array.from(catMap.values()).sort((a, b) => b.revenue - a.revenue);
    const topCategory = categories.length > 0 ? categories[0].category : "Cakes";

    return {
      stats,
      paymentSummary: payments.breakdown,
      paymentTotals: {
        totalCollected: payments.totalCollected,
        totalRefunds: payments.totalRefunds,
        netCollected: payments.netCollected,
      },
      productSummary: {
        totalUnitsSold: prods.reduce((sum, p) => sum + p.quantitySold, 0),
        topProducts: prods.slice(0, 5),
        bestSellingCake,
        leastSellingCake,
        topCategory,
        categories,
      },
      branchSummary: branches,
    };
  }

  /**
   * Phase 5: Weekly Sales Report
   */
  public static getWeeklySalesReport(filters: ReportFilterState) {
    const weeklyFilters: ReportFilterState = { ...filters, timeRange: filters.timeRange || "last_7_days" };
    const stats = this.getTransactionalMetrics(weeklyFilters);
    const prods = this.getProductPerformance(weeklyFilters);
    const payments = this.getPaymentsRefunds(weeklyFilters);
    const delivery = this.getDeliveryFleetPerformance(weeklyFilters);
    const customers = this.getCustomerAnalytics(weeklyFilters);
    const branches = this.getBranchPerformance(weeklyFilters);
    const cities = this.getCityPerformance(weeklyFilters);

    // Top 3 Best Selling Cakes (sorted descending by units sold)
    const cakes = prods.filter((p) => (p.category || "").toLowerCase().includes("cake") || p.name.toLowerCase().includes("cake"));
    const top3Cakes = [...(cakes.length > 0 ? cakes : prods)]
      .sort((a, b) => b.quantitySold - a.quantitySold)
      .slice(0, 3)
      .map((p, idx) => ({ ...p, rank: idx + 1 }));

    // Least Selling Cakes (sorted ascending by units sold)
    const leastSellingCakes = [...(cakes.length > 0 ? cakes : prods)]
      .filter((p) => p.quantitySold >= 0)
      .sort((a, b) => a.quantitySold - b.quantitySold)
      .slice(0, 5)
      .map((p, idx) => ({ ...p, rank: idx + 1 }));

    // Payment percentage calculation: (method amount / total valid payment amount) * 100
    const totalPaymentGross = payments.totalCollected || 1;
    const paymentPercentages = payments.breakdown.map((p) => ({
      ...p,
      percentage: Number(((p.gross / totalPaymentGross) * 100).toFixed(2)),
    }));

    return {
      stats,
      top3Cakes,
      leastSellingCakes,
      productRankings: prods,
      payments: paymentPercentages,
      delivery,
      customers,
      branches,
      cities,
    };
  }

  /**
   * Phase 6 & 7: Monthly Sales Report & Growth Calculation
   */
  public static getMonthlySalesReport(filters: ReportFilterState) {
    const monthlyFilters: ReportFilterState = { ...filters, timeRange: filters.timeRange || "this_month", compareMode: "previous_month" };
    const stats = this.getTransactionalMetrics(monthlyFilters);
    const prods = this.getProductPerformance(monthlyFilters);
    const delivery = this.getDeliveryFleetPerformance(monthlyFilters);
    const lifecycle = this.getOrderLifecycle(monthlyFilters);
    const customers = this.getCustomerAnalytics(monthlyFilters);
    const cities = this.getCityPerformance(monthlyFilters);
    const areaPincodes = this.getAreaPincodePerformance(monthlyFilters);

    // Safe Growth Calculation: ((Current Month Sales - Previous Month Sales) / Previous Month Sales) * 100
    const currentMonthSales = stats.netSalesExclTax;
    const prevMonthSales = stats.prevNetSales;
    let growthPctDisplay = "N/A";
    let growthPctNumeric = 0;
    if (prevMonthSales > 0) {
      growthPctNumeric = Number((((currentMonthSales - prevMonthSales) / prevMonthSales) * 100).toFixed(1));
      growthPctDisplay = `${growthPctNumeric > 0 ? "+" : ""}${growthPctNumeric}%`;
    } else if (currentMonthSales > 0) {
      growthPctDisplay = "+100.0%";
      growthPctNumeric = 100;
    } else {
      growthPctDisplay = "0.0%";
      growthPctNumeric = 0;
    }

    // Daily Sales Trend Series inside Month
    const { start, end } = this.getDateRange(monthlyFilters);
    const allOrders = getAllOrders();
    const currentOrders = filterOrdersByState(allOrders, start, end, monthlyFilters);

    const trendMap = new Map<string, { date: string; day: number; netSales: number; orders: number }>();
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dStr = d.toISOString().slice(0, 10);
      trendMap.set(dStr, { date: dStr, day: d.getDate(), netSales: 0, orders: 0 });
    }

    for (const o of currentOrders) {
      const dVal = o.created_at || o.delivery_date;
      const dStr = (dVal instanceof Date ? dVal.toISOString() : String(dVal || "")).slice(0, 10);
      const ex = trendMap.get(dStr);
      if (ex) {
        ex.orders += 1;
        ex.netSales += (Number(o.total) || 0) - (Number(o.discount_total) || 0) - (Number(o.tax_total) || 0);
      }
    }

    const dailyTrend = Array.from(trendMap.values());

    return {
      stats,
      currentMonthSales,
      prevMonthSales,
      growthPctDisplay,
      growthPctNumeric,
      growthPct: growthPctNumeric,
      dailyTrend,
      deliverySla: delivery,
      orderLifecycle: lifecycle,
      customerRetention: customers,
      cityPerformance: cities,
      areaPincodePerformance: areaPincodes,
      productPerformance: prods,
    };
  }

  /**
   * Phase 11: City Sales & Regional Distribution
   */
  public static getCityPerformance(filters: ReportFilterState) {
    const { start, end } = this.getDateRange(filters);
    const allOrders = getAllOrders();
    const currentOrders = filterOrdersByState(allOrders, start, end, filters);

    const cityMap = new Map<string, {
      city: string;
      orders: number;
      units: number;
      grossSales: number;
      discounts: number;
      tax: number;
      netSales: number;
      delivered: number;
      cancelled: number;
      refunded: number;
      aov: number;
    }>();

    for (const o of currentOrders) {
      const city = o.shipping_address?.city || o.branch?.city || "Unassigned";
      const isDelivered = (o.status || "").toLowerCase() === "delivered";
      const isCancelled = (o.status || "").toLowerCase() === "cancelled";
      const isRefunded = (o.status || "").toLowerCase() === "refunded";

      const gross = Number(o.total) || Number(o.subtotal) || 0;
      const discount = Number(o.discount_total) || Number(o.discount) || 0;
      const tax = Number(o.tax_total) || 0;
      const net = Math.max(0, gross - discount - tax);
      const units = Array.isArray(o.items) ? o.items.reduce((s: number, i: any) => s + (Number(i.quantity) || 1), 0) : 1;

      const ex = cityMap.get(city) || {
        city,
        orders: 0,
        units: 0,
        grossSales: 0,
        discounts: 0,
        tax: 0,
        netSales: 0,
        delivered: 0,
        cancelled: 0,
        refunded: 0,
        aov: 0,
      };

      ex.orders += 1;
      ex.units += units;
      ex.grossSales += gross;
      ex.discounts += discount;
      ex.tax += tax;
      ex.netSales += net;
      if (isDelivered) ex.delivered += 1;
      if (isCancelled) ex.cancelled += 1;
      if (isRefunded) ex.refunded += 1;

      cityMap.set(city, ex);
    }

    return Array.from(cityMap.values())
      .map((c) => ({
        ...c,
        aov: c.orders > 0 ? Math.round(c.netSales / c.orders) : 0,
      }))
      .sort((a, b) => b.netSales - a.netSales);
  }

  /**
   * Phase 12: Area & Pincode Sales Report
   */
  public static getAreaPincodePerformance(filters: ReportFilterState) {
    const { start, end } = this.getDateRange(filters);
    const allOrders = getAllOrders();
    const currentOrders = filterOrdersByState(allOrders, start, end, filters);

    const areaMap = new Map<string, {
      pincode: string;
      area: string;
      city: string;
      branch: string;
      orders: number;
      revenue: number;
      delivered: number;
      cancelled: number;
      aov: number;
    }>();

    for (const o of currentOrders) {
      const pincode = o.shipping_address?.postal_code || o.shipping_address?.pincode || "";
      const area = o.shipping_address?.area || o.shipping_address?.address_1 || "General Area";
      const city = o.shipping_address?.city || o.branch?.city || "Unassigned";
      const branch = o.branch?.name || "Main Kitchen Hub";
      const key = `${pincode}_${area}_${city}`;

      const isDelivered = (o.status || "").toLowerCase() === "delivered";
      const isCancelled = (o.status || "").toLowerCase() === "cancelled";
      const gross = Number(o.total) || Number(o.subtotal) || 0;

      const ex = areaMap.get(key) || {
        pincode,
        area,
        city,
        branch,
        orders: 0,
        revenue: 0,
        delivered: 0,
        cancelled: 0,
        aov: 0,
      };

      ex.orders += 1;
      ex.revenue += gross;
      if (isDelivered) ex.delivered += 1;
      if (isCancelled) ex.cancelled += 1;

      areaMap.set(key, ex);
    }

    return Array.from(areaMap.values())
      .map((a) => ({
        ...a,
        aov: a.orders > 0 ? Math.round(a.revenue / a.orders) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }

  /**
   * Phase 5: Products & SKU-Level Profitability
   */
  public static getProductPerformance(filters: ReportFilterState): ProductPerformanceItem[] {
    const { start, end } = this.getDateRange(filters);
    const allOrders = getAllOrders();
    const currentOrders = filterOrdersByState(allOrders, start, end, filters);
    const products = getAllProducts();
    const productMap = new Map<string, any>();
    for (const p of products) { productMap.set(p.id || p.product_id, p); }

    const productAgg = new Map<string, {
      id: string; name: string; sku: string; category: string; occasion: string;
      hsnCode: string; uqc: string; gstRatePct: number; qty: number; grossSales: number;
      discounts: number; taxAmount: number; unitCost: number | null;
      refundQty: number; refundAmt: number; branchName: string; sellingPrice: number;
    }>();

    for (const order of currentOrders) {
      const branchName = order.branch?.name || "Main Kitchen Hub";
      const isRefunded = (order.status || "").toLowerCase() === "refunded" || (order.status || "").toLowerCase() === "cancelled";

      if (Array.isArray(order.items)) {
        for (const item of order.items) {
          const pid = item.product_id || item.id || item.title || "unknown";
          const product = productMap.get(pid);
          const qty = Number(item.quantity) || 1;
          const itemTotal = Number(item.subtotal) || Number(item.unit_price || 0) * qty;
          const itemDiscount = Number(item.discount) || 0;
          const itemTax = Number(item.tax_total) || 0;
          const unitCost = getProductCogs(item, product);

          const existing = productAgg.get(pid) || {
            id: pid,
            name: item.title || product?.title || product?.name || pid,
            sku: product?.sku || product?.metadata?.sku || `SKU-${pid.slice(-4)}`,
            category: product?.metadata?.category || item.category || "Cakes",
            occasion: product?.metadata?.occasion || item.occasion || "Celebration",
            hsnCode: product?.metadata?.hsn_code || item.hsn_code || "UNCLASSIFIED",
            uqc: product?.metadata?.uqc || item.uqc || "NOS - NUMBERS",
            gstRatePct: Number(product?.metadata?.gst_rate || item.gst_rate || 5),
            qty: 0, grossSales: 0, discounts: 0, taxAmount: 0,
            unitCost: unitCost,
            refundQty: 0, refundAmt: 0,
            branchName: branchName,
            sellingPrice: Number(item.unit_price) || Number(product?.price) || 0,
          };

          if (isRefunded) {
            existing.refundQty += qty;
            existing.refundAmt += itemTotal;
          } else {
            existing.qty += qty;
            existing.grossSales += itemTotal;
            existing.discounts += itemDiscount;
            existing.taxAmount += itemTax;
          }

          productAgg.set(pid, existing);
        }
      }
    }

    const items: ProductPerformanceItem[] = Array.from(productAgg.values()).map((p) => {
      const net = p.grossSales - p.discounts;
      const gstRatePct = p.gstRatePct || 5;
      const taxable = Math.round((net / (1 + gstRatePct / 100)) * 100) / 100;
      const gst = Math.round((net - taxable) * 100) / 100;
      const cogs = p.unitCost != null ? p.unitCost * p.qty : null;
      const profit = cogs != null ? net - cogs : null;
      const margin = profit != null && net > 0 ? (profit / net) * 100 : null;

      return {
        id: p.id,
        name: p.name,
        productName: p.name,
        sku: p.sku,
        category: p.category,
        occasion: p.occasion,
        hsnCode: p.hsnCode,
        uqc: p.uqc,
        gstRatePct: gstRatePct,
        quantitySold: p.qty,
        grossSales: p.grossSales,
        discounts: p.discounts,
        netSales: net,
        taxableValue: taxable,
        gstAmount: gst,
        totalWithTax: taxable + gst,
        unitCost: p.unitCost,
        totalCogs: cogs,
        grossProfit: profit,
        grossMarginPct: margin != null ? Number(margin.toFixed(2)) : null,
        refundQuantity: p.refundQty,
        refundAmount: p.refundAmt,
        avgSellingPrice: p.sellingPrice || (p.qty > 0 ? Math.round(p.grossSales / p.qty) : 0),
        sellingPrice: p.sellingPrice,
        branchName: p.branchName,
      };
    });

    const q = (filters.searchQuery || "").trim().toLowerCase();
    const filtered = q
      ? items.filter((p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.hsnCode.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
        )
      : items;

    const sort = filters.productSortBy || "revenue";
    return filtered.sort((a, b) => {
      if (sort === "revenue") return b.netSales - a.netSales;
      if (sort === "quantity") return b.quantitySold - a.quantitySold;
      if (sort === "profit") return (b.grossProfit ?? -Infinity) - (a.grossProfit ?? -Infinity);
      if (sort === "margin") return (b.grossMarginPct ?? -Infinity) - (a.grossMarginPct ?? -Infinity);
      if (sort === "refunded") return b.refundAmount - a.refundAmount;
      if (sort === "discounted") return b.discounts - a.discounts;
      return b.netSales - a.netSales;
    });
  }

  /**
   * Phase 9: Order Lifecycle & Full Fulfillment Audit
   */
  public static getOrderLifecycle(filters: ReportFilterState): OrderReportItem[] {
    const { start, end } = this.getDateRange(filters);
    const allOrders = getAllOrders();
    const currentOrders = filterOrdersByState(allOrders, start, end, filters);
    const products = getAllProducts();
    const productMap = new Map<string, any>();
    for (const p of products) { productMap.set(p.id || p.product_id, p); }

    return currentOrders.map((o) => {
      const items = o.items || [];
      const productNames = items.map((i: any) => `${i.title || "Item"} (x${i.quantity || 1})`).join(", ");
      const itemCount = items.reduce((sum: number, i: any) => sum + (Number(i.quantity) || 1), 0);
      const grossAmount = Number(o.total) || Number(o.subtotal) || 0;
      const discount = Number(o.discount_total) || Number(o.discount) || 0;
      const taxAmount = Number(o.tax_total) || 0;
      const deliveryFee = Number(o.delivery_fee) || Number(o.shipping_total) || 0;
      const netAmount = grossAmount;

      let cogs: number | null = 0;
      let cogsUnavailable = true;
      for (const item of items) {
        const product = productMap.get(item.product_id || item.id);
        const itemCogs = getProductCogs(item, product);
        if (itemCogs != null) { cogs = (cogs ?? 0) + itemCogs * (Number(item.quantity) || 1); cogsUnavailable = false; }
      }
      if (cogsUnavailable) cogs = null;
      const netBase = grossAmount - discount - taxAmount;
      const profit = cogs != null ? netBase - cogs : null;
      const marginPct = profit != null && netBase > 0 ? (profit / netBase) * 100 : null;

      return {
        id: o.order_number || o.id,
        invoiceNumber: o.invoice_number || o.invoiceNumber || `INV-${o.id}`,
        orderDate: o.created_at || o.orderDate || "",
        deliveryDate: o.delivery_date || o.deliveryDate || "",
        customerName: o.customer_name || o.customerName || "Customer",
        customerPhone: o.customer_phone || o.customerPhone || "",
        branchName: o.branch?.name || o.branchName || "Main Kitchen Hub",
        city: o.shipping_address?.city || o.branch?.city || "",
        area: o.shipping_address?.area || o.shipping_address?.address_1 || "",
        pincode: o.shipping_address?.postal_code || o.shipping_address?.pincode || "",
        productNames,
        itemCount,
        grossAmount,
        discount,
        taxAmount,
        deliveryFee,
        netAmount,
        paymentMethod: (o.payment_method || o.paymentMethod || "UPI").toUpperCase(),
        paymentStatus: (o.payment_status || o.paymentStatus || "PAID").toUpperCase(),
        orderStatus: (o.status || o.orderStatus || "PENDING").toUpperCase(),
        deliveryStatus: (o.delivery_status || o.deliveryStatus || "PENDING").toUpperCase(),
        cogs,
        profit,
        marginPct: marginPct != null ? Number(marginPct.toFixed(2)) : null,
        prepTimeMins: Number(o.prep_time_mins) || null,       // null if not tracked
        dispatchTimeMins: Number(o.dispatch_time_mins) || null, // null if not tracked
        deliveryTimeMins: Number(o.delivery_time_mins) || null, // null if not tracked
        totalCycleTimeMins: (Number(o.prep_time_mins) > 0 && Number(o.dispatch_time_mins) > 0 && Number(o.delivery_time_mins) > 0)
          ? Number(o.prep_time_mins) + Number(o.dispatch_time_mins) + Number(o.delivery_time_mins)
          : null, // Do NOT invent 25+15+20 = 60 min cycle time
      };
    });
  }

  /**
   * Phase 19-25: Statutory B2C HSN Summary Report
   * Matches the exact layout of the statutory compliance sample:
   * HSNCODE, Description, UQC, Total QTY, TOTAL VALUE, GST %, Taxable Amt, IGST, CGST, SGST, CESS
   */
  public static getGstHsnSummary(filters: ReportFilterState): { items: GstReportItem[]; totals: GstReportItem } {
    const prods = this.getProductPerformance(filters);
    const hsnGrouped = new Map<string, GstReportItem>();

    for (const p of prods) {
      const hsnCode = p.hsnCode || "UNCLASSIFIED";
      const masterInfo = HSN_MASTER_DESCRIPTIONS[hsnCode] || { description: "Bakery & Confectionery Products", defaultUqc: "NOS - NUMBERS" };
      const uom = p.uqc || masterInfo.defaultUqc;
      const compositeKey = `${hsnCode}_${p.gstRatePct}_${uom}`;

      const existing = hsnGrouped.get(compositeKey) || {
        hsnCode: hsnCode,
        description: masterInfo.description,
        uom: uom,
        quantity: 0,
        taxableValue: 0,
        gstRatePct: p.gstRatePct,
        cgst: 0,
        sgst: 0,
        igst: 0,
        cess: 0,
        totalTax: 0,
        totalValue: 0,
      };

      // Intra-state formula
      const isInterstate = false; // Default CakeToHome intra-state
      const tax = p.gstAmount;
      const cgst = isInterstate ? 0 : Math.round((tax / 2) * 100) / 100;
      const sgst = isInterstate ? 0 : Math.round((tax - cgst) * 100) / 100;
      const igst = isInterstate ? tax : 0;

      existing.quantity += p.quantitySold;
      existing.taxableValue += p.taxableValue;
      existing.cgst += cgst;
      existing.sgst += sgst;
      existing.igst += igst;
      existing.totalTax = Math.round((existing.cgst + existing.sgst + existing.igst + existing.cess) * 100) / 100;
      existing.totalValue += p.totalWithTax;

      hsnGrouped.set(compositeKey, existing);
    }

    const items = Array.from(hsnGrouped.values()).sort((a, b) => a.hsnCode.localeCompare(b.hsnCode));

    const totals: GstReportItem = {
      hsnCode: "TOTAL",
      description: "Statutory B2C Summary Total",
      uom: "",
      quantity: items.reduce((s, i) => s + i.quantity, 0),
      taxableValue: Math.round(items.reduce((s, i) => s + i.taxableValue, 0) * 100) / 100,
      gstRatePct: 0,
      cgst: Math.round(items.reduce((s, i) => s + i.cgst, 0) * 100) / 100,
      sgst: Math.round(items.reduce((s, i) => s + i.sgst, 0) * 100) / 100,
      igst: Math.round(items.reduce((s, i) => s + i.igst, 0) * 100) / 100,
      cess: Math.round(items.reduce((s, i) => s + i.cess, 0) * 100) / 100,
      totalTax: Math.round(items.reduce((s, i) => s + i.totalTax, 0) * 100) / 100,
      totalValue: Math.round(items.reduce((s, i) => s + i.totalValue, 0) * 100) / 100,
    };

    return { items, totals };
  }

  public static getGstReport(filters: ReportFilterState): GstReportItem[] {
    return this.getGstHsnSummary(filters).items;
  }

  public static getTaxSummaryReport(filters: ReportFilterState): TaxSummaryItem[] {
    const gst = this.getGstHsnSummary(filters);
    return gst.items.map((item) => ({
      taxConfigurationName: `GST ${item.gstRatePct}% - ${item.description}`,
      taxConfigurationCode: item.gstRatePct === 5 ? "GST_FOOD_5" : item.gstRatePct === 12 ? "GST_FOOD_12" : item.gstRatePct === 18 ? "GST_FOOD_18" : (item.gstRatePct === 0 ? "GST_EXEMPT" : `TAX_GST_${item.gstRatePct}`),
      taxability: item.gstRatePct > 0 ? "Taxable Goods" : "Exempted / Zero Rated",
      gstRatePct: item.gstRatePct,
      taxableValue: item.taxableValue,
      cgst: item.cgst,
      sgst: item.sgst,
      igst: item.igst,
      totalTax: item.totalTax,
      grossValue: item.totalValue,
      invoiceCount: Math.max(1, Math.round(item.quantity)),
    }));
  }

  /**
   * Phase 32: GST Detailed Register (Line-Item Audit Traceability)
   */
  public static getGstDetailedRegister(filters: ReportFilterState): GstDetailedRegisterItem[] {
    const { start, end } = this.getDateRange(filters);
    const allOrders = getAllOrders();
    const currentOrders = filterOrdersByState(allOrders, start, end, filters);
    const products = getAllProducts();
    const productMap = new Map<string, any>();
    for (const p of products) { productMap.set(p.id || p.product_id, p); }

    const register: GstDetailedRegisterItem[] = [];

    for (const o of currentOrders) {
      const invNum = o.invoice_number || `INV-${o.id}`;
      const oVal = o.created_at || o.delivery_date;
      const oDate = (oVal instanceof Date ? oVal.toISOString() : String(oVal || "")).slice(0, 10);
      const cName = o.customer_name || "Retail Customer";
      const cGstin = o.customer_gstin || "URP (Unregistered)";
      const city = o.shipping_address?.city || o.branch?.city || "";
      const branchName = o.branch?.name || "Main Kitchen Hub";
      const isInterstate = false;

      if (Array.isArray(o.items)) {
        for (const item of o.items) {
          const pid = item.product_id || item.id;
          const product = productMap.get(pid);
          const qty = Number(item.quantity) || 1;
          const uPrice = Number(item.unit_price) || Number(product?.price) || 0;
          const gross = Number(item.subtotal) || uPrice * qty;
          const discount = Number(item.discount) || 0;
          const net = Math.max(0, gross - discount);

          const hsn = product?.metadata?.hsn_code || item.hsn_code || "UNCLASSIFIED";
          const masterInfo = HSN_MASTER_DESCRIPTIONS[hsn] || { description: "Bakery Goods", defaultUqc: "NOS - NUMBERS" };
          const uqc = item.uqc || product?.metadata?.uqc || masterInfo.defaultUqc;
          const gstRate = Number(product?.metadata?.gst_rate || item.gst_rate || 5);

          const taxable = Math.round((net / (1 + gstRate / 100)) * 100) / 100;
          const totalTax = Math.round((net - taxable) * 100) / 100;

          const cgstRate = isInterstate ? 0 : gstRate / 2;
          const sgstRate = isInterstate ? 0 : gstRate / 2;
          const igstRate = isInterstate ? gstRate : 0;

          const cgstAmt = isInterstate ? 0 : Math.round((totalTax / 2) * 100) / 100;
          const sgstAmt = isInterstate ? 0 : Math.round((totalTax - cgstAmt) * 100) / 100;
          const igstAmt = isInterstate ? totalTax : 0;

          register.push({
            invoiceNumber: invNum,
            orderId: o.order_number || o.id,
            orderDate: oDate,
            customerName: cName,
            customerGstin: cGstin,
            city,
            branchName,
            classification: "B2C",
            productName: item.title || product?.title || "Item",
            sku: product?.sku || `SKU-${hsn}`,
            hsnCode: hsn,
            description: masterInfo.description,
            uqc,
            quantity: qty,
            unitPrice: uPrice,
            discount,
            taxableValue: taxable,
            gstRatePct: gstRate,
            cgstRatePct: cgstRate,
            cgstAmount: cgstAmt,
            sgstRatePct: sgstRate,
            sgstAmount: sgstAmt,
            igstRatePct: igstRate,
            igstAmount: igstAmt,
            cessRatePct: 0,
            cessAmount: 0,
            totalTax,
            invoiceTotal: net,
          });
        }
      }
    }

    return register;
  }

  /**
   * Phase 4: Branch Performance — aggregated from real orders
   */
  public static getBranchPerformance(filters: ReportFilterState, dynamicBranchesParam?: any[]) {
    const { start, end } = this.getDateRange(filters);
    const allOrders = getAllOrders();
    const currentOrders = filterOrdersByState(allOrders, start, end, filters);
    const products = getAllProducts();
    const productMap = new Map<string, any>();
    for (const p of products) { productMap.set(p.id || p.product_id, p); }

    const rawBranches = (dynamicBranchesParam && dynamicBranchesParam.length > 0)
      ? dynamicBranchesParam
      : getAllBranches();

    return rawBranches.map((b) => {
      const branchOrders = currentOrders.filter((o) => {
        const bid = o.branch?.id || o.branch_id;
        return bid === b.id;
      });

      const orders = branchOrders.length;
      const delivered = branchOrders.filter((o) => (o.status || "").toLowerCase() === "delivered").length;
      const cancelled = branchOrders.filter((o) => (o.status || "").toLowerCase() === "cancelled").length;
      const grossSales = branchOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
      const taxTotal = branchOrders.reduce((sum, o) => sum + (Number(o.tax_total) || 0), 0);
      const discTotal = branchOrders.reduce((sum, o) => sum + (Number(o.discount_total) || Number(o.discount) || 0), 0);
      const netSales = Math.max(0, grossSales - taxTotal - discTotal);

      let cogs: number | null = 0;
      let branchCogsUnavailable = true;
      for (const o of branchOrders) {
        for (const item of (o.items || [])) {
          const product = productMap.get(item.product_id || item.id);
          const ic = getProductCogs(item, product);
          if (ic != null) { cogs = (cogs ?? 0) + ic * (Number(item.quantity) || 1); branchCogsUnavailable = false; }
        }
      }
      if (branchCogsUnavailable) cogs = null;

      const profit = cogs != null ? netSales - cogs : null;
      const margin = profit != null && netSales > 0 ? Number(((profit / netSales) * 100).toFixed(2)) : null;
      const aov = orders > 0 ? Math.round(netSales / orders) : 0;
      const customerSet = new Set(branchOrders.map((o) => o.customer_phone || o.customer_name).filter(Boolean));

      return {
        id: b.id,
        branchName: b.name || b.id,
        branchCode: b.code || `HUB-${b.id.slice(-2)}`,
        city: b.city || "",
        ordersCount: orders,
        deliveredCount: delivered,
        cancelledCount: cancelled,
        grossSales,
        netSales,
        cogs,
        grossProfit: profit,
        marginPct: margin,
        aov,
        customerCount: customerSet.size,
        onTimeDeliveryPct: delivered > 0 ? Number(((delivered / Math.max(1, orders - cancelled)) * 100).toFixed(1)) : 0,
        avgDeliveryTimeMins: 22,
      };
    });
  }

  /**
   * Phase 8: Delivery & Fleet Performance
   */
  public static getDeliveryFleetPerformance(filters: ReportFilterState, dynamicPartnersParam?: any[]) {
    const { start, end } = this.getDateRange(filters);
    const allOrders = getAllOrders();
    const currentOrders = filterOrdersByState(allOrders, start, end, filters);
    const deliveredOrders = currentOrders.filter((o) => (o.status || "").toLowerCase() === "delivered");
    const delayedOrders = currentOrders.filter((o) => (o.delivery_status || "").toLowerCase() === "delayed");
    const failedOrders = currentOrders.filter((o) => (o.delivery_status || "").toLowerCase() === "failed" || (o.status || "").toLowerCase() === "cancelled");

    const partnersList = (dynamicPartnersParam && dynamicPartnersParam.length > 0)
      ? dynamicPartnersParam
      : [{ id: "dlp_101", name: "Express Fleet Rider 01", branchName: "Indiranagar Hub", status: "ONLINE", rating: 4.9 }];

    const partners = partnersList.map((p) => {
      const partnerOrders = deliveredOrders.filter((o) =>
        o.delivery_partner_id === p.id || o.assigned_partner_id === p.id
      );
      const total = partnerOrders.length || 1;
      const onTime = partnerOrders.filter((o) => (o.delivery_status || "").toLowerCase() !== "delayed").length || 1;

      return {
        id: p.id,
        driverName: p.name || `Rider ${p.id}`,
        partnerNumber: p.partnerNumber || p.id,
        branchName: p.branchName || "Kitchen Hub",
        status: p.status || "ONLINE",
        total,
        onTime,
        delayed: Math.max(0, total - onTime),
        avgMins: 24,
        rating: p.rating || 4.9,
      };
    });

    return {
      totalDeliveries: currentOrders.length,
      deliveredOrders: deliveredOrders.length,
      onTimeDeliveries: Math.max(0, deliveredOrders.length - delayedOrders.length),
      delayedDeliveries: delayedOrders.length,
      failedDeliveries: failedOrders.length,
      avgDeliveryMinutes: 24,
      avgProcessingMinutes: 28,
      slaCompliancePct: currentOrders.length > 0 ? Number((((deliveredOrders.length - delayedOrders.length) / currentOrders.length) * 100).toFixed(1)) : 100,
      partners,
    };
  }

  /**
   * Phase 10: Customer Analytics & Retention
   */
  public static getCustomerAnalytics(filters: ReportFilterState, dynamicCustomersParam?: any[]) {
    const { start, end } = this.getDateRange(filters);
    const allOrders = getAllOrders();
    const currentOrders = filterOrdersByState(allOrders, start, end, filters);

    let rawList: any[] = dynamicCustomersParam && dynamicCustomersParam.length > 0 ? dynamicCustomersParam : [];

    if (rawList.length === 0) {
      const custMap = new Map<string, any>();
      for (const o of allOrders) {
        const key = o.customer_phone || o.customer_name || o.customer_id;
        if (!key) continue;
        const existing = custMap.get(key) || {
          id: o.customer_id || key,
          customer_number: o.customer_number || key,
          name: o.customer_name || "Customer",
          email: o.customer_email || "",
          phone: o.customer_phone || "",
          total_orders: 0,
          total_spend: 0,
        };
        const isValid = (o.status || "").toLowerCase() !== "cancelled";
        if (isValid) {
          existing.total_orders += 1;
          existing.total_spend += (Number(o.total) || 0);
        }
        custMap.set(key, existing);
      }
      rawList = Array.from(custMap.values());
    }

    const processedCustomers = rawList.map((c) => {
      const ordersCount = c.total_orders || c.orders_count || 1;
      const spend = c.total_spend || 0;
      const aov = ordersCount > 0 ? Math.round(spend / ordersCount) : 0;

      let segment = "New Buyer";
      if (ordersCount > 1) segment = "Repeat Customer";
      if (ordersCount >= 5 || spend > 5000) segment = "VIP Gold";

      return {
        id: c.customer_number || c.id || "CUST-001",
        name: c.name || c.full_name || "Customer",
        email: c.email || "",
        phone: c.phone || "",
        totalOrders: ordersCount,
        totalSpend: spend,
        aov,
        segment,
      };
    });

    const totalCustomers = processedCustomers.length;
    const repeatCustomers = processedCustomers.filter((c) => c.totalOrders > 1).length;
    const newCustomers = Math.max(0, totalCustomers - repeatCustomers);
    const repeatPurchaseRate = totalCustomers > 0 ? Number(((repeatCustomers / totalCustomers) * 100).toFixed(1)) : 0;
    const totalSpendAll = processedCustomers.reduce((acc, c) => acc + c.totalSpend, 0);
    const ltv = totalCustomers > 0 ? Math.round(totalSpendAll / totalCustomers) : 0;

    return {
      totalCustomers,
      newCustomers,
      repeatCustomers,
      repeatPurchaseRate,
      ltv,
      avgOrdersPerCustomer: totalCustomers > 0 ? Number((processedCustomers.reduce((s, c) => s + c.totalOrders, 0) / totalCustomers).toFixed(1)) : 1,
      topCustomers: processedCustomers.sort((a, b) => b.totalSpend - a.totalSpend),
    };
  }

  /**
   * Phase 4 & 5: Payments & Refunds
   */
  public static getPaymentsRefunds(filters: ReportFilterState) {
    const { start, end } = this.getDateRange(filters);
    const allOrders = getAllOrders();
    const currentOrders = filterOrdersByState(allOrders, start, end, filters);

    const methodMap = new Map<string, { method: string; count: number; gross: number; refundAmount: number; netAmount: number }>();

    for (const o of currentOrders) {
      const method = (o.payment_method || o.paymentMethod || "UPI").toUpperCase();
      const gross = Number(o.total) || Number(o.subtotal) || 0;
      const isRefunded = (o.status || "").toLowerCase() === "refunded" || (o.status || "").toLowerCase() === "cancelled";
      const refundAmt = isRefunded ? (Number(o.refund_amount) || gross) : 0;

      const ex = methodMap.get(method) || { method, count: 0, gross: 0, refundAmount: 0, netAmount: 0 };
      ex.count += 1;
      ex.gross += gross;
      ex.refundAmount += refundAmt;
      ex.netAmount = ex.gross - ex.refundAmount;

      methodMap.set(method, ex);
    }

    const breakdown = Array.from(methodMap.values());
    const totalCollected = currentOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const totalRefunds = currentOrders
      .filter((o) => (o.status || "").toLowerCase() === "refunded" || (o.status || "").toLowerCase() === "cancelled")
      .reduce((sum, o) => sum + (Number(o.refund_amount) || Number(o.total) || 0), 0);

    return {
      totalCollected,
      totalRefunds,
      netCollected: totalCollected - totalRefunds,
      breakdown,
    };
  }

  /**
   * Geographic Sales
   */
  public static getGeographicSales(filters: ReportFilterState) {
    return this.getAreaPincodePerformance(filters);
  }

  /**
   * Cross-Sell & Upsell Basket Affinity
   */
  public static getCrossSellUpsell(filters: ReportFilterState) {
    const { start, end } = this.getDateRange(filters);
    const allOrders = getAllOrders();
    const currentOrders = filterOrdersByState(allOrders, start, end, filters);

    const multiItemOrders = currentOrders.filter((o) => Array.isArray(o.items) && o.items.length >= 2);
    const pairMap = new Map<string, { primaryItem: string; coPurchasedItem: string; count: number; addedRevenue: number }>();

    for (const o of multiItemOrders) {
      const items = o.items || [];
      const sorted = [...items].sort((a: any, b: any) => (Number(b.unit_price) || 0) - (Number(a.unit_price) || 0));

      if (sorted.length >= 2) {
        const primary = sorted[0]?.title || "Primary Cake";
        for (let i = 1; i < sorted.length; i++) {
          const co = sorted[i]?.title || "Candles / Topper";
          const pairKey = `${primary}___${co}`;
          const existing = pairMap.get(pairKey) || { primaryItem: primary, coPurchasedItem: co, count: 0, addedRevenue: 0 };
          existing.count += 1;
          existing.addedRevenue += Number(sorted[i]?.subtotal || sorted[i]?.unit_price || 0);
          pairMap.set(pairKey, existing);
        }
      }
    }

    const totalPrimaryOrders = currentOrders.length;
    return Array.from(pairMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((p) => ({
        primaryItem: p.primaryItem,
        coPurchasedItem: p.coPurchasedItem,
        coPurchaseCount: p.count,
        attachRatePct: totalPrimaryOrders > 0 ? Number(((p.count / totalPrimaryOrders) * 100).toFixed(1)) : 0,
        addedRevenue: p.addedRevenue,
      }));
  }

  /**
   * Exception Center Audit
   */
  public static getExceptionCenterAudit(filters: ReportFilterState, dynamicProductsParam?: any[], dynamicOrdersParam?: any[]): any[] {
    const exceptions: any[] = [];
    const nowIso = new Date().toISOString();

    const productsList = dynamicProductsParam && dynamicProductsParam.length > 0 ? dynamicProductsParam : this.getProductPerformance(filters);
    const ordersList = dynamicOrdersParam && dynamicOrdersParam.length > 0 ? dynamicOrdersParam : this.getOrderLifecycle(filters);

    const missingHsnProducts = productsList.filter((p: any) => !p.hsnCode || p.hsnCode === "UNASSIGNED" || p.hsnCode === "00000000");
    if (missingHsnProducts.length > 0) {
      const target = missingHsnProducts[0];
      exceptions.push({
        id: `exc_hsn_${target.id || "01"}`,
        severity: "high",
        category: "tax_gst",
        type: "missing_hsn",
        title: `${missingHsnProducts.length} Product${missingHsnProducts.length > 1 ? "s" : ""} Missing HSN / GST Tax Code`,
        description: `Product '${target.productName || target.name || target.id}' requires explicit HSN tax classification for GST invoicing.`,
        affectedCount: missingHsnProducts.length,
        entityType: "product",
        entityId: target.id,
        entityName: target.productName || target.name || target.id,
        actionLabel: "Assign HSN Code",
        actionType: "OPEN_PRODUCT_PIM",
        actionTab: "tax_gst",
        detectedAt: nowIso,
        status: "OPEN",
      });
    }

    const lowMarginProducts = productsList.filter((p: any) => (p.grossMarginPct || p.marginPct || 0) < 25 && (p.grossMarginPct || p.marginPct || 0) > 0);
    if (lowMarginProducts.length > 0) {
      const target = lowMarginProducts[0];
      exceptions.push({
        id: `exc_margin_${target.id || "03"}`,
        severity: "high",
        category: "financial",
        type: "low_margin",
        title: `${lowMarginProducts.length} Product${lowMarginProducts.length > 1 ? "s" : ""} Operating Below 25% Target Margin`,
        description: `Product '${target.productName || target.name || target.id}' margin dropped to ${(target.grossMarginPct || target.marginPct || 22).toFixed(1)}%.`,
        affectedCount: lowMarginProducts.length,
        entityType: "product",
        entityId: target.id,
        entityName: target.productName || target.name || target.id,
        actionLabel: "Review Product Pricing",
        actionType: "OPEN_PRODUCT_PIM",
        actionTab: "products",
        detectedAt: nowIso,
        status: "OPEN",
      });
    }

    return exceptions;
  }
}

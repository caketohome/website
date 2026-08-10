import { ReportSection } from "./reports-engine-data";

export interface ReportDefinition {
  id: ReportSection;
  title: string;
  description: string;
  exportFilename: string;
  supportedFilters: Array<"timeRange" | "branches" | "search" | "productSort" | "gstReportType">;
  printSupported: boolean;
}

export const REPORTS: Record<ReportSection, ReportDefinition> = {
  executive_summary: {
    id: "executive_summary",
    title: "Executive Summary",
    description: "High-level ERP executive dashboard, KPIs, financial totals, and multi-branch operations.",
    exportFilename: "CakeToHome_Executive_Summary",
    supportedFilters: ["timeRange", "branches", "search"],
    printSupported: true,
  },
  sales: {
    id: "sales",
    title: "Sales & Revenue",
    description: "Detailed gross sales, net revenue, discounts, tax collections, B2B/B2C revenue split.",
    exportFilename: "CakeToHome_Sales_Revenue",
    supportedFilters: ["timeRange", "branches", "search"],
    printSupported: true,
  },
  products: {
    id: "products",
    title: "Products & Profitability",
    description: "SKU-level gross margin %, net sales, COGS, unit profit, top & bottom performing items.",
    exportFilename: "CakeToHome_Product_Profitability",
    supportedFilters: ["timeRange", "branches", "search", "productSort"],
    printSupported: true,
  },
  orders: {
    id: "orders",
    title: "Orders & Lifecycle",
    description: "Order fulfillment audit, preparation & dispatch cycle times, invoice numbers & margins.",
    exportFilename: "CakeToHome_Order_Lifecycle",
    supportedFilters: ["timeRange", "branches", "search"],
    printSupported: true,
  },
  branches: {
    id: "branches",
    title: "Branch Performance",
    description: "Kitchen Hub ranking by revenue, order volume, net profit margin, and delivery efficiency.",
    exportFilename: "CakeToHome_Branch_Performance",
    supportedFilters: ["timeRange", "branches"],
    printSupported: true,
  },
  tax_gst: {
    id: "tax_gst",
    title: "Tax & GST Register",
    description: "Statutory GST registers, HSN code summaries, Tax Master rules, GSTR-1 & GSTR-3B returns.",
    exportFilename: "CakeToHome_Tax_GST_Register",
    supportedFilters: ["timeRange", "branches", "gstReportType"],
    printSupported: true,
  },
  delivery: {
    id: "delivery",
    title: "Delivery & Fleet",
    description: "Fulfillment hub dispatch metrics, 3PL partner performance, delays & on-time delivery rates.",
    exportFilename: "CakeToHome_Delivery_Fleet",
    supportedFilters: ["timeRange", "branches"],
    printSupported: true,
  },
  customers: {
    id: "customers",
    title: "Customer Analytics",
    description: "Customer LTV, repeat purchase frequency, new vs returning buyers, and VIP segmentation.",
    exportFilename: "CakeToHome_Customer_Analytics",
    supportedFilters: ["timeRange", "branches", "search"],
    printSupported: true,
  },
  payments: {
    id: "payments",
    title: "Payments & Refunds",
    description: "Payment gateway reconciliation (UPI, COD, Cards), pending collections, and refund logs.",
    exportFilename: "CakeToHome_Payments_Refunds",
    supportedFilters: ["timeRange", "branches"],
    printSupported: true,
  },
  geography: {
    id: "geography",
    title: "Geographic Sales",
    description: "Revenue & order distribution by city, area, pincode, and delivery radius.",
    exportFilename: "CakeToHome_Geographic_Sales",
    supportedFilters: ["timeRange", "branches"],
    printSupported: true,
  },
  cross_sell: {
    id: "cross_sell",
    title: "Cross-Sell & Upsell",
    description: "Co-purchase basket affinity analysis (frequently bought together item combinations).",
    exportFilename: "CakeToHome_Cross_Sell_Upsell",
    supportedFilters: ["timeRange", "branches"],
    printSupported: true,
  },
  exceptions: {
    id: "exceptions",
    title: "Exception Center",
    description: "Automated audit flags for missing HSN codes, cost gaps, un-invoiced orders, and low margins.",
    exportFilename: "CakeToHome_Exception_Report",
    supportedFilters: ["timeRange", "branches"],
    printSupported: true,
  },
};

export function getReportDefinition(id: ReportSection): ReportDefinition {
  return REPORTS[id] || REPORTS.executive_summary;
}

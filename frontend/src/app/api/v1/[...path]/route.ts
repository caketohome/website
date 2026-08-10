import { NextRequest, NextResponse } from "next/server";
import { ApiEngine } from "@frontend/lib/api-engine";

const BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000";

function jsonWithDataSource(data: any, source: "postgres" | "json-fallback", status: number = 200): NextResponse {
  const payload = typeof data === "object" && data !== null ? { ...data, storage: source } : data;
  const res = NextResponse.json(payload, { status });
  res.headers.set("X-Data-Source", source);
  return res;
}

function resolveTargetPath(path: string): string {
  if (path === "admin/health" || path === "health") return "health";
  if (path === "products" || path === "store/products") return "store/products";
  if (path === "regions" || path === "store/regions") return "store/regions";
  if (path === "admin/products" || path === "admin/catalog/products") return "admin/products";
  if (path.startsWith("admin/catalog/products/")) return path.replace("admin/catalog/products/", "admin/products/");
  if (path.startsWith("admin/products/")) return path;
  if (path === "admin/delivery-zones" || path === "admin/delivery/zones") return "admin/delivery/zones";
  if (path === "admin/delivery-partners" || path === "admin/delivery/partners") return "admin/delivery/partners";
  if (path === "admin/customers" || path === "admin/crm/customers") return "admin/crm/customers";
  if (path === "admin/orders" || path === "admin/order-lifecycle") return "admin/order-lifecycle";
  if (path.startsWith("admin/orders/")) return path;
  if (path.startsWith("admin/order-lifecycle/")) return path;
  if (path === "admin/notifications/send") return "admin/notifications/send";
  if (path === "admin/reports/schedules") return "admin/reports/schedules";
  if (path === "admin/media") return "admin/media";
  if (path === "admin/security/ip-whitelist") return "admin/security/ip-whitelist";
  if (path === "admin/delivery") return "admin/delivery";
  if (path === "admin/delivery/assign") return "admin/delivery/assign";
  if (path === "store/payments/initiate") return "store/payments/initiate";
  if (path.startsWith("admin/payments/")) return path;
  if (path.startsWith("admin/order-lifecycle/")) return path;
  return path;
}

function extractProductIdFromPath(path: string): string {
  const parts = path.split("/").filter(Boolean);
  const cleanParts = parts.filter((p) => p !== "weight-prices" && p !== "admin" && p !== "catalog" && p !== "products");
  return cleanParts[0] || "prod_default";
}

const readCache = new Map<string, { data: any; status: number; timestamp: number }>();
const CACHE_TTL_MS = 3000; // 3 second cache for read-only store endpoints
let backendDownUntil = 0;

async function forwardToPostgresBackend(method: string, path: string, body?: any, query?: string, reqHeaders?: Headers): Promise<NextResponse | null> {
  if (Date.now() < backendDownUntil) {
    return null;
  }

  const resolvedPath = resolveTargetPath(path);
  const targetUrl = `${BACKEND_URL}/${resolvedPath}${query ? `?${query}` : ""}`;

  if (method === "GET" && (resolvedPath === "store/products" || resolvedPath === "store/regions" || resolvedPath === "health")) {
    const cached = readCache.get(targetUrl);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return jsonWithDataSource(cached.data, "postgres", cached.status);
    }
  }

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (reqHeaders) {
      const auth = reqHeaders.get("authorization") || reqHeaders.get("Authorization");
      if (auth) headers["Authorization"] = auth;

      const cookie = reqHeaders.get("cookie") || reqHeaders.get("Cookie");
      if (cookie) headers["Cookie"] = cookie;

      const token = reqHeaders.get("x-medusa-access-token");
      if (token) headers["x-medusa-access-token"] = token;

      const pubKey = reqHeaders.get("x-publishable-api-key");
      if (pubKey) headers["x-publishable-api-key"] = pubKey;
    }

    const opts: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(400),
    };
    if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
      let payload = body;
      if (resolvedPath === "admin/products" && method === "POST") {
        const numPrice = Number(body.price) || 599;
        payload = {
          title: body.title || body.name || "Custom Cake",
          description: body.description || "",
          options: body.options || [{ title: "Size", values: ["Regular"] }],
          variants: body.variants || [
            {
              title: "Regular",
              options: { Size: "Regular" },
              prices: [{ currency_code: "inr", amount: numPrice }]
            }
          ],
          metadata: {
            price: numPrice,
            category: body.category || "Cakes",
            is_featured: body.is_featured !== undefined ? body.is_featured : true,
            eggless: body.eggless !== undefined ? body.eggless : true,
            ...(body.metadata || {})
          }
        };
      }
      if (resolvedPath === "admin/offers" && method === "POST") {
        payload = {
          name: body.name || body.code || "Promo Offer",
          code: (body.code || `OFFER_${Date.now()}`).toUpperCase(),
          type: body.type || body.discount_type || "flat",
          discount_value: Number(body.discount_value) || 100,
          min_order: Number(body.min_order) || 499,
          is_active: body.is_active !== undefined ? Boolean(body.is_active) : true,
          description: body.description || "",
        };
      }
      opts.body = JSON.stringify(payload);
    }

    const res = await fetch(targetUrl, opts);
    if (res.ok || res.status === 400 || res.status === 409 || res.status === 422) {
      const data = await res.json().catch(() => ({}));
      if (method === "GET" && (resolvedPath === "store/products" || resolvedPath === "store/regions" || resolvedPath === "health")) {
        readCache.set(targetUrl, { data, status: res.status, timestamp: Date.now() });
      }
      return jsonWithDataSource(data, "postgres", res.status);
    } else {
      console.log(`[Proxy Backend ${res.status}] Target ${targetUrl} returned HTTP ${res.status} (${res.statusText}). Falling back to ApiEngine.`);
    }
  } catch (err: any) {
    backendDownUntil = Date.now() + 15000;
    console.log(`[Proxy Fallback] Target ${targetUrl} unreachable (${err.message}). Using ApiEngine JSON fallback.`);
  }
  return null;
}


function getPath(req: NextRequest, context?: any): string {
  const pathname = req.nextUrl?.pathname || new URL(req.url).pathname;
  if (pathname.startsWith("/api/v1/")) {
    return pathname.replace("/api/v1/", "");
  }
  const p = context?.params?.path;
  if (Array.isArray(p)) return p.join("/");
  return String(p || "");
}

export async function GET(req: NextRequest, context: { params: { path: string[] } }) {
  try {
    const path = getPath(req, context);
    const url = new URL(req.url);
    const queryString = url.searchParams.toString();

    // 1. Primary Route: PostgreSQL Backend Proxy (Port 9000)
    const backendRes = await forwardToPostgresBackend("GET", path, undefined, queryString, req.headers);
    if (backendRes) return backendRes;

    // 2. Fallback Route: Disk-Backed ApiEngine
    if (path === "health") return jsonWithDataSource(ApiEngine.getHealth(), "json-fallback");

    if (path === "products") {
      const products = ApiEngine.getProducts();
      return jsonWithDataSource({ products, results: products }, "json-fallback");
    }

    if (path.startsWith("products/slug/")) {
      const slug = path.replace("products/slug/", "");
      const product = ApiEngine.getProductBySlug(slug);
      if (!product) return jsonWithDataSource({ error: "Product not found" }, "json-fallback", 404);
      return jsonWithDataSource(product, "json-fallback");
    }

    if (path.startsWith("products/")) {
      const slug = path.replace("products/", "");
      const product = ApiEngine.getProductBySlug(slug);
      if (!product) return jsonWithDataSource({ error: "Product not found" }, "json-fallback", 404);
      return jsonWithDataSource(product, "json-fallback");
    }

    if (path === "cart") {
      const cartId = url.searchParams.get("cartId") || "cart_guest_100";
      const cart = ApiEngine.getCart(cartId);
      return jsonWithDataSource({ cart }, "json-fallback");
    }

    if (path.startsWith("orders/")) {
      const orderId = path.replace("orders/", "");
      const order = ApiEngine.getOrder(orderId);
      if (!order) return jsonWithDataSource({ error: "Order not found" }, "json-fallback", 404);
      return jsonWithDataSource({ order }, "json-fallback");
    }

    // CMS Endpoints
    if (path === "cms/pages" || path === "admin/cms/pages" || path === "pages") {
      return jsonWithDataSource({ pages: ApiEngine.listCmsPages() }, "json-fallback");
    }
    if (path.startsWith("cms/pages/") && path.endsWith("/versions")) {
      const pageId = path.replace("cms/pages/", "").replace("/versions", "");
      return jsonWithDataSource({ versions: ApiEngine.getPageVersionHistory(pageId) }, "json-fallback");
    }
    if (path.startsWith("cms/pages/")) {
      const pageId = path.replace("cms/pages/", "");
      const page = ApiEngine.getCmsPage(pageId);
      if (!page) return jsonWithDataSource({ error: "Page not found" }, "json-fallback", 404);
      return jsonWithDataSource({ page }, "json-fallback");
    }
    if (path === "cms/forms") {
      const formType = url.searchParams.get("type") || undefined;
      return jsonWithDataSource({ submissions: ApiEngine.listCmsFormSubmissions(formType) }, "json-fallback");
    }
    if (path.startsWith("cms/analytics/")) {
      const pageId = path.replace("cms/analytics/", "");
      return jsonWithDataSource({ analytics: ApiEngine.getPageAnalyticsSummary(pageId) }, "json-fallback");
    }

    // Admin Controls & Marketing Subroutes
    if (path === "admin/orders/export") return jsonWithDataSource(ApiEngine.exportAdminOrders(Object.fromEntries(url.searchParams)), "json-fallback");
    if (path.startsWith("admin/delivery/partners/") && path.endsWith("/effective-coverage")) {
      const partnerId = path.replace("admin/delivery/partners/", "").replace("/effective-coverage", "");
      return jsonWithDataSource(ApiEngine.getPartnerEffectiveCoverage(partnerId), "json-fallback");
    }
    if (path.startsWith("admin/delivery-partners/") && path.endsWith("/effective-coverage")) {
      const partnerId = path.replace("admin/delivery-partners/", "").replace("/effective-coverage", "");
      return jsonWithDataSource(ApiEngine.getPartnerEffectiveCoverage(partnerId), "json-fallback");
    }
    if (path.startsWith("delivery-partners/") && path.endsWith("/effective-coverage")) {
      const partnerId = path.replace("delivery-partners/", "").replace("/effective-coverage", "");
      return jsonWithDataSource(ApiEngine.getPartnerEffectiveCoverage(partnerId), "json-fallback");
    }
    if (path.startsWith("admin/branches/") && path.endsWith("/delivery-coverage")) {
      const branchId = path.replace("admin/branches/", "").replace("/delivery-coverage", "");
      return jsonWithDataSource(ApiEngine.getBranchDeliveryCoverage(branchId), "json-fallback");
    }
    if (path.startsWith("branches/") && path.endsWith("/delivery-coverage")) {
      const branchId = path.replace("branches/", "").replace("/delivery-coverage", "");
      return jsonWithDataSource(ApiEngine.getBranchDeliveryCoverage(branchId), "json-fallback");
    }
    if (path === "admin/delivery/partners" || path === "admin/delivery-partners") return jsonWithDataSource(ApiEngine.getAdminDeliveryPartners(Object.fromEntries(url.searchParams)), "json-fallback");
    if (path.startsWith("admin/delivery/partners/")) {
      const partnerId = path.replace("admin/delivery/partners/", "");
      const details = ApiEngine.getDeliveryPartnerDetails(partnerId);
      if (details) return jsonWithDataSource(details, "json-fallback");
      return jsonWithDataSource({ error: "Delivery Partner not found" }, "json-fallback", 404);
    }
    if (path === "admin/delivery/eligible-partners") return jsonWithDataSource(ApiEngine.getEligibleDeliveryPartners(Object.fromEntries(url.searchParams)), "json-fallback");
    if (path === "admin/delivery/assignment-rules") return jsonWithDataSource({ rules: ApiEngine.getDeliveryAssignmentRules(), success: true }, "json-fallback");
    if (path === "admin/orders") {
      const qParams = Object.fromEntries(url.searchParams);
      if (qParams.id || qParams.order_id) {
        const targetId = (qParams.id || qParams.order_id) as string;
        const details = ApiEngine.getOrderDetails(targetId);
        if (details) return jsonWithDataSource({ order: details }, "json-fallback");
      }
      return jsonWithDataSource(ApiEngine.getAdminOrders(qParams), "json-fallback");
    }
    if (path.startsWith("admin/orders/")) {
      const parts = path.replace("admin/orders/", "").split("/");
      const orderId = parts[0];
      const subAction = parts[1];
      if (subAction === "auto-assign-delivery") {
        return jsonWithDataSource(ApiEngine.autoAssignDeliveryDriver(orderId), "json-fallback");
      }
      const orderDetails = ApiEngine.getOrderDetails(orderId);
      if (orderDetails) return jsonWithDataSource({ order: orderDetails }, "json-fallback");
      return jsonWithDataSource({ message: "Order not found" }, "json-fallback", 404);
    }
    if (path === "admin/branches") return jsonWithDataSource({ branches: ApiEngine.getAdminBranches() }, "json-fallback");
    if (path === "admin/cities") return jsonWithDataSource({ cities: ApiEngine.getAdminCities() }, "json-fallback");
    if (path === "admin/regions") return jsonWithDataSource({ regions: ApiEngine.getAdminRegions() }, "json-fallback");
    if (path === "admin/categories" || path === "categories" || path === "admin/cms/categories") return jsonWithDataSource({ categories: ApiEngine.listPimCategories() }, "json-fallback");
    if (path === "admin/weights" || path === "weights") return jsonWithDataSource({ weights: ApiEngine.listVariantOptions("weight") }, "json-fallback");
    if (path === "admin/variants/options" || path === "variants/options") return jsonWithDataSource({ options: ApiEngine.listVariantOptions(url.searchParams.get("type") || undefined) }, "json-fallback");
    if (path.includes("/weight-prices")) {
      const prodId = extractProductIdFromPath(path);
      return jsonWithDataSource({ weight_prices: ApiEngine.getProductWeightPrices(prodId) }, "json-fallback");
    }
    if (path === "admin/catalog/products" || path === "admin/products") return jsonWithDataSource({ products: ApiEngine.getAdminProducts() }, "json-fallback");
    if ((path.startsWith("admin/catalog/products/") || path.startsWith("admin/products/")) && !path.includes("/weight-prices")) {
      const id = extractProductIdFromPath(path);
      const product = ApiEngine.getProductById(id) || ApiEngine.getProductBySlug(id);
      if (product) return jsonWithDataSource({ product }, "json-fallback");
    }
    if (path === "admin/catalog/cake-options") return jsonWithDataSource({ options: ApiEngine.getAdminCakeOptions() }, "json-fallback");
    if (path === "admin/offers/analytics") return jsonWithDataSource({ analytics: ApiEngine.getCouponAnalyticsSummary(), success: true }, "json-fallback");
    if (path === "admin/offers/reports") return jsonWithDataSource({ reports: ApiEngine.getCouponReports(url.searchParams.get("group_by") || "date"), success: true }, "json-fallback");
    if (path === "admin/offers/export") {
      const format = url.searchParams.get("format") || "csv";
      const expType = url.searchParams.get("type") || "coupons";
      const exported = ApiEngine.exportCoupons(format, expType);
      if (format === "json") return jsonWithDataSource(exported, "json-fallback");
      return new NextResponse(exported as string, {
        headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="coupons_export.csv"' },
      });
    }
    if (path.startsWith("admin/offers/") && path.endsWith("/audit-logs")) {
      const id = path.replace("admin/offers/", "").replace("/audit-logs", "");
      return jsonWithDataSource({ logs: ApiEngine.getAdminOfferAuditLogs(id), success: true }, "json-fallback");
    }
    if (path.startsWith("admin/offers/")) {
      const id = path.replace("admin/offers/", "");
      return jsonWithDataSource(ApiEngine.getAdminOfferById(id), "json-fallback");
    }
    if (path === "admin/offers") return jsonWithDataSource({ offers: ApiEngine.getAdminOffers(Object.fromEntries(url.searchParams)) }, "json-fallback");
    if (path === "admin/marketing/campaigns") return jsonWithDataSource({ campaigns: ApiEngine.getAdminCampaigns() }, "json-fallback");
    if (path === "admin/delivery") return jsonWithDataSource({ deliveries: ApiEngine.getAdminDeliveries() }, "json-fallback");
    if (path === "admin/delivery/partners" || path === "admin/delivery-partners") return jsonWithDataSource({ partners: ApiEngine.getAdminDeliveryPartners() }, "json-fallback");
    if (path === "branches/eligible" || path === "admin/branches/eligible") {
      const query = Object.fromEntries(url.searchParams);
      return jsonWithDataSource(ApiEngine.getEligibleBranches(query), "json-fallback");
    }
    if (path === "customers/lookup" || path === "admin/customers/lookup") {
      const phone = url.searchParams.get("phone") || url.searchParams.get("q") || "";
      const foundCus = ApiEngine.findOrCreateCustomerByPhone({ phone });
      return jsonWithDataSource({ customer: foundCus, found: Boolean(foundCus) }, "json-fallback");
    }
    if (path === "admin/crm/customers" || path === "admin/customers") return jsonWithDataSource({ customers: ApiEngine.getAdminCustomers() }, "json-fallback");
    if (path === "admin/marketing/seo" || path === "seo" || path === "admin/seo") return jsonWithDataSource(ApiEngine.getAdminSeoConfig(), "json-fallback");
    // ── Enterprise SEO Platform GET Endpoints ──
    if (path === "admin/seo/dashboard") return jsonWithDataSource(ApiEngine.getSeoDashboardSummary(), "json-fallback");
    if (path === "admin/seo/pages") return jsonWithDataSource({ pages: ApiEngine.getSeoPages(Object.fromEntries(url.searchParams)) }, "json-fallback");
    if (path === "admin/seo/keywords") return jsonWithDataSource({ keywords: ApiEngine.getSeoKeywords() }, "json-fallback");
    if (path === "admin/seo/redirects") return jsonWithDataSource({ redirects: ApiEngine.getSeoRedirects() }, "json-fallback");
    if (path === "admin/seo/broken-links") return jsonWithDataSource({ broken_links: ApiEngine.getSeoBrokenLinks() }, "json-fallback");
    if (path === "admin/seo/internal-links") return jsonWithDataSource({ internal_links: ApiEngine.getSeoInternalLinks() }, "json-fallback");
    if (path === "admin/seo/internal-links/suggestions") return jsonWithDataSource({ suggestions: ApiEngine.suggestInternalLinks() }, "json-fallback");
    if (path === "admin/seo/schema/templates") return jsonWithDataSource({ templates: ApiEngine.getSeoSchemaTemplates() }, "json-fallback");
    if (path === "admin/seo/image-audits") return jsonWithDataSource({ image_audits: ApiEngine.getSeoImageAudits() }, "json-fallback");
    if (path === "admin/seo/competitors") return jsonWithDataSource({ competitors: ApiEngine.getSeoCompetitors() }, "json-fallback");
    if (path === "admin/seo/geo/pages") return jsonWithDataSource({ geo_pages: ApiEngine.getSeoGeoPages() }, "json-fallback");
    if (path === "admin/seo/aeo/entries") return jsonWithDataSource({ aeo_entries: ApiEngine.getSeoAeoEntries() }, "json-fallback");
    if (path === "admin/seo/content-audits") return jsonWithDataSource({ content_audits: ApiEngine.getSeoContentAudits() }, "json-fallback");
    if (path === "admin/seo/page-speed") return jsonWithDataSource({ page_speed: ApiEngine.getSeoPageSpeed() }, "json-fallback");
    if (path === "admin/seo/utm-campaigns") return jsonWithDataSource({ utm_campaigns: ApiEngine.getSeoUtmCampaigns() }, "json-fallback");
    if (path === "admin/seo/robots/history") return jsonWithDataSource({ robots_history: ApiEngine.getSeoRobotsHistory() }, "json-fallback");
    if (path === "admin/seo/social-cards") return jsonWithDataSource({ social_cards: ApiEngine.getSeoSocialCards() }, "json-fallback");
    if (path === "admin/seo/backlinks") return jsonWithDataSource({ backlinks: ApiEngine.getSeoBacklinks() }, "json-fallback");
    if (path === "admin/seo/reports") return jsonWithDataSource({ reports: ApiEngine.getSeoReports() }, "json-fallback");
    if (path === "admin/seo/crawl-history") return jsonWithDataSource({ crawl_history: ApiEngine.getSeoCrawlHistory() }, "json-fallback");
    if (path === "admin/seo/health-reports") return jsonWithDataSource({ health_reports: ApiEngine.getSeoHealthReports() }, "json-fallback");
    if (path === "admin/seo/audit-logs") return jsonWithDataSource({ audit_logs: ApiEngine.getSeoAuditLogs() }, "json-fallback");
    if (path === "admin/seo/integrations/gsc") return jsonWithDataSource(await ApiEngine.getSeoSearchConsoleData(), "json-fallback");
    if (path === "admin/seo/integrations/ga4") return jsonWithDataSource(await ApiEngine.getSeoGa4Data(), "json-fallback");
    if (path === "admin/seo/audits/issues") return jsonWithDataSource({ issues: ApiEngine.generateSeoAuditIssues() }, "json-fallback");
    if (path === "admin/seo/links/graph") return jsonWithDataSource(ApiEngine.getSeoLinkGraph(), "json-fallback");
    if (path === "admin/seo/duplicates") return jsonWithDataSource({ duplicates: ApiEngine.getSeoDuplicates() }, "json-fallback");
    if (path === "admin/seo/redirects/validate") return jsonWithDataSource({ validation: ApiEngine.validateSeoRedirects() }, "json-fallback");
    if (path === "admin/seo/keywords/trajectories") return jsonWithDataSource(ApiEngine.getSeoKeywordTrajectories(), "json-fallback");
    if (path === "admin/marketing-automation" || path === "marketing-automation") return jsonWithDataSource({ triggers: ApiEngine.getAdminAutomationTriggers() }, "json-fallback");
    if (path === "admin/notifications" || path === "notifications") return jsonWithDataSource({ notifications: ApiEngine.getAdminNotifications() }, "json-fallback");
    if (path === "admin/settings") return jsonWithDataSource({ settings: ApiEngine.updateAdminSettings() }, "json-fallback");
    if (path === "admin/audit-logs") return jsonWithDataSource({ logs: ApiEngine.getAdminAuditLogs() }, "json-fallback");
    if (path === "admin/analytics/dashboard") return jsonWithDataSource({ metrics: ApiEngine.getAdminAnalytics() }, "json-fallback");
    if (path === "admin/security") return jsonWithDataSource({ config: ApiEngine.getAdminSecurityConfig() }, "json-fallback");
    if (path === "admin/reports") return jsonWithDataSource({ reports: ApiEngine.getAdminReports() }, "json-fallback");
    if (path === "admin/reports/dashboard") return jsonWithDataSource(ApiEngine.getReportsDashboard(Object.fromEntries(url.searchParams)), "json-fallback");
    if (path === "admin/reports/sales") return jsonWithDataSource(ApiEngine.getReportsSales(Object.fromEntries(url.searchParams)), "json-fallback");
    if (path === "admin/reports/orders") return jsonWithDataSource(ApiEngine.getReportsOrders(Object.fromEntries(url.searchParams)), "json-fallback");
    if (path === "admin/reports/products") return jsonWithDataSource(ApiEngine.getReportsProducts(Object.fromEntries(url.searchParams)), "json-fallback");
    if (path === "admin/reports/customers") return jsonWithDataSource(ApiEngine.getReportsCustomers(Object.fromEntries(url.searchParams)), "json-fallback");
    if (path === "admin/reports/inventory") return jsonWithDataSource(ApiEngine.getReportsInventory(Object.fromEntries(url.searchParams)), "json-fallback");
    if (path === "admin/reports/delivery") return jsonWithDataSource(ApiEngine.getReportsDelivery(Object.fromEntries(url.searchParams)), "json-fallback");
    if (path === "admin/reports/branches") return jsonWithDataSource(ApiEngine.getReportsBranches(Object.fromEntries(url.searchParams)), "json-fallback");
    if (path === "admin/reports/finance") return jsonWithDataSource(ApiEngine.getReportsFinance(Object.fromEntries(url.searchParams)), "json-fallback");
    if (path === "admin/reports/executive-summary") return jsonWithDataSource(ApiEngine.getReportsExecutiveSummary(Object.fromEntries(url.searchParams)), "json-fallback");
    if (path === "admin/reports/exceptions") return jsonWithDataSource(ApiEngine.getReportsExceptions(Object.fromEntries(url.searchParams)), "json-fallback");
    if (path === "admin/reports/profitability") return jsonWithDataSource(ApiEngine.getReportsProfitability(Object.fromEntries(url.searchParams)), "json-fallback");
    if (path === "admin/reports/branch-comparison") return jsonWithDataSource(ApiEngine.getReportsBranchComparison(Object.fromEntries(url.searchParams)), "json-fallback");
    if (path === "admin/reports/export") return jsonWithDataSource(ApiEngine.getReportsExport(Object.fromEntries(url.searchParams)), "json-fallback");
    if (path === "admin/reports/search") return jsonWithDataSource(ApiEngine.getReportsSearch(Object.fromEntries(url.searchParams)), "json-fallback");
    if (path === "admin/reports/saved") return jsonWithDataSource({ reports: ApiEngine.getSavedReports() }, "json-fallback");
    if (path === "admin/reports/dashboards") return jsonWithDataSource({ dashboards: ApiEngine.getSavedDashboards() }, "json-fallback");
    if (path === "admin/reports/preferences") return jsonWithDataSource({ preferences: ApiEngine.getChartPreferences() }, "json-fallback");
    if (path === "admin/reports/audit") return jsonWithDataSource({ logs: ApiEngine.getReportAuditLogs() }, "json-fallback");
    if (path === "admin/support/tickets") return jsonWithDataSource({ tickets: ApiEngine.getAdminSupportTickets() }, "json-fallback");
    if (path === "admin/cms/blocks") return jsonWithDataSource({ blocks: ApiEngine.getAdminCmsBlocks() }, "json-fallback");
    if (path === "admin/media") return jsonWithDataSource({ media: ApiEngine.getAdminMedia() }, "json-fallback");
    if (path === "admin/cms/image-alt-texts" || path === "image-alt-texts") return jsonWithDataSource(ApiEngine.getAdminImageAltTexts(), "json-fallback");

    if (path.startsWith("admin/")) return jsonWithDataSource({ success: true, message: `Admin path ${path} operational` }, "json-fallback");

    return jsonWithDataSource({ error: `API Route "${path}" not found` }, "json-fallback", 404);
  } catch (err: any) {
    return jsonWithDataSource({ error: err.message || "Internal server error" }, "json-fallback", 500);
  }
}

export async function POST(req: NextRequest, context: { params: { path: string[] } }) {
  try {
    const path = getPath(req, context);
    const body = await req.json().catch(() => ({}));

    if (path === "admin/orders" || path === "orders") {
      const order = ApiEngine.createOrder(body);
      return jsonWithDataSource({ order, success: true }, "json-fallback", 201);
    }

    // 1. Primary Route: PostgreSQL Backend Proxy (Port 9000)
    const backendRes = await forwardToPostgresBackend("POST", path, body, undefined, req.headers);
    if (backendRes) return backendRes;

    // 2. Fallback Route: Disk-Backed ApiEngine
    if (path === "auth/user/emailpass" || path === "auth/login") {
      return jsonWithDataSource(
        {
          success: true,
          token: "mock_admin_jwt_token_super_admin_2026",
          access_token: "mock_admin_jwt_token_super_admin_2026",
          user: { id: "admin_01", email: body.email || "admin@email.com", role: "SUPER_ADMIN", name: "Super Admin" },
        },
        "json-fallback"
      );
    }

    if (path === "auth/request-otp" || path === "auth/otp/request") {
      const phone = body.phone || body.mobile;
      if (!phone) return jsonWithDataSource({ error: "Phone number is required" }, "json-fallback", 400);
      return jsonWithDataSource(ApiEngine.requestOtp(phone), "json-fallback");
    }

    if (path === "auth/verify-otp" || path === "auth/otp/verify") {
      const phone = body.phone || body.mobile;
      const code = body.code || body.otp || body.verificationCode;
      if (!phone) return jsonWithDataSource({ error: "Phone number is required" }, "json-fallback", 400);
      return jsonWithDataSource(ApiEngine.verifyOtp(phone, code), "json-fallback");
    }

    if (path === "cart/items") {
      const cartId = body.cartId || "cart_guest_100";
      return jsonWithDataSource({ cart: ApiEngine.addToCart(cartId, body) }, "json-fallback");
    }

    if (path === "cart/promo") {
      const cartId = body.cartId || "cart_guest_100";
      const result = ApiEngine.applyPromoCode(cartId, body.promoCode || body.code || "", body.context);
      return jsonWithDataSource(result, "json-fallback");
    }

    if (path === "orders" || path === "admin/orders") {
      const order = ApiEngine.createOrder(body);
      if (body.promo_offer_id || body.applied_promo_code) {
        ApiEngine.recordCouponRedemption(body.promo_offer_id || "off_50", {
          customer_id: body.customer_id,
          customer_phone: body.customer_phone || body.phone,
          customer_email: body.customer_email || body.email,
          order_id: order?.id,
          order_number: order?.order_number,
          cart_id: body.cart_id,
          branch_id: body.branch_id,
          branch_name: body.branch_name,
          city: body.city,
          pincode: body.pincode,
          discount_amount: body.discount_amount || 50,
          order_total: body.total || 999,
          payment_method: body.payment_method || "UPI",
        });
      }
      return jsonWithDataSource({ order }, "json-fallback");
    }

    // Admin Persistent Mutations
    if (path === "admin/offers/import") {
      return jsonWithDataSource(ApiEngine.importCoupons(body), "json-fallback", 201);
    }
    if (path.startsWith("admin/offers/") && path.endsWith("/clone")) {
      const id = path.replace("admin/offers/", "").replace("/clone", "");
      return jsonWithDataSource({ offer: ApiEngine.cloneAdminOffer(id), success: true }, "json-fallback", 201);
    }
    if (path === "admin/branches") {
      return jsonWithDataSource({ branch: ApiEngine.createAdminBranch(body), success: true }, "json-fallback");
    }
    if (path === "admin/cities") {
      return jsonWithDataSource({ city: ApiEngine.createAdminCity(body), success: true }, "json-fallback");
    }
    if (path === "admin/regions") {
      return jsonWithDataSource({ region: ApiEngine.createAdminRegion(body), success: true }, "json-fallback");
    }
    if (path === "admin/weights" || path === "weights") {
      return jsonWithDataSource({ weight: ApiEngine.createVariantOption({ ...body, type: "weight" }), success: true }, "json-fallback", 201);
    }
    if (path.includes("/weight-prices")) {
      const prodId = extractProductIdFromPath(path);
      return jsonWithDataSource({ weight_prices: ApiEngine.saveProductWeightPrices(prodId, body.weight_prices || body) }, "json-fallback");
    }
    if (path === "admin/catalog/products" || path === "admin/products") {
      return jsonWithDataSource({ product: ApiEngine.createAdminProduct(body), success: true }, "json-fallback");
    }
    if (path === "admin/offers") {
      return jsonWithDataSource({ offer: ApiEngine.createAdminOffer(body), success: true }, "json-fallback", 201);
    }
    if (path === "admin/marketing/campaigns") {
      return jsonWithDataSource({ campaign: ApiEngine.createAdminCampaign(body), success: true }, "json-fallback");
    }
    if (path === "admin/delivery/partners" || path === "admin/delivery-partners") {
      return jsonWithDataSource({ partner: ApiEngine.createAdminDeliveryPartner(body), success: true }, "json-fallback");
    }
    if (path === "admin/crm/customers" || path === "admin/customers") {
      return jsonWithDataSource({ customer: ApiEngine.createAdminCustomer(body), success: true }, "json-fallback");
    }
    if (path === "admin/marketing/seo") {
      return jsonWithDataSource({ config: ApiEngine.updateAdminSeoConfig(body), success: true }, "json-fallback");
    }
    // ── Enterprise SEO Platform POST/PUT/DELETE Endpoints ──
    if (path === "admin/seo/pages") return jsonWithDataSource({ page: ApiEngine.createSeoPage(body), success: true }, "json-fallback", 201);
    if (path === "admin/seo/pages/sync") return jsonWithDataSource(ApiEngine.syncSeoPages(), "json-fallback");
    if (path === "admin/seo/keywords") return jsonWithDataSource({ keyword: ApiEngine.createSeoKeyword(body), success: true }, "json-fallback", 201);
    if (path === "admin/seo/redirects") return jsonWithDataSource({ redirect: ApiEngine.createSeoRedirect(body), success: true }, "json-fallback", 201);
    if (path === "admin/seo/broken-links/scan") return jsonWithDataSource(ApiEngine.runBrokenLinkScan(), "json-fallback");
    if (path === "admin/seo/schema/templates") return jsonWithDataSource({ template: ApiEngine.createSeoSchemaTemplate(body), success: true }, "json-fallback", 201);
    if (path === "admin/seo/schema/validate") return jsonWithDataSource(ApiEngine.validateJsonLd(body.json_ld || body.schema_json || "{}"), "json-fallback");
    if (path === "admin/seo/image-audits/scan") return jsonWithDataSource(ApiEngine.runImageAudit(), "json-fallback");
    if (path === "admin/seo/competitors") return jsonWithDataSource({ competitor: ApiEngine.createSeoCompetitor(body), success: true }, "json-fallback", 201);
    if (path === "admin/seo/geo/generate") return jsonWithDataSource({ geo_page: ApiEngine.generateGeoLandingPage(body), success: true }, "json-fallback", 201);
    if (path === "admin/seo/aeo/entries") return jsonWithDataSource({ aeo_entry: ApiEngine.createSeoAeoEntry(body), success: true }, "json-fallback", 201);
    if (path === "admin/seo/content-audits/scan") return jsonWithDataSource(ApiEngine.runContentAudit(), "json-fallback");
    if (path === "admin/seo/page-speed") return jsonWithDataSource({ page_speed: ApiEngine.recordSeoPageSpeed(body), success: true }, "json-fallback", 201);
    if (path === "admin/seo/utm-campaigns") return jsonWithDataSource({ campaign: ApiEngine.createSeoUtmCampaign(body), success: true }, "json-fallback", 201);
    if (path === "admin/seo/robots/save") return jsonWithDataSource({ robots: ApiEngine.saveRobotsVersion(body), success: true }, "json-fallback");
    if (path === "admin/seo/robots/rollback") return jsonWithDataSource({ robots: ApiEngine.rollbackRobots(body.id), success: true }, "json-fallback");
    if (path === "admin/seo/backlinks") return jsonWithDataSource({ backlink: ApiEngine.createSeoBacklink(body), success: true }, "json-fallback", 201);
    if (path === "admin/seo/reports/generate") return jsonWithDataSource({ report: ApiEngine.generateSeoReport(body.type || "overall"), success: true }, "json-fallback", 201);
    if (path === "admin/seo/health-reports/generate") return jsonWithDataSource({ report: ApiEngine.generateSeoHealthReport(), success: true }, "json-fallback", 201);
    if (path === "admin/seo/ai/generate") return jsonWithDataSource(ApiEngine.generateAiSeoContent(body.type || "meta_title", body.context || body), "json-fallback");
    if (path === "admin/seo/integrations/bing/submit") return jsonWithDataSource(await ApiEngine.submitBingUrl(body.url), "json-fallback");
    if (path === "admin/seo/integrations/indexing/publish") return jsonWithDataSource(await ApiEngine.publishGoogleIndexingUrl(body.url, body.type), "json-fallback");
    if (path === "admin/seo/crawler/run") return jsonWithDataSource(await ApiEngine.runLiveCrawler(body.urls), "json-fallback");
    if (path === "admin/seo/audits/autofix") return jsonWithDataSource(ApiEngine.autoFixSeoIssue(body.issue_id), "json-fallback");
    if (path === "admin/seo/robots/validate") return jsonWithDataSource(ApiEngine.validateRobotsSyntax(body.content), "json-fallback");
    if (path === "admin/seo/sitemap/validate") return jsonWithDataSource(ApiEngine.validateSitemapXml(body.xml), "json-fallback");
    if (path === "admin/seo/rbac/check") return jsonWithDataSource(ApiEngine.checkSeoPermission(body.role || "super_admin", body.action), "json-fallback");
    if (path === "admin/marketing-automation") {
      return jsonWithDataSource({ trigger: ApiEngine.createAdminAutomationTrigger(body), success: true }, "json-fallback");
    }
    if (path === "admin/notifications") {
      return jsonWithDataSource({ notification: ApiEngine.createAdminNotification(body), success: true }, "json-fallback");
    }
    if (path === "admin/settings") {
      return jsonWithDataSource({ settings: ApiEngine.updateAdminSettings(body), success: true }, "json-fallback");
    }

    // Media Upload & Management
    if (path === "admin/media" || path === "admin/media/create") {
      return jsonWithDataSource({ media: ApiEngine.createMedia(body) }, "json-fallback", 201);
    }
    if (path === "admin/media/upload") {
      let mediaUrl = body.url;
      const fileName = body.filename || `upload_${Date.now()}.jpg`;
      
      // If base64 payload provided, save to public/uploads directory
      if (body.dataUrl && typeof body.dataUrl === "string" && body.dataUrl.startsWith("data:")) {
        try {
          const fs = await import("fs");
          const pathModule = await import("path");
          let root = process.cwd();
          if (!root.endsWith("frontend") && fs.existsSync(pathModule.join(root, "frontend"))) {
            root = pathModule.join(root, "frontend");
          }
          const uploadsDir = pathModule.join(root, "public", "uploads");
          if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
          }
          const base64Data = body.dataUrl.split(";base64,").pop();
          if (base64Data) {
            const cleanName = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, "")}`;
            const targetPath = pathModule.join(uploadsDir, cleanName);
            fs.writeFileSync(targetPath, Buffer.from(base64Data, "base64"));
            mediaUrl = `/uploads/${cleanName}`;
          }
        } catch (err) {
          console.error("Failed to write uploaded file to disk:", err);
        }
      }

      const registered = ApiEngine.createMedia({
        name: body.name || fileName,
        filename: fileName,
        url: mediaUrl || body.dataUrl || "",
        thumbnail_url: mediaUrl || body.dataUrl || "",
        mime_type: body.mime_type || "image/jpeg",
        size: body.size || 150000,
        alt_text: body.alt_text || body.alt || body.name || "",
        folder: body.folder || "uploads",
        width: body.width || 1200,
        height: body.height || 800,
      });

      return jsonWithDataSource({ media: registered, success: true }, "json-fallback", 201);
    }

    // CMS Configurator
    if (path === "cms/pages") return jsonWithDataSource({ page: ApiEngine.createCmsPage(body) }, "json-fallback");
    if (path.startsWith("cms/pages/") && path.endsWith("/duplicate")) {
      const pageId = path.replace("cms/pages/", "").replace("/duplicate", "");
      return jsonWithDataSource({ page: ApiEngine.duplicateCmsPage(pageId) }, "json-fallback");
    }
    if (path.startsWith("cms/pages/") && path.endsWith("/rollback")) {
      const pageId = path.replace("cms/pages/", "").replace("/rollback", "");
      return jsonWithDataSource({ page: ApiEngine.rollbackCmsPage(pageId, body.version || 1) }, "json-fallback");
    }
    if (path.startsWith("cms/pages/") && path.endsWith("/publish")) {
      const pageId = path.replace("cms/pages/", "").replace("/publish", "");
      return jsonWithDataSource(ApiEngine.publishCmsPage(pageId), "json-fallback");
    }
    if (path.startsWith("cms/pages/") && path.endsWith("/unpublish")) {
      const pageId = path.replace("cms/pages/", "").replace("/unpublish", "");
      return jsonWithDataSource(ApiEngine.unpublishCmsPage(pageId), "json-fallback");
    }
    if (path === "cms/pages/validate") {
      return jsonWithDataSource(ApiEngine.validatePageConfig(body), "json-fallback");
    }
    if (path === "cms/forms/submit") {
      return jsonWithDataSource({ submission: ApiEngine.submitCmsForm(body.form_type || "contact", body.data || body) }, "json-fallback");
    }

    if (path === "admin/reports/saved") return jsonWithDataSource({ report: ApiEngine.createSavedReport(body), success: true }, "json-fallback");
    if (path === "admin/reports/dashboards") return jsonWithDataSource({ layout: ApiEngine.saveDashboardLayout(body), success: true }, "json-fallback");
    if (path === "admin/reports/preferences") return jsonWithDataSource({ preferences: ApiEngine.saveChartPreferences(body), success: true }, "json-fallback");
    if (path === "admin/reports/schedule" || path === "admin/reports/schedules") return jsonWithDataSource({ schedule: ApiEngine.createScheduledReport(body), success: true }, "json-fallback");

    if (path.startsWith("admin/")) return jsonWithDataSource({ success: true, path, action: "processed" }, "json-fallback");

    return jsonWithDataSource({ error: `API Route "${path}" not found` }, "json-fallback", 404);
  } catch (err: any) {
    return jsonWithDataSource({ error: err.message || "Internal server error" }, "json-fallback", 500);
  }
}

export async function PUT(req: NextRequest, context: { params: { path: string[] } }) {
  try {
    const path = getPath(req, context);
    const body = await req.json().catch(() => ({}));

    // 1. Primary Route: PostgreSQL Backend Proxy (Port 9000)
    const backendRes = await forwardToPostgresBackend("PUT", path, body, undefined, req.headers);
    if (backendRes) return backendRes;

    // 2. Fallback Route: Disk-Backed ApiEngine
    if (path.startsWith("admin/branches/")) {
      const id = path.replace("admin/branches/", "");
      return jsonWithDataSource({ branch: ApiEngine.updateAdminBranch(id, body), success: true }, "json-fallback");
    }
    if (path.includes("/weight-prices")) {
      const prodId = extractProductIdFromPath(path);
      return jsonWithDataSource({ weight_prices: ApiEngine.saveProductWeightPrices(prodId, body.weight_prices || body), success: true }, "json-fallback");
    }
    if (path.startsWith("admin/catalog/products/") || path.startsWith("admin/products/")) {
      const id = extractProductIdFromPath(path);
      return jsonWithDataSource({ product: ApiEngine.updateAdminProduct(id, body), success: true }, "json-fallback");
    }
    if (path.startsWith("admin/offers/")) {
      const id = path.replace("admin/offers/", "");
      return jsonWithDataSource({ offer: ApiEngine.updateAdminOffer(id, body), success: true }, "json-fallback");
    }
    if (path === "admin/delivery/assignment-rules") {
      return jsonWithDataSource({ rules: ApiEngine.updateDeliveryAssignmentRules(body), success: true }, "json-fallback");
    }
    if (path.startsWith("admin/delivery/partners/")) {
      const parts = path.replace("admin/delivery/partners/", "").split("/");
      const partnerId = parts[0];
      const subAction = parts[1];

      if (subAction === "availability") {
        return jsonWithDataSource(ApiEngine.updatePartnerAvailability(partnerId, body.availability_status || body.status, body.reason), "json-fallback");
      }
      if (subAction === "working-hours") {
        return jsonWithDataSource({ partner: ApiEngine.updateAdminDeliveryPartner(partnerId, { working_hours: body.working_hours || body }), success: true }, "json-fallback");
      }
      if (subAction === "branches") {
        return jsonWithDataSource({ partner: ApiEngine.updateAdminDeliveryPartner(partnerId, { associated_branches: body.associated_branches, primary_branch_id: body.primary_branch_id }), success: true }, "json-fallback");
      }
      if (subAction === "coverage") {
        return jsonWithDataSource({ partner: ApiEngine.updateAdminDeliveryPartner(partnerId, { coverage: body.coverage || body }), success: true }, "json-fallback");
      }
      return jsonWithDataSource({ partner: ApiEngine.updateAdminDeliveryPartner(partnerId, body), success: true }, "json-fallback");
    }
    if (path.startsWith("admin/delivery/jobs/")) {
      const id = path.replace("admin/delivery/jobs/", "");
      return jsonWithDataSource({ delivery: ApiEngine.updateAdminDeliveryStatus(id, body.status), success: true }, "json-fallback");
    }
    if (path.startsWith("admin/notifications/")) {
      const id = path.replace("admin/notifications/", "");
      return jsonWithDataSource({ success: ApiEngine.markNotificationRead(id) }, "json-fallback");
    }
    if (path === "admin/marketing/seo") {
      return jsonWithDataSource({ config: ApiEngine.updateAdminSeoConfig(body), success: true }, "json-fallback");
    }
    if (path === "admin/settings") {
      return jsonWithDataSource({ settings: ApiEngine.updateAdminSettings(body), success: true }, "json-fallback");
    }

    if (path.startsWith("cms/pages/")) {
      const pageId = path.replace("cms/pages/", "");
      return jsonWithDataSource({ page: ApiEngine.updateCmsPage(pageId, body) }, "json-fallback");
    }

    if (path.startsWith("admin/orders/")) {
      const parts = path.replace("admin/orders/", "").split("/");
      const orderId = parts[0];
      const action = parts[1];

      if (action === "status") {
        const result = ApiEngine.updateOrderStatus(orderId, body.status, body.notes);
        if (result) return jsonWithDataSource(result, "json-fallback");
        return jsonWithDataSource({ error: "Order not found" }, "json-fallback", 404);
      }
      if (action === "assign-branch") {
        const result = ApiEngine.assignOrderBranch(orderId, body.branch_id, body.notes);
        if (result) return jsonWithDataSource(result, "json-fallback");
        return jsonWithDataSource({ error: "Order not found" }, "json-fallback", 404);
      }
      if (action === "assign-delivery" || action === "reassign-delivery") {
        const result = ApiEngine.manualAssignOrderDelivery(orderId, body.delivery_partner_id || body.partner_id, body.reason);
        if (result) return jsonWithDataSource(result, "json-fallback");
        return jsonWithDataSource({ error: "Order not found" }, "json-fallback", 404);
      }
      if (action === "auto-assign-delivery") {
        const result = ApiEngine.autoAssignDeliveryDriver(orderId);
        if (result) return jsonWithDataSource(result, "json-fallback");
        return jsonWithDataSource({ error: "Order not found" }, "json-fallback", 404);
      }
      if (action === "unassign-delivery") {
        const result = ApiEngine.unassignOrderDelivery(orderId, body.reason);
        if (result) return jsonWithDataSource(result, "json-fallback");
        return jsonWithDataSource({ error: "Order not found" }, "json-fallback", 404);
      }
      if (action === "reschedule") {
        const result = ApiEngine.rescheduleOrder(orderId, body.delivery_date, body.time_slot);
        if (result) return jsonWithDataSource(result, "json-fallback");
        return jsonWithDataSource({ error: "Order not found" }, "json-fallback", 404);
      }
      if (action === "cancel") {
        const result = ApiEngine.cancelOrder(orderId, body.reason);
        if (result) return jsonWithDataSource(result, "json-fallback");
        return jsonWithDataSource({ error: "Order not found" }, "json-fallback", 404);
      }
      if (action === "refund") {
        const result = ApiEngine.refundOrder(orderId, body.amount, body.reason);
        if (result) return jsonWithDataSource(result, "json-fallback");
        return jsonWithDataSource({ error: "Order not found" }, "json-fallback", 404);
      }
    }

    if (path.startsWith("admin/reports/saved/")) {
      const id = path.replace("admin/reports/saved/", "");
      return jsonWithDataSource({ report: ApiEngine.updateSavedReport(id, body), success: true }, "json-fallback");
    }

    if (path.startsWith("admin/")) return jsonWithDataSource({ success: true, path, action: "updated" }, "json-fallback");

    return jsonWithDataSource({ error: `API Route "${path}" not found` }, "json-fallback", 404);
  } catch (err: any) {
    return jsonWithDataSource({ error: err.message || "Internal server error" }, "json-fallback", 500);
  }
}

export async function DELETE(req: NextRequest, context: { params: { path: string[] } }) {
  try {
    const path = getPath(req, context);
    const body = await req.json().catch(() => ({}));

    // 1. Primary Route: PostgreSQL Backend Proxy (Port 9000)
    const backendRes = await forwardToPostgresBackend("DELETE", path, undefined, undefined, req.headers);
    if (backendRes) return backendRes;

    // 2. Fallback Route: Disk-Backed ApiEngine
    if (path.startsWith("admin/delivery/partners/")) {
      const partnerId = path.replace("admin/delivery/partners/", "");
      return jsonWithDataSource(ApiEngine.deactivateDeliveryPartner(partnerId, body.reason), "json-fallback");
    }

    if (path.startsWith("admin/orders/")) {
      const parts = path.replace("admin/orders/", "").split("/");
      const orderId = parts[0];
      const action = parts[1];
      if (action === "unassign-delivery") {
        return jsonWithDataSource(ApiEngine.unassignOrderDelivery(orderId, body.reason), "json-fallback");
      }
    }

    // 2. Fallback Route: Disk-Backed ApiEngine
    if (path.startsWith("cart/items/")) {
      const itemId = path.replace("cart/items/", "");
      const url = new URL(req.url);
      const cartId = url.searchParams.get("cartId") || "cart_guest_100";
      return jsonWithDataSource({ cart: ApiEngine.removeFromCart(cartId, itemId) }, "json-fallback");
    }

    if (path.startsWith("admin/branches/")) {
      const id = path.replace("admin/branches/", "");
      return jsonWithDataSource({ deleted: ApiEngine.deleteAdminBranch(id), success: true }, "json-fallback");
    }

    if (path.startsWith("admin/catalog/products/")) {
      const id = path.replace("admin/catalog/products/", "");
      return jsonWithDataSource({ deleted: ApiEngine.deleteAdminProduct(id), success: true }, "json-fallback");
    }

    if (path.startsWith("admin/offers/")) {
      const id = path.replace("admin/offers/", "");
      return jsonWithDataSource({ deleted: ApiEngine.deleteAdminOffer(id), success: true }, "json-fallback");
    }

    if (path.startsWith("admin/media/")) {
      const id = path.replace("admin/media/", "");
      return jsonWithDataSource({ deleted: ApiEngine.deleteMedia(id), success: true }, "json-fallback");
    }

    if (path.startsWith("cms/pages/")) {
      const pageId = path.replace("cms/pages/", "");
      return jsonWithDataSource({ deleted: ApiEngine.deleteCmsPage(pageId) });
    }

    if (path.startsWith("admin/reports/saved/")) {
      const id = path.replace("admin/reports/saved/", "");
      return jsonWithDataSource({ deleted: ApiEngine.deleteSavedReport(id), success: true }, "json-fallback");
    }

    if (path.startsWith("admin/")) return jsonWithDataSource({ success: true, path, action: "deleted" }, "json-fallback");

    return jsonWithDataSource({ error: `API Route "${path}" not found` }, "json-fallback", 404);
  } catch (err: any) {
    return jsonWithDataSource({ error: err.message || "Internal server error" }, "json-fallback", 500);
  }
}

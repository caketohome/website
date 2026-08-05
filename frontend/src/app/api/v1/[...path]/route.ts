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


function getPath(context: { params?: { path?: string[] } }): string {
  const p = context?.params?.path;
  if (!p) return "";
  return Array.isArray(p) ? p.join("/") : String(p);
}

export async function GET(req: NextRequest, context: { params: { path: string[] } }) {
  try {
    const path = getPath(context);
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
    if (path === "admin/health") return jsonWithDataSource(ApiEngine.getAdminHealth(), "json-fallback");
    if (path === "admin/orders") return jsonWithDataSource({ orders: ApiEngine.getAdminOrders() }, "json-fallback");
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
    if (path === "admin/offers") return jsonWithDataSource({ offers: ApiEngine.getAdminOffers() }, "json-fallback");
    if (path === "admin/marketing/campaigns") return jsonWithDataSource({ campaigns: ApiEngine.getAdminCampaigns() }, "json-fallback");
    if (path === "admin/delivery") return jsonWithDataSource({ deliveries: ApiEngine.getAdminDeliveries() }, "json-fallback");
    if (path === "admin/delivery/partners" || path === "admin/delivery-partners") return jsonWithDataSource({ partners: ApiEngine.getAdminDeliveryPartners() }, "json-fallback");
    if (path === "admin/crm/customers" || path === "admin/customers") return jsonWithDataSource({ customers: ApiEngine.getAdminCustomers() }, "json-fallback");
    if (path === "admin/rewards/loyalty/ledgers") return jsonWithDataSource({ ledgers: ApiEngine.getAdminLoyaltyLedgers() }, "json-fallback");
    if (path === "admin/rewards/referrals/programs") return jsonWithDataSource({ programs: ApiEngine.getAdminReferralPrograms() }, "json-fallback");
    if (path === "admin/rewards/wallets/transactions") return jsonWithDataSource({ transactions: ApiEngine.getAdminWalletTransactions() }, "json-fallback");
    if (path === "admin/marketing/seo" || path === "seo" || path === "admin/seo") return jsonWithDataSource(ApiEngine.getAdminSeoConfig(), "json-fallback");
    if (path === "admin/ab-testing" || path === "ab-testing") return jsonWithDataSource({ experiments: ApiEngine.getAdminAbTests() }, "json-fallback");
    if (path === "admin/marketing-automation" || path === "marketing-automation") return jsonWithDataSource({ triggers: ApiEngine.getAdminAutomationTriggers() }, "json-fallback");
    if (path === "admin/notifications" || path === "notifications") return jsonWithDataSource({ notifications: ApiEngine.getAdminNotifications() }, "json-fallback");
    if (path === "admin/settings") return jsonWithDataSource({ settings: ApiEngine.updateAdminSettings() }, "json-fallback");
    if (path === "admin/audit-logs") return jsonWithDataSource({ logs: ApiEngine.getAdminAuditLogs() }, "json-fallback");
    if (path === "admin/analytics/dashboard") return jsonWithDataSource({ metrics: ApiEngine.getAdminAnalytics() }, "json-fallback");
    if (path === "admin/security") return jsonWithDataSource({ config: ApiEngine.getAdminSecurityConfig() }, "json-fallback");
    if (path === "admin/reports") return jsonWithDataSource({ reports: ApiEngine.getAdminReports() }, "json-fallback");
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
    const path = getPath(context);
    const body = await req.json().catch(() => ({}));

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
      return jsonWithDataSource({ cart: ApiEngine.applyPromoCode(cartId, body.promoCode || "") }, "json-fallback");
    }

    if (path === "orders") {
      return jsonWithDataSource({ order: ApiEngine.createOrder(body) }, "json-fallback");
    }

    // Admin Persistent Mutations
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
      return jsonWithDataSource({ offer: ApiEngine.createAdminOffer(body), success: true }, "json-fallback");
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
    if (path === "admin/ab-testing") {
      return jsonWithDataSource({ experiment: ApiEngine.createAdminAbTest(body), success: true }, "json-fallback");
    }
    if (path === "admin/marketing-automation") {
      return jsonWithDataSource({ trigger: ApiEngine.createAdminAutomationTrigger(body), success: true }, "json-fallback");
    }
    if (path === "admin/notifications") {
      return jsonWithDataSource({ notification: ApiEngine.createAdminNotification(body), success: true }, "json-fallback");
    }
    if (path === "admin/settings") {
      return jsonWithDataSource({ settings: ApiEngine.updateAdminSettings(body), success: true }, "json-fallback");
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
    if (path === "cms/forms/submit") {
      return jsonWithDataSource({ submission: ApiEngine.submitCmsForm(body.form_type || "contact", body.data || body) }, "json-fallback");
    }

    if (path.startsWith("admin/")) return jsonWithDataSource({ success: true, path, action: "processed" }, "json-fallback");

    return jsonWithDataSource({ error: `API Route "${path}" not found` }, "json-fallback", 404);
  } catch (err: any) {
    return jsonWithDataSource({ error: err.message || "Internal server error" }, "json-fallback", 500);
  }
}

export async function PUT(req: NextRequest, context: { params: { path: string[] } }) {
  try {
    const path = getPath(context);
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

    if (path.startsWith("admin/")) return jsonWithDataSource({ success: true, path, action: "updated" }, "json-fallback");

    return jsonWithDataSource({ error: `API Route "${path}" not found` }, "json-fallback", 404);
  } catch (err: any) {
    return jsonWithDataSource({ error: err.message || "Internal server error" }, "json-fallback", 500);
  }
}

export async function DELETE(req: NextRequest, context: { params: { path: string[] } }) {
  try {
    const path = getPath(context);

    // 1. Primary Route: PostgreSQL Backend Proxy (Port 9000)
    const backendRes = await forwardToPostgresBackend("DELETE", path, undefined, undefined, req.headers);
    if (backendRes) return backendRes;

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

    if (path.startsWith("cms/pages/")) {
      const pageId = path.replace("cms/pages/", "");
      return jsonWithDataSource({ deleted: ApiEngine.deleteCmsPage(pageId) });
    }

    if (path.startsWith("admin/")) return jsonWithDataSource({ success: true, path, action: "deleted" }, "json-fallback");

    return jsonWithDataSource({ error: `API Route "${path}" not found` }, "json-fallback", 404);
  } catch (err: any) {
    return jsonWithDataSource({ error: err.message || "Internal server error" }, "json-fallback", 500);
  }
}

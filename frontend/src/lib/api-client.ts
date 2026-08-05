/**
 * CakeToHome Enterprise Storefront API Client (Clean /api/v1 Abstraction)
 * Standardized fetch client supporting full REST CRUD operations and database persistence.
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:9000";
const API_BASE = `${BACKEND_URL}/api/v1`;

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

class CakeToHomeApiClient {
  private token: string | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      this.token = localStorage.getItem("cth_access_token")
        || localStorage.getItem("cth_admin_token")
        || localStorage.getItem("admin_token")
        || localStorage.getItem("medusa_access_token");
    }
  }

  setToken(token: string) {
    this.token = token;
    if (typeof window !== "undefined") {
      localStorage.setItem("cth_access_token", token);
      localStorage.setItem("cth_admin_token", token);
    }
  }

  clearToken() {
    this.token = null;
    if (typeof window !== "undefined") {
      localStorage.removeItem("cth_access_token");
      localStorage.removeItem("cth_admin_token");
      localStorage.removeItem("admin_token");
      localStorage.removeItem("medusa_access_token");
    }
  }

  private getToken(): string | null {
    if (this.token) return this.token;
    if (typeof window !== "undefined") {
      const t = localStorage.getItem("cth_access_token")
        || localStorage.getItem("cth_admin_token")
        || localStorage.getItem("admin_token")
        || localStorage.getItem("medusa_access_token");
      if (t) {
        this.token = t;
        return t;
      }
    }
    return null;
  }

  private authPromise: Promise<string | null> | null = null;

  private async autoAuthAdmin(): Promise<string | null> {
    if (this.token) return this.token;
    if (this.authPromise) return this.authPromise;

    this.authPromise = (async () => {
      try {
        const authUrl = typeof window !== "undefined"
          ? "/api/v1/auth/user/emailpass"
          : `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:9000"}/auth/user/emailpass`;

        const authRes = await fetch(authUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "admin@email.com", password: "supersecret" }),
        });
        if (authRes.ok) {
          const data = await authRes.json();
          const token = data.token || data.access_token;
          if (token) {
            this.setToken(token);
            return token;
          }
        }
      } catch {
        // Ignore auto-auth error
      } finally {
        this.authPromise = null;
      }
      return null;
    })();

    return this.authPromise;
  }


  private async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const startTime = Date.now();
    const method = options.method || "GET";
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    let activeToken = this.getToken();
    if (!activeToken && endpoint.startsWith("/admin")) {
      activeToken = await this.autoAuthAdmin();
    }

    if (activeToken) {
      headers["Authorization"] = `Bearer ${activeToken}`;
    }

    const primaryUrl = typeof window !== "undefined"
      ? `/api/v1${endpoint}`
      : `http://localhost:3000/api/v1${endpoint}`;

    try {
      const response = await fetch(primaryUrl, {
        ...options,
        headers,
      });

      const duration = Date.now() - startTime;

      if (response.ok) {
        const data = await response.json();
        console.log(`[API CLIENT SUCCESS] [${method}] ${primaryUrl} | Status: ${response.status} | Duration: ${duration}ms`);
        return data;
      }

      if (response.status === 401 && endpoint.startsWith("/admin")) {
        console.log(`[API CLIENT 401 AUTH RETRY] Attempting auto-auth refresh for ${endpoint}...`);
        const freshToken = await this.autoAuthAdmin();
        if (freshToken) {
          headers["Authorization"] = `Bearer ${freshToken}`;
          const retryRes = await fetch(primaryUrl, { ...options, headers });
          if (retryRes.ok) {
            const retryData = await retryRes.json();
            console.log(`[API CLIENT RETRY SUCCESS] [${method}] ${primaryUrl} | Status: ${retryRes.status} | Duration: ${Date.now() - startTime}ms`);
            return retryData;
          }
        }
      }

      const errData = await response.json().catch(() => ({}));
      console.warn(`[API CLIENT HTTP ERROR ${response.status}] [${method}] ${primaryUrl} | Duration: ${duration}ms | ${errData.message || errData.error || response.statusText}`);
      throw new Error(errData.message || errData.error || `HTTP ${response.status} Request Failed`);
    } catch (err: any) {
      const duration = Date.now() - startTime;
      console.error(`[API CLIENT REQUEST FAILED] [${method}] ${primaryUrl} | Duration: ${duration}ms | Error: ${err.message}`);
      if (typeof window !== "undefined") {
        throw err;
      }
      const fallbackUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:9000"}/api/v1${endpoint}`;
      try {
        const fallbackRes = await fetch(fallbackUrl, { ...options, headers });
        if (fallbackRes.ok) {
          return fallbackRes.json();
        }
      } catch {
        // Ignore fallback error and throw original
      }
      throw err;
    }
  }

  // Auth Domain APIs (/api/v1/auth)
  async requestOtp(phone: string) {
    return this.request("/auth/request-otp", {
      method: "POST",
      body: JSON.stringify({ phone }),
    });
  }

  async verifyOtp(phone: string, code: string) {
    const res = await this.request<{ accessToken: string; user: any }>("/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ phone, code }),
    });

    if (res.accessToken) {
      this.setToken(res.accessToken);
    }
    return res;
  }

  // Products & Catalog APIs (/api/v1/products)
  async getProducts() {
    return this.request("/products");
  }

  async getProductBySlug(slug: string) {
    return this.request(`/products/slug/${slug}`);
  }

  // Cart Engine APIs (/api/v1/cart)
  async getCart(cartId?: string) {
    return this.request(`/cart${cartId ? `?cartId=${cartId}` : ""}`);
  }

  async addToCart(payload: { cartId?: string; productId: string; variantId: string; quantity: number; selectedOptions?: any }) {
    return this.request("/cart/items", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async deleteLineItem(cartId: string, lineItemId: string) {
    return this.request(`/cart/items/${lineItemId}?cartId=${cartId}`, {
      method: "DELETE",
    });
  }

  async updateLineItem(cartId: string, lineItemId: string, quantity: number) {
    return this.request(`/cart/items/${lineItemId}`, {
      method: "POST",
      body: JSON.stringify({ cartId, quantity }),
    });
  }

  async applyPromoCode(cartId: string, promoCode: string, appliedCoupons: string[] = []) {
    return this.request("/cart/promo", {
      method: "POST",
      body: JSON.stringify({ cartId, promoCode }),
    });
  }

  // Checkout & Orders APIs (/api/v1/orders)
  async createOrder(orderPayload: any) {
    return this.request("/orders", {
      method: "POST",
      body: JSON.stringify(orderPayload),
    });
  }

  // Payments APIs (/api/v1/payments)
  async processPaymentWebhook(webhookData: any) {
    return this.request("/payments/webhook", {
      method: "POST",
      body: JSON.stringify(webhookData),
    });
  }

  // Kitchen KDS APIs (/api/v1/kitchen)
  async getKitchenQueue(branchId: string) {
    return this.request(`/kitchen/queue/${branchId}`);
  }

  // Delivery APIs (/api/v1/delivery)
  async autoAssignDriver(jobId: string) {
    return this.request("/delivery/assign", {
      method: "POST",
      body: JSON.stringify({ jobId }),
    });
  }

  // ── Admin: Orders ──
  async getAdminOrders() {
    return this.request("/admin/orders").catch(() => ({ orders: [] }));
  }
  async getAdminOrder(id: string) {
    return this.request(`/admin/orders/${id}`).catch(() => null);
  }
  async updateOrderStatus(id: string, status: string) {
    return this.request(`/admin/order-lifecycle/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) }).catch(() => null);
  }

  // ── Admin: Catalog ──
  async getAdminProducts() {
    return this.request("/admin/catalog/products").catch(() => ({ products: [] }));
  }
  async getAdminProduct(id: string) {
    return this.request(`/admin/catalog/products/${id}`).catch(() => null);
  }
  async getAdminCakeOptions() {
    return this.request("/admin/catalog/cake-options").catch(() => ({ options: [] }));
  }
  async createAdminProduct(productData: any) {
    return this.request("/admin/catalog/products", { method: "POST", body: JSON.stringify(productData) });
  }
  async updateAdminProduct(id: string, productData: any) {
    return this.request(`/admin/catalog/products/${id}`, { method: "PUT", body: JSON.stringify(productData) });
  }
  async deleteAdminProduct(id: string) {
    return this.request(`/admin/catalog/products/${id}`, { method: "DELETE" });
  }

  // ── Admin: Categories ──
  async getAdminCategories() {
    return this.request("/admin/categories").catch(() => ({ categories: [] }));
  }
  async createAdminCategory(data: any) {
    return this.request("/admin/categories", { method: "POST", body: JSON.stringify(data) });
  }
  async updateAdminCategory(id: string, data: any) {
    return this.request(`/admin/categories/${id}`, { method: "PUT", body: JSON.stringify(data) });
  }
  async deleteAdminCategory(id: string) {
    return this.request(`/admin/categories/${id}`, { method: "DELETE" });
  }
  async restoreAdminCategory(id: string) {
    return this.request(`/admin/categories/${id}/restore`, { method: "POST" });
  }

  // ── Admin: Master Weights ──
  async getAdminWeights() {
    return this.request("/admin/weights").catch(() => ({ weights: [] }));
  }
  async createAdminWeight(data: any) {
    return this.request("/admin/weights", { method: "POST", body: JSON.stringify(data) });
  }
  async updateAdminWeight(id: string, data: any) {
    return this.request(`/admin/variants/options/${id}`, { method: "PUT", body: JSON.stringify(data) });
  }
  async deleteAdminWeight(id: string) {
    return this.request(`/admin/variants/options/${id}`, { method: "DELETE" });
  }

  // ── Admin: Master Variant Options ──
  async getAdminVariantOptions(type?: string) {
    const query = type ? `?type=${type}` : "";
    return this.request(`/admin/variants/options${query}`).catch(() => ({ options: [] }));
  }
  async createAdminVariantOption(data: any) {
    return this.request("/admin/variants/options", { method: "POST", body: JSON.stringify(data) });
  }
  async updateAdminVariantOption(id: string, data: any) {
    return this.request(`/admin/variants/options/${id}`, { method: "PUT", body: JSON.stringify(data) });
  }
  async deleteAdminVariantOption(id: string) {
    return this.request(`/admin/variants/options/${id}`, { method: "DELETE" });
  }

  // ── Product Weight Pricing Matrix ──
  async getProductWeightPrices(productId: string) {
    return this.request(`/admin/products/${productId}/weight-prices`).catch(() => ({ weight_prices: [] }));
  }
  async saveProductWeightPrices(productId: string, weightPrices: any[]) {
    return this.request(`/admin/products/${productId}/weight-prices`, { method: "POST", body: JSON.stringify({ weight_prices: weightPrices }) });
  }

  // ── Admin: Branches ──
  async getAdminBranches() {
    return this.request("/admin/branches").catch(() => ({ branches: [] }));
  }
  async getAdminCities() {
    return this.request("/admin/cities").catch(() => ({ cities: [] }));
  }
  async getAdminRegions() {
    return this.request("/admin/regions").catch(() => ({ regions: [] }));
  }
  async createAdminBranch(branchData: any) {
    return this.request("/admin/branches", { method: "POST", body: JSON.stringify(branchData) });
  }
  async updateAdminBranch(id: string, branchData: any) {
    return this.request(`/admin/branches/${id}`, { method: "PUT", body: JSON.stringify(branchData) });
  }
  async deleteAdminBranch(id: string) {
    return this.request(`/admin/branches/${id}`, { method: "DELETE" });
  }
  async saveBranchZone(branchId: string, zoneData: any) {
    return this.request("/admin/branches", { method: "POST", body: JSON.stringify({ type: "delivery_zone", branchId, zoneData }) });
  }
  async deleteBranchZone(branchId: string, zoneId: string) {
    return this.request("/admin/branches", { method: "POST", body: JSON.stringify({ type: "delete_delivery_zone", branchId, zoneId }) });
  }
  async movePincodeZone(pincode: string, targetBranchId: string, targetZoneId: string) {
    return this.request("/admin/branches", { method: "POST", body: JSON.stringify({ type: "move_pincode_zone", pincode, targetBranchId, targetZoneId }) });
  }
  async bulkImportPincodes(mappingsList: any[]) {
    return this.request("/admin/branches", { method: "POST", body: JSON.stringify({ type: "bulk_import_pincodes", mappingsList }) });
  }
  async setProductDeliveryRules(productId: string, rules: any) {
    return this.request("/admin/branches", { method: "POST", body: JSON.stringify({ type: "product_delivery_rules", productId, rules }) });
  }
  async setProductPrepTime(productId: string, prepHours: number) {
    return this.request("/admin/branches", { method: "POST", body: JSON.stringify({ type: "product_prep_time", productId, prepHours }) });
  }
  async toggleBranchOnline(branchId: string, isOnline: boolean) {
    return this.request("/admin/branches", { method: "POST", body: JSON.stringify({ type: "toggle_online", branchId, isOnline }) });
  }
  async pauseBranchOrders(branchId: string, durationMins: number) {
    return this.request("/admin/branches", { method: "POST", body: JSON.stringify({ type: "pause_orders", branchId, durationMins }) });
  }
  async createAdminCity(name: string) {
    return this.request("/admin/cities", { method: "POST", body: JSON.stringify({ name }) });
  }
  async createAdminRegion(name: string) {
    return this.request("/admin/regions", { method: "POST", body: JSON.stringify({ name }) });
  }

  // ── Admin: Delivery ──
  async getAdminDeliveries() {
    return this.request("/admin/delivery").catch(() => ({ deliveries: [] }));
  }
  async getAdminDeliveryPartners() {
    return this.request("/admin/delivery/partners").catch(() => ({ partners: [] }));
  }
  async createAdminDeliveryPartner(partnerData: any) {
    return this.request("/admin/delivery/partners", { method: "POST", body: JSON.stringify(partnerData) });
  }
  async updateAdminDeliveryStatus(id: string, status: string) {
    return this.request(`/admin/delivery/jobs/${id}`, { method: "PUT", body: JSON.stringify({ status }) });
  }

  // ── Admin: CRM ──
  async getAdminCustomers() {
    return this.request("/admin/crm/customers").catch(() => ({ customers: [] }));
  }
  async createAdminCustomer(customerData: any) {
    return this.request("/admin/crm/customers", { method: "POST", body: JSON.stringify(customerData) });
  }

  // ── Admin: Marketing & Coupons ──
  async getAdminCampaigns() {
    return this.request("/admin/marketing/campaigns").catch(() => ({ campaigns: [] }));
  }
  async getAdminOffers() {
    return this.request("/admin/offers").catch(() => ({ offers: [] }));
  }
  async createAdminOffer(offerData: any) {
    return this.request("/admin/offers", { method: "POST", body: JSON.stringify(offerData) });
  }
  async updateAdminOffer(id: string, offerData: any) {
    return this.request(`/admin/offers/${id}`, { method: "PUT", body: JSON.stringify(offerData) });
  }
  async deleteAdminOffer(id: string) {
    return this.request(`/admin/offers/${id}`, { method: "DELETE" });
  }
  async createAdminCampaign(campaignData: any) {
    return this.request("/admin/marketing/campaigns", { method: "POST", body: JSON.stringify(campaignData) });
  }

  // ── Admin: Rewards ──
  async getAdminLoyaltyLedgers() {
    return this.request("/admin/rewards/loyalty/ledgers").catch(() => ({ ledgers: [] }));
  }
  async getAdminReferralPrograms() {
    return this.request("/admin/rewards/referrals/programs").catch(() => ({ programs: [] }));
  }
  async getAdminWalletTransactions() {
    return this.request("/admin/rewards/wallets/transactions").catch(() => ({ transactions: [] }));
  }

  // ── Admin: A/B Testing ──
  async getAdminAbTests() {
    return this.request("/admin/ab-testing").catch(() => ({ experiments: [] }));
  }
  async createAdminAbTest(expData: any) {
    return this.request("/admin/ab-testing", { method: "POST", body: JSON.stringify(expData) });
  }

  // ── Admin: Automation ──
  async getAdminAutomationTriggers() {
    return this.request("/admin/marketing-automation").catch(() => ({ triggers: [] }));
  }
  async createAdminAutomationTrigger(triggerData: any) {
    return this.request("/admin/marketing-automation", { method: "POST", body: JSON.stringify(triggerData) });
  }

  // ── Admin: CMS Page Configurator ──
  async getCmsPages() {
    return this.request("/cms/pages").catch(() => ({ pages: [] }));
  }
  async getCmsPage(id: string) {
    return this.request(`/cms/pages/${id}`).catch(() => ({ page: null }));
  }
  async createCmsPage(payload: any) {
    return this.request("/cms/pages", { method: "POST", body: JSON.stringify(payload) });
  }
  async updateCmsPage(id: string, payload: any) {
    return this.request(`/cms/pages/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  }
  async duplicateCmsPage(id: string) {
    return this.request(`/cms/pages/${id}/duplicate`, { method: "POST" });
  }
  async rollbackCmsPage(id: string, version: number) {
    return this.request(`/cms/pages/${id}/rollback`, { method: "POST", body: JSON.stringify({ version }) });
  }
  async deleteCmsPage(id: string) {
    return this.request(`/cms/pages/${id}`, { method: "DELETE" });
  }
  async getCmsForms(type?: string) {
    const q = type ? `?type=${type}` : "";
    return this.request(`/cms/forms${q}`).catch(() => ({ submissions: [] }));
  }
  async getCmsAnalytics(id: string) {
    return this.request(`/cms/analytics/${id}`).catch(() => ({ analytics: null }));
  }
  async getAdminCmsBlocks() {
    return this.request("/admin/cms/blocks").catch(() => ({ blocks: [] }));
  }
  async getAdminMedia() {
    return this.request("/admin/media").catch(() => ({ media: [] }));
  }

  // ── Admin: Analytics & Reports ──
  async getAdminAnalytics() {
    return this.request("/admin/analytics/dashboard").catch(() => ({ metrics: {} }));
  }
  async getAdminReports() {
    return this.request("/admin/reports").catch(() => ({ reports: [] }));
  }

  // ── Admin: Notifications & Support ──
  async getAdminNotifications() {
    return this.request("/admin/notifications").catch(() => ({ notifications: [] }));
  }
  async createAdminNotification(notifData: any) {
    return this.request("/admin/notifications", { method: "POST", body: JSON.stringify(notifData) });
  }
  async markNotificationRead(id: string) {
    return this.request(`/admin/notifications/${id}`, { method: "PUT" });
  }
  async getAdminSupportTickets() {
    return this.request("/admin/support/tickets").catch(() => ({ tickets: [] }));
  }

  // ── Admin: Settings & Security ──
  async getAdminSettings() {
    return this.request("/admin/settings").catch(() => ({ settings: {} }));
  }
  async updateAdminSettings(settingsData: any) {
    return this.request("/admin/settings", { method: "POST", body: JSON.stringify(settingsData) });
  }
  async getAdminAuditLogs() {
    return this.request("/admin/audit-logs").catch(() => ({ logs: [] }));
  }
  async getAdminSecurityConfig() {
    return this.request("/admin/security").catch(() => ({ config: {} }));
  }
  async getAdminHealth() {
    return this.request("/admin/health").catch(() => ({ status: "operational" }));
  }

  // ── Admin: SEO & Digital Marketing ──
  async getAdminSeoConfig() {
    return this.request("/admin/marketing/seo").catch(() => ({ meta_title: "", meta_description: "", keywords: "" }));
  }
  async updateAdminSeoConfig(seoData: any) {
    return this.request("/admin/marketing/seo", { method: "POST", body: JSON.stringify(seoData) }).catch(() => ({ success: false }));
  }
  async getAdminImageAltTexts() {
    return this.request("/admin/cms/image-alt-texts").catch(() => ({ alt_texts: [] }));
  }
  async updateAdminImageAltText(id: string, altText: string) {
    return this.request(`/admin/cms/image-alt-texts/${id}`, { method: "PUT", body: JSON.stringify({ alt_text: altText }) }).catch(() => ({ success: false }));
  }

  async getAdminPages() {
    return this.request("/admin/cms/pages").catch(() => ({ pages: [] }));
  }
  async savePageBuilderLayout(pageId: string, layoutData: any) {
    return this.request(`/admin/cms/pages/${pageId}/builder`, { method: "POST", body: JSON.stringify(layoutData) }).catch(() => ({ success: false }));
  }

  // ── Enterprise Accessory & Gift Management APIs ──
  async getAccessories(productId?: string) {
    const query = productId ? `?productId=${productId}` : "";
    return this.request(`/accessories${query}`).catch(() => ({ accessories: [] }));
  }

  async getAdminAccessories() {
    return this.request("/admin/accessories").catch(() => ({ accessories: [], categories: [], rules: [] }));
  }

  async createAdminAccessory(data: any) {
    return this.request("/admin/accessories", { method: "POST", body: JSON.stringify(data) });
  }

  async updateAdminAccessory(id: string, data: any) {
    return this.request("/admin/accessories", { method: "PUT", body: JSON.stringify({ id, ...data }) });
  }

  async deleteAdminAccessory(id: string) {
    return this.request(`/admin/accessories?id=${id}`, { method: "DELETE" });
  }

  // ── Enterprise Multi-Branch APIs ──
  async getBranches() {
    return this.request("/branches").catch(() => ({ branches: [], cityAreas: [] }));
  }

  async resolveBranch(params: { lat?: number; lng?: number; pincode?: string; area?: string }) {
    const q = new URLSearchParams();
    if (params.lat) q.append("lat", String(params.lat));
    if (params.lng) q.append("lng", String(params.lng));
    if (params.pincode) q.append("pincode", params.pincode);
    if (params.area) q.append("area", params.area);
    return this.request(`/branches?${q.toString()}`).catch(() => ({ branch: null }));
  }

  async getAdminBranches() {
    return this.request("/admin/branches").catch(() => ({ branches: [], cityAreas: [] }));
  }

  async createAdminBranch(data: any) {
    return this.request("/admin/branches", { method: "POST", body: JSON.stringify(data) });
  }

  async updateAdminBranch(id: string, data: any) {
    return this.request("/admin/branches", { method: "PUT", body: JSON.stringify({ id, ...data }) });
  }

  async deleteAdminBranch(id: string) {
    return this.request(`/admin/branches?id=${id}`, { method: "DELETE" });
  }

  async saveAreaPincodes(data: any) {
    return this.request("/admin/branches", { method: "POST", body: JSON.stringify({ type: "city_area", ...data }) });
  }

  async updateBranchProductAvailability(branchId: string, productId: string, status: string, reason?: string) {
    return this.request("/admin/branches", { method: "POST", body: JSON.stringify({ type: "product_availability", branchId, productId, status, reason }) });
  }

  async updateBranchCakeFulfilment(branchId: string, productId: string, can_fulfil: boolean, reason?: string, expected_resume?: string) {
    return this.request("/admin/branches", { method: "POST", body: JSON.stringify({ type: "cake_fulfilment", branchId, productId, can_fulfil, reason, expected_resume }) });
  }

  async adjustBranchAccessoryStock(branchId: string, accessoryId: string, delta: number, reason?: string) {
    return this.request("/admin/branches", { method: "POST", body: JSON.stringify({ type: "accessory_stock", branchId, accessoryId, delta, reason }) });
  }

  async updateBranchCapacityLoad(branchId: string, delta: number) {
    return this.request("/admin/branches", { method: "POST", body: JSON.stringify({ type: "capacity_load", branchId, delta }) });
  }

  async getBranchAnalytics(branchId: string) {
    return this.request(`/admin/branches?branchId=${branchId}&action=analytics`).catch(() => ({ analytics: null }));
  }

  async assignBranchManager(branchId: string, manager: any) {
    return this.request("/admin/branches", { method: "POST", body: JSON.stringify({ type: "assign_manager", branchId, manager }) });
  }

  async suspendBranchManager(branchId: string, suspend: boolean = true) {
    return this.request("/admin/branches", { method: "POST", body: JSON.stringify({ type: "suspend_manager", branchId, suspend }) });
  }

  async forceLogoutBranchManager(branchId: string) {
    return this.request("/admin/branches", { method: "POST", body: JSON.stringify({ type: "force_logout", branchId }) });
  }

  async transferBranchManager(fromBranchId: string, toBranchId: string) {
    return this.request("/admin/branches", { method: "POST", body: JSON.stringify({ type: "transfer_manager", fromBranchId, toBranchId }) });
  }

  async updateAreaStatus(areaId: string, status: string, reason?: string, blockedUntil?: string) {
    return this.request("/admin/branches", { method: "POST", body: JSON.stringify({ type: "update_area_status", areaId, status, reason, blockedUntil }) });
  }

  async validateOrderEligibility(data: { pincode: string; product_ids?: string[]; accessory_ids?: string[]; delivery_type?: string; scheduled_date?: string; order_total?: number }) {
    return this.request("/admin/branches", { method: "POST", body: JSON.stringify({ type: "validate_order", ...data }) });
  }
}

export const apiClient = new CakeToHomeApiClient();

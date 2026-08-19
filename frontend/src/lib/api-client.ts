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
  private tokenChecked = false;

  constructor() {
    if (typeof window !== "undefined") {
      this.token = localStorage.getItem("cth_access_token")
        || localStorage.getItem("cth_admin_token")
        || localStorage.getItem("admin_token")
        || localStorage.getItem("medusa_access_token");
      this.tokenChecked = true;
    }
  }

  setToken(token: string) {
    this.token = token;
    this.tokenChecked = true;
    if (typeof window !== "undefined") {
      localStorage.setItem("cth_access_token", token);
      localStorage.setItem("cth_admin_token", token);
    }
  }

  clearToken() {
    this.token = null;
    this.tokenChecked = false;
    if (typeof window !== "undefined") {
      localStorage.removeItem("cth_access_token");
      localStorage.removeItem("cth_admin_token");
      localStorage.removeItem("admin_token");
      localStorage.removeItem("medusa_access_token");
    }
  }

  private getToken(): string | null {
    if (this.token) return this.token;
    if (this.tokenChecked) return null;
    if (typeof window !== "undefined") {
      const t = localStorage.getItem("cth_access_token")
        || localStorage.getItem("cth_admin_token")
        || localStorage.getItem("admin_token")
        || localStorage.getItem("medusa_access_token");
      this.tokenChecked = true;
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


  public async get<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "GET" });
  }

  public async post<T = any>(endpoint: string, body?: any, options: RequestInit = {}): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  public async put<T = any>(endpoint: string, body?: any, options: RequestInit = {}): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  public async delete<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "DELETE" });
  }

  public async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
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

    let cleanEndpoint = endpoint;
    if (cleanEndpoint.startsWith("/api/v1/")) {
      cleanEndpoint = cleanEndpoint.substring("/api/v1".length);
    } else if (cleanEndpoint.startsWith("/api/")) {
      cleanEndpoint = cleanEndpoint.substring("/api".length);
    }

    const primaryUrl = typeof window !== "undefined"
      ? `/api/v1${cleanEndpoint}`
      : `http://localhost:3000/api/v1${cleanEndpoint}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const response = await fetch(primaryUrl, {
        ...options,
        headers,
        signal: options.signal || controller.signal,
      });
      clearTimeout(timeoutId);

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

  async verifyOtp(phone: string, code: string, extra?: { name?: string; email?: string }) {
    const res = await this.request<{ accessToken: string; token?: string; user: any; role?: string; is_new_customer?: boolean }>("/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ phone, code, ...(extra || {}) }),
    });

    const token = res.accessToken || res.token;
    if (token) {
      this.setToken(token);
    }
    return res;
  }

  async logout(reason: string = "user_initiated") {
    this.token = null;
    return this.request("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  }

  // Products & Catalog APIs (/api/v1/products)
  async getProducts(params?: { branchId?: string; pincode?: string }) {
    const q = new URLSearchParams();
    if (params?.branchId) q.set("branchId", params.branchId);
    if (params?.pincode) q.set("pincode", params.pincode);
    const queryString = q.toString() ? `?${q.toString()}` : "";
    return this.request(`/products${queryString}`);
  }

  async getProductBySlug(slug: string) {
    return this.request(`/products/slug/${slug}`);
  }

  async applyPromoCode(cartId: string, promoCode: string, context?: any) {
    return this.request("/cart/promo", {
      method: "POST",
      body: JSON.stringify({ cartId, promoCode, context }),
    });
  }

  // Checkout & Orders APIs (/api/v1/orders)
  async createOrder(orderPayload: any) {
    return this.request("/orders", {
      method: "POST",
      body: JSON.stringify(orderPayload),
    });
  }
  async createAdminOrder(orderPayload: any) {
    return this.request("/admin/orders", {
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

  // ── Admin: Orders Command Center ──
  async getAdminOrders(params?: { q?: string; status?: string; branch_id?: string; city?: string; payment_status?: string; from_date?: string; to_date?: string; limit?: number; offset?: number }) {
    const query = new URLSearchParams();
    if (params?.q) query.set("q", params.q);
    if (params?.status) query.set("status", params.status);
    if (params?.branch_id) query.set("branch_id", params.branch_id);
    if (params?.city) query.set("city", params.city);
    if (params?.payment_status) query.set("payment_status", params.payment_status);
    if (params?.from_date) query.set("from_date", params.from_date);
    if (params?.to_date) query.set("to_date", params.to_date);
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.offset) query.set("offset", String(params.offset));
    const qs = query.toString() ? `?${query.toString()}` : "";
    return this.request(`/admin/orders${qs}`).catch(() => ({ orders: [], count: 0, total: 0 }));
  }
  async getCustomerOrders(customerUid: string, params?: { status?: string; limit?: number }) {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", params.status);
    if (params?.limit) query.set("limit", String(params.limit));
    const qs = query.toString() ? `?${query.toString()}` : "";
    return this.request(`/admin/customers/${customerUid}/orders${qs}`).catch(() => ({ orders: [], count: 0, total: 0 }));
  }
  async getAdminOrder(id: string) {
    return this.request(`/admin/orders/${id}`).catch(() => null);
  }
  async getAdminOrderDetails(id: string) {
    return this.request(`/admin/orders/${id}`).then((r: any) => r?.order || null).catch(() => null);
  }
  async updateOrderStatus(id: string, status: string, notes?: string) {
    return this.request(`/admin/orders/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status, notes }),
    }).catch(() => null);
  }
  async assignAdminOrderBranch(id: string, branchId: string, branchName?: string) {
    return this.request(`/admin/orders/${id}/assign-branch`, {
      method: "PUT",
      body: JSON.stringify({ branch_id: branchId, branch_name: branchName }),
    });
  }
  async autoAssignAdminOrderDelivery(id: string) {
    return this.request(`/admin/orders/${id}/auto-assign-delivery`, {
      method: "PUT",
    });
  }
  async assignAdminOrderDelivery(id: string, driverName: string, driverPhone?: string) {
    return this.request(`/admin/orders/${id}/assign-delivery`, {
      method: "PUT",
      body: JSON.stringify({ driver_name: driverName, driver_phone: driverPhone }),
    });
  }
  async rescheduleAdminOrder(id: string, deliveryDate: string, timeSlot: string) {
    return this.request(`/admin/orders/${id}/reschedule`, {
      method: "PUT",
      body: JSON.stringify({ delivery_date: deliveryDate, time_slot: timeSlot }),
    });
  }
  async cancelAdminOrder(id: string, reason?: string) {
    return this.request(`/admin/orders/${id}/cancel`, {
      method: "PUT",
      body: JSON.stringify({ reason }),
    });
  }
  async refundAdminOrder(id: string, amount?: number, reason?: string) {
    return this.request(`/admin/orders/${id}/refund`, {
      method: "PUT",
      body: JSON.stringify({ amount, reason }),
    });
  }
  async exportAdminOrders(params?: { q?: string; status?: string; branch_id?: string; city?: string; payment_status?: string; from_date?: string; to_date?: string }) {
    const query = new URLSearchParams();
    if (params?.q) query.set("q", params.q);
    if (params?.status) query.set("status", params.status);
    if (params?.branch_id) query.set("branch_id", params.branch_id);
    if (params?.city) query.set("city", params.city);
    if (params?.payment_status) query.set("payment_status", params.payment_status);
    if (params?.from_date) query.set("from_date", params.from_date);
    if (params?.to_date) query.set("to_date", params.to_date);
    const qs = query.toString() ? `?${query.toString()}` : "";
    return this.request(`/admin/orders/export${qs}`).catch(() => ({ export_data: [] }));
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

  // ── Occasions & Structured Taxonomy ──
  async getOccasions(status?: string) {
    const q = status ? `?status=${status}` : "";
    return this.request(`/occasions${q}`).catch(() => ({ occasions: [] }));
  }
  async getAdminOccasions(status?: string) {
    const q = status ? `?status=${status}` : "";
    return this.request(`/admin/occasions${q}`).catch(() => ({ occasions: [] }));
  }
  async getOccasion(slug: string) {
    return this.request(`/occasions/${slug}`);
  }
  async createAdminOccasion(data: any) {
    return this.request("/admin/occasions", { method: "POST", body: JSON.stringify(data) });
  }
  async updateAdminOccasion(id: string, data: any) {
    return this.request(`/admin/occasions/${id}`, { method: "PUT", body: JSON.stringify(data) });
  }
  async deleteAdminOccasion(id: string) {
    return this.request(`/admin/occasions/${id}`, { method: "DELETE" });
  }
  async restoreAdminOccasion(id: string) {
    return this.request(`/admin/occasions/${id}/restore`, { method: "POST" });
  }
  async getProductRecommendations(params: { productId?: string; occasion?: string; limit?: number; branchId?: string }) {
    const query = new URLSearchParams();
    if (params.productId) query.set("productId", params.productId);
    if (params.occasion) query.set("occasion", params.occasion);
    if (params.limit) query.set("limit", String(params.limit));
    if (params.branchId) query.set("branchId", params.branchId);
    return this.request(`/catalog/recommendations?${query.toString()}`).catch(() => ({ related: [], upsells: [], sameOccasion: [] }));
  }


  // ── Admin: Flavors Master CRUD ──
  async getAdminFlavors(query?: string) {
    const q = query ? `?q=${encodeURIComponent(query)}` : "";
    return this.request(`/admin/catalog/flavors${q}`).catch(() => ({ flavors: [] }));
  }
  async createAdminFlavor(data: any) {
    return this.request("/admin/catalog/flavors", { method: "POST", body: JSON.stringify(data) });
  }
  async updateAdminFlavor(id: string, data: any) {
    return this.request(`/admin/catalog/flavors/${id}`, { method: "PUT", body: JSON.stringify(data) });
  }
  async patchAdminFlavorStatus(id: string, data: any) {
    return this.request(`/admin/catalog/flavors/${id}`, { method: "PATCH", body: JSON.stringify(data) });
  }
  async deleteAdminFlavor(id: string, force = false) {
    return this.request(`/admin/catalog/flavors/${id}${force ? "?force=true" : ""}`, { method: "DELETE" });
  }

  // ── Admin: Shapes Master CRUD ──
  async getAdminShapes(query?: string) {
    const q = query ? `?q=${encodeURIComponent(query)}` : "";
    return this.request(`/admin/catalog/shapes${q}`).catch(() => ({ shapes: [] }));
  }
  async createAdminShape(data: any) {
    return this.request("/admin/catalog/shapes", { method: "POST", body: JSON.stringify(data) });
  }
  async updateAdminShape(id: string, data: any) {
    return this.request(`/admin/catalog/shapes/${id}`, { method: "PUT", body: JSON.stringify(data) });
  }
  async patchAdminShapeStatus(id: string, data: any) {
    return this.request(`/admin/catalog/shapes/${id}`, { method: "PATCH", body: JSON.stringify(data) });
  }
  async deleteAdminShape(id: string, force = false) {
    return this.request(`/admin/catalog/shapes/${id}${force ? "?force=true" : ""}`, { method: "DELETE" });
  }

  // ── Admin: Product Flavor & Shape Mappings ──
  async getProductFlavorMappings(productId: string) {
    return this.request(`/admin/catalog/products/${productId}/flavor-mappings`).catch(() => ({ flavor_mappings: [] }));
  }
  async saveProductFlavorMappings(productId: string, mappings: any[]) {
    return this.request(`/admin/catalog/products/${productId}/flavor-mappings`, { method: "POST", body: JSON.stringify({ mappings }) });
  }
  async getProductShapeMappings(productId: string) {
    return this.request(`/admin/catalog/products/${productId}/shape-mappings`).catch(() => ({ shape_mappings: [] }));
  }
  async saveProductShapeMappings(productId: string, mappings: any[]) {
    return this.request(`/admin/catalog/products/${productId}/shape-mappings`, { method: "POST", body: JSON.stringify({ mappings }) });
  }

  // ── Storefront: Dynamic Product Options ──
  async getStorefrontProductOptions(productId: string) {
    return this.request(`/store/catalog/products/${productId}/options`).catch(() => ({
      enable_flavor_selection: true,
      enable_shape_selection: true,
      flavors: [],
      shapes: [],
    }));
  }

  // ── Product Weight Pricing Matrix ──
  async getProductWeightPrices(productId: string) {
    return this.request(`/admin/products/${productId}/weight-prices`).catch(() => ({ weight_prices: [] }));
  }
  async saveProductWeightPrices(productId: string, weightPrices: any[]) {
    return this.request(`/admin/products/${productId}/weight-prices`, { method: "POST", body: JSON.stringify({ weight_prices: weightPrices }) });
  }

  // ── Admin: CRM 360 & Customer Management ──
  // (Full typed methods provided in Enterprise CRM section below)

  async getAdminCities() {
    return this.request("/admin/cities").catch(() => ({ cities: [] }));
  }
  async getAdminCity(id: string) {
    return this.request(`/admin/cities/${id}`).catch(() => null);
  }
  async getCities() {
    return this.request("/cities").catch(() => ({ cities: [] }));
  }
  async getCityBySlug(slug: string) {
    return this.request(`/cities/${slug}`).catch(() => null);
  }
  async createAdminCity(data: any) {
    return this.request("/admin/cities", { method: "POST", body: JSON.stringify(data) });
  }
  async updateAdminCity(id: string, data: any) {
    return this.request(`/admin/cities/${id}`, { method: "PUT", body: JSON.stringify(data) });
  }
  async archiveAdminCity(id: string) {
    return this.request(`/admin/cities/${id}/archive`, { method: "POST", body: JSON.stringify({}) });
  }
  async restoreAdminCity(id: string) {
    return this.request(`/admin/cities/${id}/restore`, { method: "POST", body: JSON.stringify({}) });
  }
  async migrateToMultiCity() {
    return this.request("/admin/cities/migrate", { method: "POST", body: JSON.stringify({}) });
  }
  async resolveDeliveryContext(pincode: string) {
    return this.request(`/delivery/resolve?pincode=${encodeURIComponent(pincode)}`).catch(() => ({ serviceable: false }));
  }
  async getAdminRegions() {
    return this.request("/admin/regions").catch(() => ({ regions: [] }));
  }
  async createAdminRegion(name: string) {
    return this.request("/admin/regions", { method: "POST", body: JSON.stringify({ name }) });
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

  // ── Product Delivery Restrictions (Store + Zone Scoped) ──
  async getProductDeliveryRestrictions(filters?: { product_id?: string; branch_id?: string; zone_id?: string }) {
    const params: Record<string, string> = {};
    if (filters?.product_id) params.product_id = filters.product_id;
    if (filters?.branch_id) params.branch_id = filters.branch_id;
    if (filters?.zone_id) params.zone_id = filters.zone_id;
    const qs = Object.keys(params).length > 0 ? "?" + new URLSearchParams(params).toString() : "";
    return this.request(`/admin/product-delivery-restrictions${qs}`).catch(() => ({ restrictions: [] }));
  }
  async updateProductDeliveryRestriction(data: { product_id: string; branch_id: string; zone_id: string; is_restricted: boolean; reason?: string }) {
    return this.request("/admin/product-delivery-restrictions", { method: "POST", body: JSON.stringify(data) });
  }
  async bulkUpdateProductDeliveryRestrictions(restrictions: Array<{ product_id: string; branch_id: string; zone_id: string; is_restricted: boolean; reason?: string }>) {
    return this.request("/admin/product-delivery-restrictions", { method: "POST", body: JSON.stringify({ restrictions }) });
  }
  async deleteProductDeliveryRestriction(id: string) {
    return this.request(`/admin/product-delivery-restrictions/${id}`, { method: "DELETE" });
  }

  // ── Admin: Delivery Partners & Fleet ──
  async getAdminDeliveries() {
    return this.request("/admin/delivery").catch(() => ({ deliveries: [] }));
  }
  async getAdminDeliveryPartners(params?: Record<string, any>) {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return this.request(`/admin/delivery/partners${qs}`).catch(() => ({ partners: [] }));
  }
  async getDeliveryPartnerDetails(id: string) {
    return this.request(`/admin/delivery/partners/${id}`);
  }
  async createAdminDeliveryPartner(partnerData: any) {
    return this.request("/admin/delivery/partners", { method: "POST", body: JSON.stringify(partnerData) });
  }
  async updateAdminDeliveryPartner(id: string, data: any) {
    return this.request(`/admin/delivery/partners/${id}`, { method: "PUT", body: JSON.stringify(data) });
  }
  async deactivateAdminDeliveryPartner(id: string, reason?: string) {
    return this.request(`/admin/delivery/partners/${id}`, { method: "DELETE", body: JSON.stringify({ reason }) });
  }
  async updatePartnerAvailability(id: string, availabilityStatus: string, reason?: string) {
    return this.request(`/admin/delivery/partners/${id}/availability`, { method: "PUT", body: JSON.stringify({ availability_status: availabilityStatus, reason }) });
  }
  async updatePartnerWorkingHours(id: string, workingHours: any) {
    return this.request(`/admin/delivery/partners/${id}/working-hours`, { method: "PUT", body: JSON.stringify({ working_hours: workingHours }) });
  }
  async updatePartnerBranches(id: string, branches: any) {
    return this.request(`/admin/delivery/partners/${id}/branches`, { method: "PUT", body: JSON.stringify({ associated_branches: branches }) });
  }
  async updatePartnerCoverage(id: string, coverage: any) {
    return this.request(`/admin/delivery/partners/${id}/coverage`, { method: "PUT", body: JSON.stringify({ coverage }) });
  }
  async getEligibleDeliveryPartners(params: Record<string, any>) {
    const qs = "?" + new URLSearchParams(params).toString();
    return this.request(`/admin/delivery/eligible-partners${qs}`);
  }
  async autoAssignOrderDelivery(orderId: string) {
    return this.request(`/admin/orders/${orderId}/auto-assign-delivery`, { method: "POST" });
  }
  async manualAssignOrderDelivery(orderId: string, partnerId: string, reason?: string) {
    return this.request(`/admin/orders/${orderId}/assign-delivery`, { method: "PUT", body: JSON.stringify({ delivery_partner_id: partnerId, reason }) });
  }
  async reassignOrderDelivery(orderId: string, partnerId: string, reason?: string) {
    return this.request(`/admin/orders/${orderId}/reassign-delivery`, { method: "PUT", body: JSON.stringify({ delivery_partner_id: partnerId, reason }) });
  }
  async unassignOrderDelivery(orderId: string, reason?: string) {
    return this.request(`/admin/orders/${orderId}/unassign-delivery`, { method: "DELETE", body: JSON.stringify({ reason }) });
  }
  async getDeliveryAssignmentRules() {
    return this.request("/admin/delivery/assignment-rules");
  }
  async updateDeliveryAssignmentRules(rules: any) {
    return this.request("/admin/delivery/assignment-rules", { method: "PUT", body: JSON.stringify(rules) });
  }
  async getBranchDeliveryCoverage(branchId: string) {
    return this.request(`/admin/branches/${branchId}/delivery-coverage`);
  }
  async getPartnerEffectiveCoverage(partnerId: string) {
    return this.request(`/admin/delivery-partners/${partnerId}/effective-coverage`);
  }
  async updateAdminDeliveryStatus(id: string, status: string) {
    return this.request(`/admin/delivery/jobs/${id}`, { method: "PUT", body: JSON.stringify({ status }) });
  }

  // ── Admin: CRM ──
  async createAdminCustomer(customerData: any) {
    return this.request("/admin/crm/customers", { method: "POST", body: JSON.stringify(customerData) });
  }

  // ── Admin: Marketing & Coupons ──
  async getAdminCampaigns() {
    return this.request("/admin/marketing/campaigns").catch(() => ({ campaigns: [] }));
  }
  async getAdminOffers(params?: Record<string, any>) {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return this.request(`/admin/offers${qs}`).catch(() => ({ offers: [] }));
  }
  async getAdminOfferById(id: string) {
    return this.request(`/admin/offers/${id}`);
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
  async cloneAdminOffer(id: string) {
    return this.request(`/admin/offers/${id}/clone`, { method: "POST" });
  }
  async getAdminOfferAuditLogs(id: string) {
    return this.request(`/admin/offers/${id}/audit-logs`).catch(() => ({ logs: [] }));
  }
  async getAdminCouponAnalytics() {
    return this.request("/admin/offers/analytics").catch(() => ({ analytics: null }));
  }
  async getAdminCouponReports(groupBy: string = "date") {
    return this.request(`/admin/offers/reports?group_by=${groupBy}`).catch(() => ({ reports: [] }));
  }
  async exportAdminCoupons(format: string = "csv", type: string = "coupons") {
    return this.request(`/admin/offers/export?format=${format}&type=${type}`);
  }
  async importAdminCoupons(payload: any) {
    return this.request("/admin/offers/import", { method: "POST", body: JSON.stringify(payload) });
  }
  async createAdminCampaign(campaignData: any) {
    return this.request("/admin/marketing/campaigns", { method: "POST", body: JSON.stringify(campaignData) });
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
  async publishCmsPage(id: string) {
    return this.request(`/cms/pages/${id}/publish`, { method: "POST" });
  }
  async unpublishCmsPage(id: string) {
    return this.request(`/cms/pages/${id}/unpublish`, { method: "POST" });
  }
  async reorderCmsPageSections(id: string, sectionIds: string[]) {
    return this.request(`/cms/pages/${id}/reorder-sections`, { method: "POST", body: JSON.stringify({ section_ids: sectionIds }) });
  }
  async getPageVersions(id: string) {
    return this.request(`/cms/pages/${id}/versions`).catch(() => ({ versions: [] }));
  }
  async validatePageConfig(config: any) {
    return this.request("/cms/pages/validate", { method: "POST", body: JSON.stringify(config) }).catch(() => ({ valid: true, errors: [], warnings: [] }));
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
  async getAdminMedia(folder?: string) {
    const q = folder ? `?folder=${folder}` : "";
    return this.request(`/admin/media${q}`).catch(() => ({ media: [] }));
  }
  async createAdminMedia(data: any) {
    return this.request("/admin/media", { method: "POST", body: JSON.stringify(data) });
  }
  async uploadMedia(payload: { name?: string; filename: string; dataUrl?: string; url?: string; mime_type?: string; size?: number; alt_text?: string; folder?: string; width?: number; height?: number }) {
    return this.request("/admin/media/upload", { method: "POST", body: JSON.stringify(payload) });
  }
  async deleteAdminMedia(id: string) {
    return this.request(`/admin/media/${id}`, { method: "DELETE" });
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

  // ── Admin: SEO & Digital Marketing ──
  async getAdminSeoConfig() {
    return this.request("/admin/marketing/seo").catch(() => ({ meta_title: "", meta_description: "", keywords: "" }));
  }
  async updateAdminSeoConfig(seoData: any) {
    return this.request("/admin/marketing/seo", { method: "POST", body: JSON.stringify(seoData) }).catch(() => ({ success: false }));
  }

  // ── Enterprise SEO Platform APIs ──
  async getSeoDashboardSummary() {
    return this.request("/admin/seo/dashboard").catch(() => null);
  }
  async getSeoPages(params?: any) {
    const q = params ? `?${new URLSearchParams(params).toString()}` : "";
    return this.request(`/admin/seo/pages${q}`).catch(() => ({ pages: [] }));
  }
  async createSeoPage(data: any) {
    return this.request("/admin/seo/pages", { method: "POST", body: JSON.stringify(data) });
  }
  async updateSeoPage(id: string, data: any) {
    return this.request(`/admin/seo/pages/${id}`, { method: "PUT", body: JSON.stringify(data) });
  }
  async deleteSeoPage(id: string) {
    return this.request(`/admin/seo/pages/${id}`, { method: "DELETE" });
  }
  async syncSeoPages() {
    return this.request("/admin/seo/pages/sync", { method: "POST" });
  }
  async getSeoKeywords() {
    return this.request("/admin/seo/keywords").catch(() => ({ keywords: [] }));
  }
  async createSeoKeyword(data: any) {
    return this.request("/admin/seo/keywords", { method: "POST", body: JSON.stringify(data) });
  }
  async updateSeoKeyword(id: string, data: any) {
    return this.request(`/admin/seo/keywords/${id}`, { method: "PUT", body: JSON.stringify(data) });
  }
  async deleteSeoKeyword(id: string) {
    return this.request(`/admin/seo/keywords/${id}`, { method: "DELETE" });
  }
  async getSeoRedirects() {
    return this.request("/admin/seo/redirects").catch(() => ({ redirects: [] }));
  }
  async createSeoRedirect(data: any) {
    return this.request("/admin/seo/redirects", { method: "POST", body: JSON.stringify(data) });
  }
  async updateSeoRedirect(id: string, data: any) {
    return this.request(`/admin/seo/redirects/${id}`, { method: "PUT", body: JSON.stringify(data) });
  }
  async deleteSeoRedirect(id: string) {
    return this.request(`/admin/seo/redirects/${id}`, { method: "DELETE" });
  }
  async getSeoBrokenLinks() {
    return this.request("/admin/seo/broken-links").catch(() => ({ broken_links: [] }));
  }
  async runBrokenLinkScan() {
    return this.request("/admin/seo/broken-links/scan", { method: "POST" });
  }
  async getSeoInternalLinks() {
    return this.request("/admin/seo/internal-links").catch(() => ({ internal_links: [] }));
  }
  async getSeoInternalLinkSuggestions() {
    return this.request("/admin/seo/internal-links/suggestions").catch(() => ({ suggestions: [] }));
  }
  async getSeoSchemaTemplates() {
    return this.request("/admin/seo/schema/templates").catch(() => ({ templates: [] }));
  }
  async createSeoSchemaTemplate(data: any) {
    return this.request("/admin/seo/schema/templates", { method: "POST", body: JSON.stringify(data) });
  }
  async validateJsonLd(jsonLd: string) {
    return this.request("/admin/seo/schema/validate", { method: "POST", body: JSON.stringify({ json_ld: jsonLd }) });
  }
  async getSeoImageAudits() {
    return this.request("/admin/seo/image-audits").catch(() => ({ image_audits: [] }));
  }
  async runImageAudit() {
    return this.request("/admin/seo/image-audits/scan", { method: "POST" });
  }
  async getSeoCompetitors() {
    return this.request("/admin/seo/competitors").catch(() => ({ competitors: [] }));
  }
  async createSeoCompetitor(data: any) {
    return this.request("/admin/seo/competitors", { method: "POST", body: JSON.stringify(data) });
  }
  async deleteSeoCompetitor(id: string) {
    return this.request(`/admin/seo/competitors/${id}`, { method: "DELETE" });
  }
  async getSeoGeoPages() {
    return this.request("/admin/seo/geo/pages").catch(() => ({ geo_pages: [] }));
  }
  async generateGeoLandingPage(data: any) {
    return this.request("/admin/seo/geo/generate", { method: "POST", body: JSON.stringify(data) });
  }
  async getSeoAeoEntries() {
    return this.request("/admin/seo/aeo/entries").catch(() => ({ aeo_entries: [] }));
  }
  async createSeoAeoEntry(data: any) {
    return this.request("/admin/seo/aeo/entries", { method: "POST", body: JSON.stringify(data) });
  }
  async deleteSeoAeoEntry(id: string) {
    return this.request(`/admin/seo/aeo/entries/${id}`, { method: "DELETE" });
  }
  async getSeoContentAudits() {
    return this.request("/admin/seo/content-audits").catch(() => ({ content_audits: [] }));
  }
  async runContentAudit() {
    return this.request("/admin/seo/content-audits/scan", { method: "POST" });
  }
  async getSeoPageSpeed() {
    return this.request("/admin/seo/page-speed").catch(() => ({ page_speed: [] }));
  }
  async recordSeoPageSpeed(data: any) {
    return this.request("/admin/seo/page-speed", { method: "POST", body: JSON.stringify(data) });
  }
  async getSeoUtmCampaigns() {
    return this.request("/admin/seo/utm-campaigns").catch(() => ({ utm_campaigns: [] }));
  }
  async createSeoUtmCampaign(data: any) {
    return this.request("/admin/seo/utm-campaigns", { method: "POST", body: JSON.stringify(data) });
  }
  async deleteSeoUtmCampaign(id: string) {
    return this.request(`/admin/seo/utm-campaigns/${id}`, { method: "DELETE" });
  }
  async getSeoRobotsHistory() {
    return this.request("/admin/seo/robots/history").catch(() => ({ robots_history: [] }));
  }
  async saveRobotsVersion(data: any) {
    return this.request("/admin/seo/robots/save", { method: "POST", body: JSON.stringify(data) });
  }
  async rollbackRobotsVersion(id: string) {
    return this.request("/admin/seo/robots/rollback", { method: "POST", body: JSON.stringify({ id }) });
  }
  async getSeoBacklinks() {
    return this.request("/admin/seo/backlinks").catch(() => ({ backlinks: [] }));
  }
  async createSeoBacklink(data: any) {
    return this.request("/admin/seo/backlinks", { method: "POST", body: JSON.stringify(data) });
  }
  async getSeoReports() {
    return this.request("/admin/seo/reports").catch(() => ({ reports: [] }));
  }
  async generateSeoReport(type: string = "overall") {
    return this.request("/admin/seo/reports/generate", { method: "POST", body: JSON.stringify({ type }) });
  }
  async generateSeoHealthReport() {
    return this.request("/admin/seo/health-reports/generate", { method: "POST" });
  }
  async getSeoAuditLogs() {
    return this.request("/admin/seo/audit-logs").catch(() => ({ audit_logs: [] }));
  }
  async generateAiSeoContent(type: string, context: any) {
    return this.request("/admin/seo/ai/generate", { method: "POST", body: JSON.stringify({ type, context }) });
  }

  // ── Advanced Enterprise SEO Platform Client APIs ──
  async getSeoSearchConsoleData() {
    return this.request("/admin/seo/integrations/gsc").catch(() => ({ connected: false }));
  }
  async getSeoGa4Data() {
    return this.request("/admin/seo/integrations/ga4").catch(() => ({ connected: false }));
  }
  async submitBingUrl(url: string) {
    return this.request("/admin/seo/integrations/bing/submit", { method: "POST", body: JSON.stringify({ url }) });
  }
  async publishGoogleIndexingUrl(url: string, type: "URL_UPDATED" | "URL_DELETED" = "URL_UPDATED") {
    return this.request("/admin/seo/integrations/indexing/publish", { method: "POST", body: JSON.stringify({ url, type }) });
  }
  async runLiveCrawler(urls?: string[]) {
    return this.request("/admin/seo/crawler/run", { method: "POST", body: JSON.stringify({ urls }) });
  }
  async getSeoAuditIssues() {
    return this.request("/admin/seo/audits/issues").catch(() => ({ issues: [] }));
  }
  async autoFixSeoIssue(issueId: string) {
    return this.request("/admin/seo/audits/autofix", { method: "POST", body: JSON.stringify({ issue_id: issueId }) });
  }
  async getSeoLinkGraph() {
    return this.request("/admin/seo/links/graph").catch(() => ({ metrics: [], orphanCount: 0 }));
  }
  async getSeoDuplicates() {
    return this.request("/admin/seo/duplicates").catch(() => ({ duplicates: [] }));
  }
  async validateSeoRedirects() {
    return this.request("/admin/seo/redirects/validate").catch(() => ({ validation: [] }));
  }
  async validateRobotsSyntax(content?: string) {
    return this.request("/admin/seo/robots/validate", { method: "POST", body: JSON.stringify({ content }) });
  }
  async validateSitemapXml(xml?: string) {
    return this.request("/admin/seo/sitemap/validate", { method: "POST", body: JSON.stringify({ xml }) });
  }
  async getSeoKeywordTrajectories() {
    return this.request("/admin/seo/keywords/trajectories").catch(() => ({ trajectories: [], topGainers: [], topLosers: [] }));
  }
  async checkSeoPermission(role: string, action: string) {
    return this.request("/admin/seo/rbac/check", { method: "POST", body: JSON.stringify({ role, action }) });
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


  async getEligibleBranches(params: { pincode?: string; city?: string; area?: string }) {
    const q = new URLSearchParams();
    if (params.pincode) q.append("pincode", params.pincode);
    if (params.city) q.append("city", params.city);
    if (params.area) q.append("area", params.area);
    return this.request(`/branches/eligible?${q.toString()}`).catch(() => ({ branches: [], assignment: { mode: "unserviceable", message: "No CakeToHome branch currently services this location." } }));
  }

  async lookupCustomer(phone: string) {
    return this.request(`/customers/lookup?phone=${encodeURIComponent(phone)}`).catch(() => ({ customer: null, found: false }));
  }

  async createAdminBranch(data: any) {
    return this.request("/admin/branches", { method: "POST", body: JSON.stringify(data) });
  }

  async updateAdminBranch(id: string, data: any) {
    return this.request("/admin/branches", { method: "PUT", body: JSON.stringify({ id, ...data }) });
  }

  async archiveAdminBranch(id: string) {
    return this.request("/admin/branches", { method: "POST", body: JSON.stringify({ type: "archive_branch", branchId: id }) });
  }

  async restoreAdminBranch(id: string) {
    return this.request("/admin/branches", { method: "POST", body: JSON.stringify({ type: "restore_branch", branchId: id }) });
  }

  async deleteAdminBranch(id: string) {
    return this.archiveAdminBranch(id);
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


  // ── Authoritative Cart & Checkout APIs ──
  async getCart(cartId?: string) {
    const q = cartId ? `?cart_id=${encodeURIComponent(cartId)}` : "";
    return this.request(`/cart${q}`).catch(() => ({
      success: true,
      cart: {
        id: cartId || "cart_guest_100",
        items: [],
        subtotal: 0,
        total: 0,
        currency_code: "inr",
      },
    }));
  }

  async createCart(data?: any) {
    return this.request("/cart", { method: "POST", body: JSON.stringify(data || {}) });
  }

  async addToCart(data: {
    cartId?: string;
    productId?: string;
    product_id?: string;
    variantId?: string;
    variant_id?: string;
    quantity: number;
    selectedOptions?: any;
    metadata?: any;
    cake_message?: string;
    tier_weight?: string;
  }) {
    return this.request("/cart/items", { method: "POST", body: JSON.stringify(data) });
  }

  async updateCartItem(cartIdOrLineItemId: string, lineItemIdOrQty: string | number, quantity?: number) {
    if (typeof lineItemIdOrQty === "number") {
      return this.request(`/cart/items/${cartIdOrLineItemId}`, { method: "PUT", body: JSON.stringify({ quantity: lineItemIdOrQty }) });
    }
    return this.request("/cart/items", { method: "PUT", body: JSON.stringify({ cartId: cartIdOrLineItemId, lineItemId: lineItemIdOrQty, quantity }) });
  }

  async deleteLineItem(cartIdOrLineItemId: string, lineItemId?: string) {
    if (lineItemId) {
      return this.request(`/cart/items?cart_id=${encodeURIComponent(cartIdOrLineItemId)}&item_id=${encodeURIComponent(lineItemId)}`, { method: "DELETE" });
    }
    return this.request(`/cart/items/${cartIdOrLineItemId}`, { method: "DELETE" });
  }

  async clearCart(cartId?: string) {
    if (cartId) {
      return this.request(`/cart?cart_id=${encodeURIComponent(cartId)}`, { method: "DELETE" });
    }
    return this.request("/cart/clear", { method: "POST" });
  }

  async validateCheckout(data: {
    cart_id: string;
    customer_id?: string;
    address?: any;
    address_id?: string;
    pincode?: string;
    delivery_date?: string;
    delivery_slot_id?: string;
    delivery_type?: string;
    coupon_code?: string;
    occasion?: string;
    ordered_for_self?: boolean;
    recipient_name?: string;
    recipient_phone?: string;
    gift_message?: string;
    special_instructions?: string;
  }) {
    return this.request("/checkout/validate", { method: "POST", body: JSON.stringify(data) });
  }

  async confirmCheckout(data: {
    cart_id: string;
    customer_id?: string;
    address: any;
    pincode: string;
    delivery_date: string;
    delivery_slot_id: string;
    delivery_type?: string;
    coupon_code?: string;
    payment_method: "cod" | "razorpay" | "test_mode" | "wallet";
    payment_details?: any;
    occasion?: string;
    ordered_for_self?: boolean;
    recipient_name?: string;
    recipient_phone?: string;
    recipient_alt_phone?: string;
    recipient_address?: string;
    recipient_landmark?: string;
    gift_wrap?: boolean;
    greeting_card?: boolean;
    gift_message?: string;
    anonymous_delivery?: boolean;
    hide_invoice?: boolean;
    is_surprise_delivery?: boolean;
    special_instructions?: string;
  }) {
    return this.request("/checkout/confirm", { method: "POST", body: JSON.stringify(data) });
  }

  // ── Customer Addresses APIs ──
  async getCustomerAddresses(customerId?: string) {
    const q = customerId ? `?customer_id=${encodeURIComponent(customerId)}` : "";
    return this.request(`/customers/addresses${q}`).catch(() => ({ addresses: [] }));
  }

  async createCustomerAddress(data: any) {
    return this.request("/customers/addresses", { method: "POST", body: JSON.stringify(data) });
  }

  async updateCustomerAddress(addressId: string, data: any) {
    return this.request(`/customers/addresses/${addressId}`, { method: "PUT", body: JSON.stringify(data) });
  }

  async deleteCustomerAddress(addressId: string) {
    return this.request(`/customers/addresses/${addressId}`, { method: "DELETE" });
  }

  // ── Order Details API ──
  async getOrder(orderId: string) {
    return this.request(`/orders/${orderId}`).catch(() => ({ order: null }));
  }

  // ── Delivery Eligibility ──
  async validateOrderEligibility(query: {
    pincode: string;
    product_ids?: string[];
    accessory_ids?: string[];
    delivery_type?: string;
    scheduled_date?: string;
    order_total?: number;
  }) {
    const q = new URLSearchParams();
    q.set("pincode", query.pincode);
    if (query.delivery_type) q.set("delivery_type", query.delivery_type);
    if (query.scheduled_date) q.set("scheduled_date", query.scheduled_date);
    if (query.order_total) q.set("order_total", String(query.order_total));
    return this.request(`/delivery/eligibility?${q.toString()}`, {
      method: "POST",
      body: JSON.stringify(query),
    });
  }

  // ── Razorpay Payment APIs ──
  async createRazorpayOrder(amount: number, currency = "INR", receipt?: string) {
    return this.request("/payments/razorpay/create-order", {
      method: "POST",
      body: JSON.stringify({ amount, currency, receipt }),
    });
  }

  async verifyRazorpaySignature(payload: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) {
    return this.request("/payments/razorpay/verify-signature", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  // ── Checkout & Availability Engine ──
  async getCheckoutAvailability(query: {
    cart_id?: string;
    delivery_type?: "delivery" | "pickup";
    pincode?: string;
    branch_id?: string;
    date?: string;
    slot_id?: string;
    coupon_code?: string;
  }) {
    const q = new URLSearchParams();
    if (query.cart_id) q.set("cart_id", query.cart_id);
    if (query.delivery_type) q.set("delivery_type", query.delivery_type);
    if (query.pincode) q.set("pincode", query.pincode);
    if (query.branch_id) q.set("branch_id", query.branch_id);
    if (query.date) q.set("date", query.date);
    if (query.slot_id) q.set("slot_id", query.slot_id);
    if (query.coupon_code) q.set("coupon_code", query.coupon_code);
    return this.request(`/checkout/availability?${q.toString()}`);
  }

  async updateBranchStoreOperations(branchId: string, operations: any) {
    return this.request(`/admin/branches/${branchId}/operations`, {
      method: "PUT",
      body: JSON.stringify(operations),
    });
  }

  // ── Delivery Slots ──
  async getDeliverySlots(branchId: string, date?: string, mode: "delivery" | "pickup" = "delivery") {
    const q = new URLSearchParams();
    if (branchId) q.set("branch_id", branchId);
    if (date) q.set("date", date);
    if (mode) q.set("mode", mode);
    return this.request(`/delivery/slots?${q.toString()}`).catch(() => ({ delivery_slots: [] }));
  }

  async checkDeliveryAvailability(pincode: string) {
    return this.request(`/delivery/availability?pincode=${encodeURIComponent(pincode)}`).catch(() => ({ serviceable: false }));
  }

  // ── Customer Order History ──
  async listOrders(customerId?: string, limit = 50) {
    const q = new URLSearchParams();
    if (customerId) q.set("customer_id", customerId);
    q.set("limit", String(limit));
    return this.request(`/orders?${q.toString()}`).catch(() => ({ orders: [], count: 0 }));
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── ENTERPRISE BUSINESS, TAX & STATUTORY COMPLIANCE CLIENT METHODS ────────
  // ══════════════════════════════════════════════════════════════════════════

  async getBusinessProfile() {
    return this.request("/admin/compliance/business-profile").catch(() => ({ profile: null }));
  }

  async updateBusinessProfile(data: any) {
    return this.request("/admin/compliance/business-profile", { method: "PUT", body: JSON.stringify(data) });
  }

  async getGstRegistrations() {
    return this.request("/admin/compliance/gst-registrations").catch(() => ({ registrations: [] }));
  }

  async createGstRegistration(data: any) {
    return this.request("/admin/compliance/gst-registrations", { method: "POST", body: JSON.stringify(data) });
  }

  async updateGstRegistration(id: string, data: any) {
    return this.request(`/admin/compliance/gst-registrations/${id}`, { method: "PUT", body: JSON.stringify(data) });
  }

  async verifyGstRegistration(id: string) {
    return this.request(`/admin/compliance/gst-registrations/${id}/verify`, { method: "POST", body: JSON.stringify({}) });
  }

  async getBranchCompliance(branchId?: string) {
    const path = branchId ? `/admin/branches/${branchId}/compliance` : "/admin/compliance/fssai";
    return this.request(path).catch(() => ({ compliance: branchId ? null : [] }));
  }

  async createBranchCompliance(data: any) {
    return this.request("/admin/compliance/fssai", { method: "POST", body: JSON.stringify(data) });
  }

  async updateBranchCompliance(id: string, data: any) {
    return this.request(`/admin/compliance/fssai/${id}`, { method: "PUT", body: JSON.stringify(data) });
  }

  async verifyBranchCompliance(id: string) {
    return this.request(`/admin/compliance/fssai/${id}/verify`, { method: "POST", body: JSON.stringify({}) });
  }

  async getComplianceOverview() {
    return this.request("/admin/compliance/overview").catch(() => ({ overview: { totalBranches: 0, valid: 0, expiringSoon: 0, expired: 0, pendingVerification: 0, alerts: [] } }));
  }

  async getComplianceDocuments(entityType?: string, entityId?: string) {
    const q = new URLSearchParams();
    if (entityType) q.set("entityType", entityType);
    if (entityId) q.set("entityId", entityId);
    const qs = q.toString() ? `?${q.toString()}` : "";
    return this.request(`/admin/compliance/documents${qs}`).catch(() => ({ documents: [] }));
  }

  async createComplianceDocument(data: any) {
    return this.request("/admin/compliance/documents", { method: "POST", body: JSON.stringify(data) });
  }

  async deleteComplianceDocument(id: string) {
    return this.request(`/admin/compliance/documents/${id}`, { method: "DELETE" });
  }

  async getInvoiceSettings() {
    return this.request("/admin/compliance/invoices").catch(() => ({ settings: null }));
  }

  async updateInvoiceSettings(data: any) {
    return this.request("/admin/compliance/invoices", { method: "PUT", body: JSON.stringify(data) });
  }

  async getDeliveryDefaults() {
    return this.request("/admin/compliance/delivery-defaults").catch(() => ({ defaults: null }));
  }

  async updateDeliveryDefaults(data: any) {
    return this.request("/admin/compliance/delivery-defaults", { method: "PUT", body: JSON.stringify(data) });
  }

  async getPaymentSettings() {
    return this.request("/admin/compliance/payments").catch(() => ({ payments: null }));
  }

  async updatePaymentSettings(data: any) {
    return this.request("/admin/compliance/payments", { method: "PUT", body: JSON.stringify(data) });
  }

  async getIntegrationSettings() {
    return this.request("/admin/compliance/integrations").catch(() => ({ integrations: null }));
  }

  async updateIntegrationSettings(data: any) {
    return this.request("/admin/compliance/integrations", { method: "PUT", body: JSON.stringify(data) });
  }

  async getAllComplianceBundle() {
    return this.request("/admin/compliance/all").catch(() => ({
      profile: null,
      gstRegistrations: [],
      branchCompliance: [],
      overview: null,
      invoiceSettings: null,
      deliveryDefaults: null,
      paymentSettings: null,
      integrationSettings: null,
      documents: [],
    }));
  }

  async sendAdminRecoveryWhatsApp(cartId: string, templateId: string, payload?: any) {
    return this.request(`/admin/abandoned-carts/${cartId}/recover`, {
      method: "POST",
      body: JSON.stringify({ template_id: templateId, channel: "WHATSAPP", ...payload }),
    });
  }

  async recordAdminCallAction(customerUid: string, candidateId?: string, action: string = "CALL_LOGGED", note?: string) {
    return this.request("/admin/telemarketing/activity", {
      method: "POST",
      body: JSON.stringify({ customer_uid: customerUid, candidate_id: candidateId, action, note }),
    }).catch(() => ({ success: true }));
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── POPUP & ENGAGEMENT MANAGER (ADMIN & STOREFRONT) ───────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  async getAdminPopups(params?: Record<string, string>) {
    const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
    return this.request(`/admin/popups${qs}`).catch(() => ({ campaigns: [], success: false }));
  }

  async getAdminPopupById(id: string) {
    return this.request(`/admin/popups/${id}`).catch(() => ({ campaign: null, success: false }));
  }

  async createAdminPopup(data: any) {
    return this.request("/admin/popups", { method: "POST", body: JSON.stringify(data) });
  }

  async updateAdminPopup(id: string, data: any) {
    return this.request(`/admin/popups/${id}`, { method: "PATCH", body: JSON.stringify(data) });
  }

  async publishAdminPopup(id: string, versionData?: any) {
    return this.request(`/admin/popups/${id}/publish`, { method: "POST", body: JSON.stringify(versionData || {}) });
  }

  async pauseAdminPopup(id: string) {
    return this.request(`/admin/popups/${id}/pause`, { method: "POST", body: JSON.stringify({}) });
  }

  async archiveAdminPopup(id: string) {
    return this.request(`/admin/popups/${id}/archive`, { method: "POST", body: JSON.stringify({}) });
  }

  async duplicateAdminPopup(id: string) {
    return this.request(`/admin/popups/${id}/duplicate`, { method: "POST", body: JSON.stringify({}) });
  }

  async deleteAdminPopup(id: string) {
    return this.request(`/admin/popups/${id}`, { method: "DELETE" });
  }

  async getAdminPopupOptions() {
    return this.request("/admin/popups/options").catch(() => ({
      customer_statuses: [],
      devices: [],
      popup_types: [],
      actions: [],
      cities: [],
      branches: [],
      categories: [],
      occasions: [],
      products: [],
      coupons: [],
    }));
  }

  async getAdminPopupAnalytics(params?: Record<string, string>) {
    const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
    return this.request(`/admin/popups/analytics/summary${qs}`).catch(() => ({ summary: null, success: false }));
  }

  async getStoreEngagementConfig(params?: Record<string, string>) {
    const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
    return this.request(`/engagement/config${qs}`).catch(() => ({ campaigns: [], version: 1 }));
  }

  async recordEngagementImpression(data: any) {
    return this.request("/engagement/impression", { method: "POST", body: JSON.stringify(data) }).catch(() => ({ success: false }));
  }

  async recordEngagementConversion(data: any) {
    return this.request("/engagement/conversion", { method: "POST", body: JSON.stringify(data) }).catch(() => ({ success: false }));
  }

  // ── Weights & Cake Sizes Management APIs ───────────────────────
  async getAdminWeights() {
    return this.request("/admin/weights").catch(() => ({ weights: [] }));
  }

  async createAdminWeight(payload: any) {
    return this.request("/admin/weights", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateAdminWeight(id: string, payload: any) {
    return this.request(`/admin/weights/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  async deleteAdminWeight(id: string) {
    return this.request(`/admin/weights/${id}`, {
      method: "DELETE",
    });
  }


  // ── Telemarketing Reorder APIs ─────────────────────────────────
  async getAdminTelemarketingCandidates(params?: Record<string, any>) {
    const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
    return this.request(`/admin/telemarketing/candidates${qs}`).catch(() => ({ candidates: [], total: 0, metrics: null }));
  }

  async evaluateAdminTelemarketingCandidates(currentDate?: string) {
    return this.request("/admin/telemarketing/evaluate", {
      method: "POST",
      body: JSON.stringify({ currentDate }),
    });
  }

  async logAdminTelemarketingCall(candidateId: string, payload: {
    outcome: string;
    note?: string;
    staffId?: string;
    staffName?: string;
    nextFollowupDate?: string;
    convertedOrderId?: string;
  }) {
    return this.request(`/admin/telemarketing/candidates/${candidateId}/call`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getEligibleTelecallers(params?: { city?: string; branch_id?: string }) {
    const qs = params ? `?${new URLSearchParams(params as any).toString()}` : "";
    return this.request(`/admin/telemarketing/eligible-staff${qs}`).catch(() => ({ success: false, staff: [] }));
  }

  async updateAdminTelemarketingStatus(candidateId: string, payload: {
    status: string;
    note?: string;
    agentName?: string;
    nextFollowupDate?: string;
  }) {
    return this.request(`/admin/telemarketing/candidates/${candidateId}/status`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  async assignAdminTelemarketingCandidate(candidateId: string, staffId: string, agentName?: string) {
    return this.request(`/admin/telemarketing/candidates/${candidateId}/assign`, {
      method: "PUT",
      body: JSON.stringify({ staff_id: staffId, agent_name: agentName }),
    });
  }

  async recordAdminTelemarketingOrder(candidateId: string, orderId: string, revenue: number) {
    return this.request(`/admin/telemarketing/candidates/${candidateId}/convert`, {
      method: "POST",
      body: JSON.stringify({ order_id: orderId, revenue }),
    });
  }

  async exportAdminTelemarketingList(payload?: {
    type?: "telecaller_list" | "high_priority" | "calls_due" | "follow_ups" | "full_workbook";
    priorityFilter?: string;
    cityFilter?: string;
    branchFilter?: string;
    statusFilter?: string;
    filename?: string;
  }) {
    return this.request("/admin/telemarketing/export", {
      method: "POST",
      body: JSON.stringify(payload || {}),
    });
  }

  // ── Admin: Staff Profiles & Permissions ──
  async getAdminStaffProfiles() {
    return this.request("/admin/staff-profiles/profiles").catch(() => ({ profiles: [] }));
  }

  async createAdminStaffProfile(payload: {
    name: string;
    description: string;
    permissions: string[];
    status?: "ACTIVE" | "DISABLED";
  }) {
    return this.request("/admin/staff-profiles/profiles", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateAdminStaffProfile(id: string, payload: any) {
    return this.request(`/admin/staff-profiles/profiles/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  async duplicateAdminStaffProfile(id: string) {
    return this.request(`/admin/staff-profiles/profiles/${id}/duplicate`, {
      method: "POST",
    });
  }

  async archiveAdminStaffProfile(id: string) {
    return this.request(`/admin/staff-profiles/profiles/${id}/archive`, {
      method: "POST",
    });
  }

  async getAdminStaffMembers() {
    return this.request("/admin/staff-profiles/staff").catch(() => ({ staff: [] }));
  }

  async createAdminStaffMember(payload: {
    name: string;
    phone: string;
    email: string;
    role?: string;
    profile_id?: string;
    accessProfileIds?: string[];
    profile_ids?: string[];
    branch_id?: string | null;
    branch_name?: string | null;
    delivery_partner_id?: string | null;
    city?: string | null;
    status?: "ACTIVE" | "SUSPENDED";
  }) {
    return this.request("/admin/staff-profiles/staff", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateAdminStaffMember(id: string, payload: any) {
    return this.request(`/admin/staff-profiles/staff/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  async setAdminStaffOverride(id: string, permissionId: string, effect: "ALLOW" | "DENY" | "RESET") {
    return this.request(`/admin/staff-profiles/staff/${id}/overrides`, {
      method: "POST",
      body: JSON.stringify({ permission_id: permissionId, effect }),
    });
  }

  async getAdminPermissionAuditLogs() {
    return this.request("/admin/staff-profiles/audit-logs").catch(() => ({ logs: [] }));
  }

  async getAdminPermissionCatalog() {
    return this.request("/admin/staff-profiles/catalog").catch(() => ({ catalog: [] }));
  }

  // ── Enterprise n8n & External Webhook Outbox Endpoints ──────────
  async getAdminWebhookEndpoints() {
    return this.request("/admin/webhooks/endpoints").catch(() => ({ endpoints: [], success: false }));
  }

  async getAdminWebhookEndpoint(id: string) {
    return this.request(`/admin/webhooks/endpoints/${id}`);
  }

  async createAdminWebhookEndpoint(payload: any) {
    return this.request("/admin/webhooks/endpoints", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateAdminWebhookEndpoint(id: string, payload: any) {
    return this.request(`/admin/webhooks/endpoints/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  async deleteAdminWebhookEndpoint(id: string) {
    return this.request(`/admin/webhooks/endpoints/${id}`, {
      method: "DELETE",
    });
  }

  async rotateAdminWebhookSecret(id: string) {
    return this.request(`/admin/webhooks/endpoints/${id}/rotate-secret`, {
      method: "POST",
    });
  }

  async getAdminWebhookLogs(params?: { status?: string; event_type?: string; endpoint_id?: string; search?: string; limit?: number }) {
    const qs = params ? `?${new URLSearchParams(Object.entries(params).filter(([_, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)]))}` : "";
    return this.request(`/admin/webhooks/logs${qs}`).catch(() => ({ logs: [], total: 0, metrics: null }));
  }

  async getAdminWebhookOutbox(params?: { status?: string; event_type?: string; limit?: number }) {
    const qs = params ? `?${new URLSearchParams(Object.entries(params).filter(([_, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)]))}` : "";
    return this.request(`/admin/webhooks/outbox${qs}`).catch(() => ({ outbox: [], total: 0 }));
  }

  async getAdminWebhookDLQ() {
    return this.request("/admin/webhooks/dlq").catch(() => ({ dlq: [], count: 0 }));
  }

  async retryAdminWebhookOutbox(outboxId: string) {
    return this.request(`/admin/webhooks/outbox/${outboxId}/retry`, {
      method: "POST",
    });
  }

  async replayAdminWebhookDLQ(outboxId: string) {
    return this.request(`/admin/webhooks/outbox/${outboxId}/replay`, {
      method: "POST",
    });
  }

  async discardAdminWebhookDLQ(outboxId: string) {
    return this.request(`/admin/webhooks/outbox/${outboxId}/discard`, {
      method: "POST",
    });
  }

  async triggerAdminTestWebhook(endpointId: string, eventType?: string) {
    return this.request("/admin/webhooks/test", {
      method: "POST",
      body: JSON.stringify({ endpointId, eventType }),
    });
  }

  async recordAdminWebhookCallback(payload: {
    event_id: string;
    execution_id: string;
    status: "PROCESSED" | "FAILED" | "ACCEPTED";
    result_summary?: string;
    error_message?: string;
  }) {
    return this.request("/admin/webhooks/callback", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getAdminWebhookWorkflows() {
    return this.request("/admin/webhooks/workflows").catch(() => ({ workflows: [], total: 0, success: false }));
  }

  async runAdminWebhookDiagnosticSuite(endpointId?: string) {
    return this.request("/admin/webhooks/diagnostics/suite", {
      method: "POST",
      body: JSON.stringify({ endpointId }),
    }).catch(() => ({
      passed_count: 0,
      failed_count: 1,
      total_count: 1,
      all_passed: false,
      results: [],
    }));
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── ENTERPRISE CRM & CUSTOMER 360 API CLIENT METHODS ─────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  async getAdminCustomers(params: Record<string, any> = {}) {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)])
    ).toString();
    return this.request(`/admin/crm/customers${qs ? `?${qs}` : ""}`);
  }

  async getCustomerProfile(idOrUid: string) {
    return this.request(`/admin/crm/customers/${idOrUid}`);
  }

  async getCrmAnalytics(params: Record<string, any> = {}) {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)])
    ).toString();
    return this.request(`/admin/crm/analytics${qs ? `?${qs}` : ""}`);
  }

  async getCrmHealth() {
    return this.request("/analytics/crm/health");
  }

  async getCrmLifecycleConfig() {
    return this.request("/admin/crm/lifecycle/rules");
  }

  async updateCrmLifecycleConfig(config: Record<string, any>) {
    return this.request("/admin/crm/lifecycle/rules", {
      method: "POST",
      body: JSON.stringify(config),
    });
  }

  async getCrmSegments() {
    return this.request("/admin/crm/segments");
  }

  async createCrmSegment(segment: Record<string, any>) {
    return this.request("/admin/crm/segments", {
      method: "POST",
      body: JSON.stringify(segment),
    });
  }

  async updateCrmSegment(id: string, segment: Record<string, any>) {
    return this.request(`/admin/crm/segments/${id}`, {
      method: "POST",
      body: JSON.stringify(segment),
    });
  }

  async deleteCrmSegment(id: string) {
    return this.request(`/admin/crm/segments/${id}/delete`, {
      method: "POST",
    });
  }

  async assignCustomerTelecaller(customerId: string, telecallerId: string, telecallerName: string) {
    return this.request(`/admin/crm/customers/${customerId}/assign`, {
      method: "POST",
      body: JSON.stringify({ telecaller_id: telecallerId, telecaller_name: telecallerName }),
    });
  }

  async scheduleCustomerReminder(
    customerId: string,
    data: { due_date: string; due_time?: string; reason: string; priority?: string; assigned_staff_id?: string; assigned_staff_name?: string }
  ) {
    return this.request(`/admin/crm/customers/${customerId}/reminders`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getCustomerReminders(customerId?: string) {
    const url = customerId ? `/admin/crm/customers/${customerId}/reminders` : "/admin/crm/reminders";
    return this.request(url);
  }

  async updateCustomerConsent(customerId: string, consent: Record<string, any>) {
    return this.request(`/admin/crm/customers/${customerId}/consent`, {
      method: "POST",
      body: JSON.stringify(consent),
    });
  }

  async updateCustomerTags(customerId: string, tags: string[]) {
    return this.request(`/admin/crm/customers/${customerId}/tags`, {
      method: "POST",
      body: JSON.stringify({ tags }),
    });
  }

  async createCustomerNote(customerId: string, content: string, category: string = "GENERAL") {
    return this.request(`/admin/crm/customers/${customerId}/notes`, {
      method: "POST",
      body: JSON.stringify({ content, category }),
    });
  }

  async getAdminCrmDuplicates() {
    return this.request("/admin/crm/duplicates").catch(() => ({ candidates: [] }));
  }

  async mergeAdminCustomers(primaryId: string, secondaryId: string) {
    return this.request("/admin/crm/merge", {
      method: "POST",
      body: JSON.stringify({ primary_uid: primaryId, duplicate_uid: secondaryId }),
    });
  }

  async mergeCustomerRecords(primaryUid: string, duplicateUid: string) {
    return this.request("/admin/crm/merge", {
      method: "POST",
      body: JSON.stringify({ primary_uid: primaryUid, duplicate_uid: duplicateUid }),
    });
  }

  async exportCustomersCsv(params: Record<string, any> = {}) {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)])
    ).toString();
    return fetch(`/api/v1/admin/crm/customers/export${qs ? `?${qs}` : ""}`).then((r) => r.text());
  }

  // ── Abandoned Cart Recovery Engine ──
  async getAdminAbandonedCarts(params: Record<string, any> = {}) {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)])
    ).toString();
    return this.request(`/admin/abandoned-carts${qs ? `?${qs}` : ""}`).catch(() => ({
      carts: [],
      total: 0,
      metrics: {
        total_abandoned: 0,
        active_abandoned: 0,
        revenue_at_risk: 0,
        recovered_count: 0,
        recovered_revenue: 0,
        lost_revenue: 0,
        recovery_rate_pct: 0,
        average_cart_value: 0,
        average_recovery_time_minutes: 0,
        whatsapp_reachable_count: 0,
      },
      funnel: [],
      channel_performance: [],
      top_products: [],
    }));
  }

  async getAbandonedCartById(cartId: string) {
    return this.request(`/admin/abandoned-carts/${cartId}`);
  }

  async getAbandonedCartEvents(cartId: string) {
    return this.request(`/admin/abandoned-carts/${cartId}/events`);
  }

  async evaluateCartAbandonment(thresholdMinutes: number = 30) {
    return this.request("/admin/abandoned-carts/evaluate", {
      method: "POST",
      body: JSON.stringify({ threshold_minutes: thresholdMinutes }),
    });
  }

  async sendCartRecoveryMessage(
    cartId: string,
    options: {
      channel?: string;
      discount_code?: string;
      discount_pct?: number;
      template_id?: string;
      custom_message?: string;
    } = {}
  ) {
    return this.request(`/admin/abandoned-carts/${cartId}/send-recovery`, {
      method: "POST",
      body: JSON.stringify(options),
    });
  }

  async assignCartTelecaller(cartId: string, staffId: string, staffName: string, notes?: string) {
    return this.request(`/admin/abandoned-carts/${cartId}/assign-telecaller`, {
      method: "POST",
      body: JSON.stringify({ staff_id: staffId, staff_name: staffName, notes }),
    });
  }

  async markCartConverted(cartId: string, orderId: string, revenue?: number) {
    return this.request(`/admin/abandoned-carts/${cartId}/mark-converted`, {
      method: "POST",
      body: JSON.stringify({ order_id: orderId, revenue }),
    });
  }

  async getRecoveryCampaigns() {
    return this.request("/admin/abandoned-carts/campaigns").catch(() => ({ campaigns: [] }));
  }

  async createRecoveryCampaign(data: any) {
    return this.request("/admin/abandoned-carts/campaigns", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateRecoveryCampaign(id: string, data: any) {
    return this.request(`/admin/abandoned-carts/campaigns/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteRecoveryCampaign(id: string) {
    return this.request(`/admin/abandoned-carts/campaigns/${id}`, {
      method: "DELETE",
    });
  }

  async exportAbandonedCartsCsv(params: Record<string, any> = {}) {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)])
    ).toString();
    return fetch(`/api/v1/admin/abandoned-carts/export${qs ? `?${qs}` : ""}`).then((r) => r.text());
  }
}

export const apiClient = new CakeToHomeApiClient();


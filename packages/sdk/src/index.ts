/**
 * CakeToHome Commerce Platform Typed SDK
 * Client-agnostic SDK for Web Storefront, BFF, Mobile, and POS applications.
 */

export interface CakeToHomeSDKConfig {
  baseUrl: string;
  publishableKey?: string;
  authToken?: string;
}

export class CakeToHomeClient {
  private baseUrl: string;
  private authToken?: string;

  constructor(config: CakeToHomeSDKConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.authToken = config.authToken;
  }

  setAuthToken(token: string) {
    this.authToken = token;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (this.authToken) {
      headers["Authorization"] = `Bearer ${this.authToken}`;
    }

    const res = await fetch(`${this.baseUrl}/api/v1${path}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(errorData.message || errorData.title || `API Error ${res.status}`);
    }

    return res.json();
  }

  // Auth Namespace
  auth = {
    requestOtp: (phone: string) =>
      this.request<{ message: string; otpSent: boolean }>("/auth/otp/request", {
        method: "POST",
        body: JSON.stringify({ phone }),
      }),
    verifyOtp: (phone: string, code: string) =>
      this.request<{ token: string; user: any }>("/auth/otp/verify", {
        method: "POST",
        body: JSON.stringify({ phone, code }),
      }),
    login: (email: string, password: string) =>
      this.request<{ token: string; user: any }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
  };

  // Products & Catalog Namespace
  products = {
    list: (params: { category_slug?: string; query?: string } = {}) => {
      const q = new URLSearchParams(params as any).toString();
      return this.request<{ products: any[] }>(`/products${q ? `?${q}` : ""}`);
    },
    getBySlug: (slug: string) =>
      this.request<{ product: any }>(`/products/${slug}`),
  };

  // Cart & Orders Namespace
  orders = {
    create: (orderData: any) =>
      this.request<{ order: any; outboxEvent: any }>("/orders", {
        method: "POST",
        body: JSON.stringify(orderData),
      }),
    getById: (id: string) =>
      this.request<{ order: any }>(`/orders/${id}`),
  };

  // Delivery & Fleet Namespace
  delivery = {
    resolvePincode: (pincode: string) =>
      this.request<{ available: boolean; fee: number; estimatedMinutes: number }>("/delivery/resolve", {
        method: "POST",
        body: JSON.stringify({ pincode }),
      }),
  };
}

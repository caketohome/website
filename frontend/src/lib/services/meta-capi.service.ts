/**
 * CakeToHome Marketing & Analytics — Meta Conversions API (CAPI) Service
 *
 * Implements server-side event transmission to Meta Graph API v19.0.
 * Complies with Meta's Privacy Guidelines, SHA-256 PII hashing, and
 * server/browser event deduplication via deterministic `event_id`.
 */

import crypto from "crypto";

export interface MetaCapiUserData {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  clientIp?: string;
  userAgent?: string;
  fbp?: string;
  fbc?: string;
}

export interface MetaCapiCustomData {
  currency?: string;
  value?: number;
  order_id?: string;
  content_name?: string;
  content_category?: string;
  content_ids?: string[];
  contents?: Array<{
    id: string;
    quantity?: number;
    item_price?: number;
  }>;
  num_items?: number;
  [key: string]: any;
}

export interface MetaCapiEventParams {
  eventName: "Purchase" | "InitiateCheckout" | "AddToCart" | "ViewContent" | "PageView" | string;
  eventId: string;
  eventTime?: number;
  eventSourceUrl?: string;
  actionSource?: "website" | "app" | "physical_store" | "system_generated" | "other";
  userData?: MetaCapiUserData;
  customData?: MetaCapiCustomData;
}

export interface MetaCapiResponse {
  success: boolean;
  status: "sent" | "skipped_no_token" | "error";
  eventId?: string;
  eventsReceived?: number;
  message?: string;
  fbTraceId?: string;
}

export class MetaCapiService {
  private static getPixelId(): string | null {
    return (
      process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID ||
      process.env.FB_PIXEL_ID ||
      process.env.META_PIXEL_ID ||
      null
    );
  }

  private static getAccessToken(): string | null {
    return (
      process.env.FB_CAPI_ACCESS_TOKEN ||
      process.env.META_CONVERSIONS_API_TOKEN ||
      process.env.FACEBOOK_CONVERSIONS_API_ACCESS_TOKEN ||
      null
    );
  }

  /**
   * Hashes a value with SHA-256 after lowercase normalization according to Meta guidelines.
   */
  public static hashSha256(val?: string): string | null {
    if (!val || typeof val !== "string") return null;
    const normalized = val.trim().toLowerCase();
    if (!normalized) return null;
    return crypto.createHash("sha256").update(normalized, "utf8").digest("hex");
  }

  /**
   * Hashes phone number (strips all non-digit characters first).
   */
  public static hashPhone(phone?: string): string | null {
    if (!phone || typeof phone !== "string") return null;
    const digitsOnly = phone.replace(/[^0-9]/g, "");
    if (!digitsOnly) return null;
    return crypto.createHash("sha256").update(digitsOnly, "utf8").digest("hex");
  }

  /**
   * Sends a server-side conversion event to Meta Graph API.
   * Gracefully degrades without throwing errors if tokens are unconfigured or network fails.
   */
  public static async sendEvent(params: MetaCapiEventParams): Promise<MetaCapiResponse> {
    const pixelId = this.getPixelId();
    const accessToken = this.getAccessToken();

    if (!pixelId || !accessToken) {
      // Graceful fallback for local development or environments without active Meta credentials
      return {
        success: true,
        status: "skipped_no_token",
        eventId: params.eventId,
        message: "Meta CAPI skipped: NEXT_PUBLIC_FACEBOOK_PIXEL_ID or FB_CAPI_ACCESS_TOKEN not configured.",
      };
    }

    try {
      const uData = params.userData || {};
      const hashedUserData: Record<string, any> = {};

      const hashedEmail = this.hashSha256(uData.email);
      if (hashedEmail) hashedUserData.em = [hashedEmail];

      const hashedPhone = this.hashPhone(uData.phone);
      if (hashedPhone) hashedUserData.ph = [hashedPhone];

      const hashedFn = this.hashSha256(uData.firstName);
      if (hashedFn) hashedUserData.fn = [hashedFn];

      const hashedLn = this.hashSha256(uData.lastName);
      if (hashedLn) hashedUserData.ln = [hashedLn];

      const hashedCity = this.hashSha256(uData.city);
      if (hashedCity) hashedUserData.ct = [hashedCity];

      const hashedPostal = this.hashSha256(uData.postalCode);
      if (hashedPostal) hashedUserData.zp = [hashedPostal];

      const hashedCountry = this.hashSha256(uData.country || "IN");
      if (hashedCountry) hashedUserData.country = [hashedCountry];

      if (uData.clientIp) hashedUserData.client_ip_address = uData.clientIp;
      if (uData.userAgent) hashedUserData.client_user_agent = uData.userAgent;
      if (uData.fbp) hashedUserData.fbp = uData.fbp;
      if (uData.fbc) hashedUserData.fbc = uData.fbc;

      const eventPayload = {
        data: [
          {
            event_name: params.eventName,
            event_time: params.eventTime || Math.floor(Date.now() / 1000),
            event_id: params.eventId,
            event_source_url: params.eventSourceUrl || "https://cakestohome.com/",
            action_source: params.actionSource || "website",
            user_data: hashedUserData,
            custom_data: params.customData || {},
          },
        ],
      };

      const url = `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${accessToken}`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(eventPayload),
      });

      const resBody = await response.json();

      if (!response.ok) {
        console.warn("[MetaCAPI] Graph API Warning:", resBody);
        return {
          success: false,
          status: "error",
          eventId: params.eventId,
          message: resBody.error?.message || "Failed to deliver event to Meta Graph API",
          fbTraceId: resBody.error?.fbtrace_id,
        };
      }

      return {
        success: true,
        status: "sent",
        eventId: params.eventId,
        eventsReceived: resBody.events_received || 1,
        fbTraceId: resBody.fbtrace_id,
      };
    } catch (err: any) {
      console.warn("[MetaCAPI] Non-blocking network error:", err.message);
      return {
        success: false,
        status: "error",
        eventId: params.eventId,
        message: err.message,
      };
    }
  }

  /**
   * Helper to dispatch standard Purchase event for deduplication with browser pixel.
   */
  public static async sendPurchase(params: {
    order_id: string;
    amount: number;
    currency?: string;
    email?: string;
    phone?: string;
    clientIp?: string;
    userAgent?: string;
    items?: Array<{ id: string; quantity?: number; item_price?: number }>;
  }): Promise<MetaCapiResponse> {
    const eventId = `purchase_${params.order_id}`;
    return this.sendEvent({
      eventName: "Purchase",
      eventId,
      eventSourceUrl: `https://cakestohome.com/checkout/order-success?order_id=${params.order_id}`,
      actionSource: "website",
      userData: {
        email: params.email,
        phone: params.phone,
        clientIp: params.clientIp,
        userAgent: params.userAgent,
      },
      customData: {
        currency: params.currency || "INR",
        value: Number(params.amount),
        order_id: params.order_id,
        content_type: "product",
        contents: params.items || [],
        num_items: params.items?.reduce((sum, it) => sum + (it.quantity || 1), 0) || 1,
      },
    });
  }
}


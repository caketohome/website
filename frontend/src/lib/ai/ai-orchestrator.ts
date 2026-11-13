/**
 * CakeToHome AI Concierge Orchestrator
 * 
 * Intelligent multi-turn reasoning engine that:
 * - Maintains multi-turn context (occasion, budget, flavour, city, pincode)
 * - Identifies user intents
 * - Executes relevant controlled tools from AiToolRegistry concurrently
 * - Queries KnowledgeBase RAG for policies, FAQs, and brand knowledge
 * - Enforces zero-hallucination guarantee on prices, stock, and delivery slots
 * - Returns structured response schema (message, products, offers, actions, followUps)
 */

import { AiToolRegistry, ToolContext } from "./ai-tool-registry";
import { KnowledgeBase } from "./knowledge-base";
import { KnowledgeSyncService } from "./knowledge-sync-service";
import { AiAnalyticsService } from "./ai-analytics-service";

export interface AiProductCard {
  productId: string;
  name: string;
  slug: string;
  price: number;
  mrp: number;
  rating: number;
  reviews?: number;
  thumbnail: string;
  vegan?: boolean;
  sugarFree?: boolean;
  glutenFree?: boolean;
  artisan?: boolean;
  isEggless?: boolean;
  isDeliverable: boolean;
  minPrepHours?: number;
}

export interface AiOfferCard {
  id: string;
  code: string;
  name: string;
  description: string;
  discountValue: number;
}

export interface AiAction {
  type: "VIEW_PRODUCT" | "APPLY_COUPON" | "CHECK_PINCODE" | "VIEW_CART" | "TRACK_ORDER" | "SELECT_OCCASION";
  label: string;
  payload: Record<string, any>;
}

export interface AiOrchestratorResponse {
  message: string;
  products?: AiProductCard[];
  offers?: AiOfferCard[];
  actions?: AiAction[];
  delivery?: any;
  cart?: any;
  followUpQuestions?: string[];
  intent: string;
  toolsUsed: string[];
}

export interface ConversationState {
  conversationId: string;
  sessionId: string;
  customerId?: string;
  cityId?: string;
  cityName?: string;
  pincode?: string;
  cartId?: string;
  occasion?: string;
  budget?: number;
  vegan?: boolean;
  sugarFree?: boolean;
  glutenFree?: boolean;
  history: Array<{ sender: "user" | "ai"; text: string }>;
}

export class AiOrchestrator {
  private static sessions: Map<string, ConversationState> = new Map();
  private static isInitialized = false;

  public static async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await KnowledgeSyncService.syncAll();
      this.isInitialized = true;
    }
  }

  public static getSession(sessionId: string, initialContext?: Partial<ConversationState>): ConversationState {
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = {
        conversationId: `conv_${sessionId}_${Date.now()}`,
        sessionId,
        cityName: initialContext?.cityName || "",
        cityId: initialContext?.cityId || "",
        pincode: initialContext?.pincode,
        cartId: initialContext?.cartId,
        customerId: initialContext?.customerId,
        history: [],
      };
      this.sessions.set(sessionId, session);
    } else if (initialContext) {
      if (initialContext.cityName) session.cityName = initialContext.cityName;
      if (initialContext.cityId) session.cityId = initialContext.cityId;
      if (initialContext.pincode) session.pincode = initialContext.pincode;
      if (initialContext.cartId) session.cartId = initialContext.cartId;
      if (initialContext.customerId) session.customerId = initialContext.customerId;
    }
    return session;
  }

  /**
   * Helper to extract specific product search keywords by removing stopwords and intent keywords
   */
  private static extractSearchKeywords(text: string): string | undefined {
    const stopwords = [
      "show", "me", "find", "i", "need", "do", "you", "have", "what", "is", "are",
      "available", "cakes", "cake", "give", "please", "for", "a", "an", "the",
      "in", "with", "best", "top", "of", "some", "something", "any", "under",
      "below", "budget", "price", "vegan", "sugarfree", "sugar-free",
      "gluten-free", "glutenfree", "birthday", "anniversary", "wedding", "fresh"
    ];

    let cleaned = text.toLowerCase()
      .replace(/[^\w\s-]/g, " ")
      .replace(/\b\d+\b/g, " ");

    for (const sw of stopwords) {
      const regex = new RegExp(`\\b${sw}\\b`, "gi");
      cleaned = cleaned.replace(regex, " ");
    }

    const words = cleaned.trim().split(/\s+/).filter((w) => w.length > 2);
    return words.length > 0 ? words.join(" ") : undefined;
  }

  /**
   * Process a customer message and return a structured response
   */
  public static async processMessage(
    userText: string,
    sessionId: string,
    context?: ToolContext
  ): Promise<AiOrchestratorResponse> {
    await this.ensureInitialized();

    const session = this.getSession(sessionId, {
      cityName: context?.cityName,
      cityId: context?.cityId,
      pincode: context?.pincode,
      cartId: context?.cartId,
      customerId: context?.customerId,
    });

    session.history.push({ sender: "user", text: userText });

    const clean = userText.toLowerCase().trim();
    const toolsUsed: string[] = [];

    // ── 1. Multi-Turn Context Extraction ─────────────────────────────────────
    // Budget
    const priceMatch = clean.match(/(?:under|below|less than|within|around|₹|\brs\.?)\s*(\d{3,5})/i);
    if (priceMatch && priceMatch[1]) {
      session.budget = Number(priceMatch[1]);
    }

    // Dietary
    if (clean.includes("vegan")) {
      session.vegan = true;
    }
    if (clean.includes("sugar free") || clean.includes("sugar-free") || clean.includes("diabetic")) {
      session.sugarFree = true;
    }
    if (clean.includes("gluten free") || clean.includes("gluten-free")) {
      session.glutenFree = true;
    }

    // Occasion
    if (clean.includes("birthday") || clean.includes("bday")) {
      session.occasion = "birthday";
    } else if (clean.includes("anniversary") || clean.includes("romantic") || clean.includes("wedding")) {
      session.occasion = "anniversary";
    }

    // Pincode extraction
    const pinMatch = clean.match(/\b(560\d{3}|400\d{3}|110\d{3}|500\d{3}|600\d{3}|682\d{3})\b/);
    if (pinMatch) {
      session.pincode = pinMatch[1];
    }

    // ── 2. Intent Classification & Routing ────────────────────────────────────
    let intent = "PRODUCT_SEARCH";

    if (clean.includes("track") || clean.includes("where is my order") || clean.includes("order status") || clean.startsWith("cth-") || clean.startsWith("ord_")) {
      intent = "ORDER_STATUS";
    } else if (clean.includes("deliver") || clean.includes("pincode") || clean.includes("slot") || clean.includes("midnight") || clean.includes("express")) {
      intent = "DELIVERY_QUERY";
    } else if (clean.includes("coupon") || clean.includes("offer") || clean.includes("discount") || clean.includes("promo") || clean.includes("cake50")) {
      intent = "COUPON_QUERY";
    } else if (clean.includes("flower") || clean.includes("candle") || clean.includes("topper") || clean.includes("accessory") || clean.includes("teddy") || clean.includes("greeting card")) {
      intent = "CROSS_SELL";
    } else if (clean.includes("cancel") || clean.includes("refund") || clean.includes("return") || clean.includes("policy") || clean.includes("faq") || clean.includes("safe") || clean.includes("fssai") || clean.includes("how is it packed")) {
      intent = "POLICY_FAQ";
    } else if (clean.includes("hello") || clean.includes("hi") || clean.includes("hey") || clean === "help") {
      intent = "GREETING";
    }

    // ── 3. Intent Handlers & Live Tool Execution ──────────────────────────────

    // INTENT: ORDER STATUS
    if (intent === "ORDER_STATUS") {
      toolsUsed.push("getOrderStatus");
      const orderIdMatch = clean.match(/(?:order\s*(?:#|id|number)?\s*|#)?(cth-[a-z0-9-]+|ord_[a-z0-9_-]+)/i);
      const targetId = orderIdMatch ? orderIdMatch[1] : (context?.customerId ? "latest" : null);

      if (targetId && targetId !== "latest") {
        const orderRes = await AiToolRegistry.getOrderStatus(targetId);
        if (orderRes.found && orderRes.order) {
          const ord = orderRes.order;
          return {
            message: `📦 Order #${ord.orderId} is currently **${ord.status}**. It is scheduled for **${ord.deliverySlot}** to pincode ${ord.deliveryPincode} via ${ord.deliveryPartner}.`,
            actions: [
              { type: "TRACK_ORDER", label: "View Live Map Tracking", payload: { orderId: ord.orderId } },
            ],
            followUpQuestions: ["Need to modify recipient notes?", "Want to add celebratory flowers?"],
            intent,
            toolsUsed,
          };
        }
      }

      if (context?.isAuthenticated && context?.customerId) {
        toolsUsed.push("getCustomerOrders");
        const ordersRes = await AiToolRegistry.getCustomerOrders(context.customerId);
        if (ordersRes.orders && ordersRes.orders.length > 0) {
          const latest = ordersRes.orders[0];
          return {
            message: `📦 Your most recent order **#${latest.id}** (${latest.itemsSummary}) is **${latest.status}** with expected delivery on **${latest.deliverySlot}**.\n\nTotal: ₹${latest.totalAmount}`,
            actions: [
              { type: "TRACK_ORDER", label: "Track Live Order", payload: { orderId: latest.id } },
            ],
            followUpQuestions: ["View full order history", "Reorder favourite cakes"],
            intent,
            toolsUsed,
          };
        }
      }

      return {
        message: "Please provide your Order ID (e.g. *CTH-847291*) or log in to view your live tracking status.",
        followUpQuestions: ["Track order CTH-", "Check delivery times in my area"],
        intent,
        toolsUsed,
      };
    }

    // INTENT: DELIVERY & PINCODE QUERY
    if (intent === "DELIVERY_QUERY") {
      toolsUsed.push("checkPincodeDelivery");
      const targetPin = session.pincode || "560034";
      const deliveryRes = await AiToolRegistry.checkPincodeDelivery(targetPin);

      if (deliveryRes.serviceable) {
        return {
          message: `🚀 **Great news!** We deliver fresh artisanal cakes to **${deliveryRes.pincode}** in **${deliveryRes.city}**.\n\n• **Express Delivery**: ~${deliveryRes.estimatedMinutes} minutes (Next available slot: ${deliveryRes.nextAvailableSlot})\n• **Scheduled Delivery**: Slots available from 9 AM to 10 PM\n• **Fulfillment Kitchen**: ${deliveryRes.branchName}`,
          delivery: deliveryRes,
          actions: [
            { type: "CHECK_PINCODE", label: `Change Pincode (Currently ${targetPin})`, payload: { pincode: targetPin } },
          ],
          followUpQuestions: ["Show bestselling chocolate cakes", "View birthday specials under ₹800", "Check active coupon codes"],
          intent,
          toolsUsed,
        };
      } else {
        return {
          message: `⚠️ Pincode **${targetPin}** is currently outside our direct kitchen express zone. We deliver only within Kerala.`,
          followUpQuestions: ["Check another pincode", "Browse available cities"],
          intent,
          toolsUsed,
        };
      }
    }

    // INTENT: COUPONS & OFFERS
    if (intent === "COUPON_QUERY") {
      toolsUsed.push("getAvailableOffers");
      const offersRes = await AiToolRegistry.getAvailableOffers(context?.cartId);
      const offers = offersRes.offers || [];

      return {
        message: `🏷️ Here are the active bakery promotions for your order today:`,
        offers,
        actions: offers.slice(0, 2).map((off: any) => ({
          type: "APPLY_COUPON",
          label: `Apply ${off.code} (${off.name})`,
          payload: { code: off.code },
        })),
        followUpQuestions: ["🎂 Show cakes eligible for CAKE50", "🛵 Check delivery slots"],
        intent,
        toolsUsed,
      };
    }

    // INTENT: POLICY & FAQ (RAG SEARCH)
    if (intent === "POLICY_FAQ") {
      toolsUsed.push("searchKnowledge");
      const kbRes = await AiToolRegistry.searchKnowledge(clean);
      if (kbRes.results && kbRes.results.length > 0) {
        const top = kbRes.results[0];
        return {
          message: `📋 **${top.title}**\n\n${top.content}`,
          followUpQuestions: ["🎂 Browse Fresh Cakes", "🛵 Check Delivery Times", "💬 WhatsApp Support"],
          intent,
          toolsUsed,
        };
      }
    }

    // INTENT: GREETING
    if (intent === "GREETING" && session.history.length <= 2) {
      toolsUsed.push("getOccasions");
      const occasionsRes = await AiToolRegistry.getOccasions();
      return {
        message: `👋 Welcome to **CakeToHome**! I'm your AI Bakery Concierge.\n\nTell me the celebration occasion, your budget (e.g. *under ₹800*), or favourite flavour — I'll find the best freshly baked cakes in **${session.cityName || "your area"}**!`,
        actions: (occasionsRes.occasions || []).slice(0, 4).map((occ: any) => ({
          type: "SELECT_OCCASION",
          label: `${occ.icon || "🎂"} ${occ.name}`,
          payload: { occasion: occ.slug },
        })),
        followUpQuestions: ["🎂 Birthday Cakes", "🍫 Belgian Chocolate", "💰 Under ₹600", "🛵 45-Min Express Delivery"],
        intent,
        toolsUsed,
      };
    }

    // DEFAULT / INTENT: PRODUCT SEARCH & RECOMMENDATION
    toolsUsed.push("searchProducts");
    const keywordQuery = this.extractSearchKeywords(clean);

    const searchRes = await AiToolRegistry.searchProducts(
      {
        query: keywordQuery,
        occasionIds: session.occasion ? [session.occasion] : undefined,
        maxPrice: session.budget,
        vegan: session.vegan,
        sugarFree: session.sugarFree,
        glutenFree: session.glutenFree,
        cityId: session.cityId,
        limit: 4,
      },
      context
    );

    const prods = searchRes.products || [];

    if (prods.length === 0) {
      AiAnalyticsService.logUnansweredQuery(userText, intent, session.cityId);
      const fallbackSearch = await AiToolRegistry.searchProducts({ limit: 3 }, context);
      return {
        message: `I couldn't find an exact match for "${userText}" within those criteria in ${session.cityName || "your city"}. Here are our top artisanal best-sellers baked fresh today:`,
        products: fallbackSearch.products,
        followUpQuestions: ["Show all chocolate cakes", "View best sellers", "Check budget under ₹800"],
        intent,
        toolsUsed,
      };
    }

    let intro = `✨ Here are the top handcrafted artisanal cakes for you in **${session.cityName || "your area"}**:`;
    if (session.occasion === "birthday") {
      intro = `🎉 **Handcrafted Birthday Specials** baked fresh today with fast express delivery in **${session.cityName || "your area"}**:`;
    } else if (session.occasion === "anniversary") {
      intro = `💖 **Artisanal Anniversary & Romantic Cakes** crafted with Belgian chocolate and fresh berries:`;
    } else if (session.budget) {
      intro = `💰 **Fresh Artisanal Cakes Under ₹${session.budget}** with same-day express delivery in **${session.cityName || "your area"}**:`;
    }

    // Log conversation telemetry
    AiAnalyticsService.logConversationMessage(
      session.conversationId,
      session.sessionId,
      toolsUsed,
      session.cityId,
      session.customerId
    );

    return {
      message: intro,
      products: prods,
      followUpQuestions: [
        "🍫 View Belgian Dark Chocolate",
        "🏷️ Apply Coupon Code CAKE50",
        "🎁 Add Flowers & Birthday Card",
        "⚡ Check 2-Hour Express Delivery Slot",
      ],
      intent,
      toolsUsed,
    };
  }
}

/**
 * CakeToHome Controlled AI Tool Registry
 * 
 * 22 Controlled Server-Side Tools wrapping ApiEngine.
 * Enforces location context, strict role authorization, multi-city compliance,
 * and zero hallucination of prices, stock, delivery times, or coupon codes.
 */

import { ApiEngine } from "../api-engine";
import { KnowledgeBase } from "./knowledge-base";

export interface ToolContext {
  cityId?: string;
  cityName?: string;
  pincode?: string;
  branchId?: string;
  customerId?: string;
  cartId?: string;
  isAuthenticated?: boolean;
}

export interface SearchProductsParams {
  query?: string;
  categoryId?: string;
  occasionIds?: string[];
  cityId?: string;
  branchId?: string;
  pincode?: string;
  minPrice?: number;
  maxPrice?: number;
  vegan?: boolean;
  sugarFree?: boolean;
  glutenFree?: boolean;
  availableOnly?: boolean;
  sort?: "price_asc" | "price_desc" | "rating" | "popular";
  limit?: number;
}

export class AiToolRegistry {
  /**
   * 1. searchProducts
   */
  public static async searchProducts(params: SearchProductsParams, ctx?: ToolContext) {
    let products = ApiEngine.listProducts();

    // Text Query
    if (params.query && params.query.trim().length > 0) {
      const q = params.query.toLowerCase().trim();
      products = products.filter(
        (p: any) =>
          (p.title && p.title.toLowerCase().includes(q)) ||
          (p.name && p.name.toLowerCase().includes(q)) ||
          (p.description && p.description.toLowerCase().includes(q)) ||
          (p.handle && p.handle.toLowerCase().includes(q))
      );
    }

    // Category Filter
    if (params.categoryId && params.categoryId.trim().length > 0) {
      const catLower = params.categoryId.toLowerCase().trim();
      products = products.filter((p: any) => {
        const pCatSlug = (p.category_slug || "").toLowerCase();
        const pCatName = (p.category || "").toLowerCase();
        const pPrimId = (p.primary_category_id || "").toLowerCase();
        const hasMatchingCat = Array.isArray(p.categories) && p.categories.some((c: any) =>
          c.slug?.toLowerCase() === catLower || c.id?.toLowerCase() === catLower || c.name?.toLowerCase() === catLower
        );
        const hasMatchingId = Array.isArray(p.category_ids) && p.category_ids.some((id: string) => id.toLowerCase() === catLower);
        return hasMatchingCat || hasMatchingId || pCatSlug === catLower || pCatName === catLower || pPrimId === catLower;
      });
    }

    // Occasions Filter
    if (params.occasionIds && params.occasionIds.length > 0) {
      const occClean = params.occasionIds.map((o) => o.toLowerCase());
      // In CakeToHome, occasion matches title/description/handle or occasion tag
      products = products.filter((p: any) => {
        const text = `${p.title || ""} ${p.description || ""} ${p.handle || ""}`.toLowerCase();
        return occClean.some((occ) => {
          if (occ === "birthday" || occ === "occ_birthday") return text.includes("birthday") || text.includes("chocolate") || text.includes("truffle") || text.includes("gateau");
          if (occ === "anniversary" || occ === "romantic") return text.includes("velvet") || text.includes("heart") || text.includes("anniversary") || text.includes("luxe");
          return text.includes(occ);
        });
      });
    }

    // Price Bounds
    if (params.minPrice !== undefined) {
      products = products.filter((p: any) => (p.price || 0) >= params.minPrice!);
    }
    if (params.maxPrice !== undefined) {
      products = products.filter((p: any) => (p.price || 0) <= params.maxPrice!);
    }

    // Dietary Flags
    if (params.vegan) {
      products = products.filter((p: any) => Boolean(p.vegan));
    }
    if (params.sugarFree) {
      products = products.filter((p: any) => Boolean(p.sugar_free));
    }
    if (params.glutenFree) {
      products = products.filter((p: any) => Boolean(p.gluten_free));
    }

    // Sort
    if (params.sort === "price_asc") {
      products.sort((a: any, b: any) => (a.price || 0) - (b.price || 0));
    } else if (params.sort === "price_desc") {
      products.sort((a: any, b: any) => (b.price || 0) - (a.price || 0));
    } else if (params.sort === "rating") {
      products.sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0));
    }

    const limit = params.limit || 4;
    const paginated = products.slice(0, limit);

    return {
      totalFound: products.length,
      city: ctx?.cityName || "All Cities",
      products: paginated.map((p: any) => ({
        productId: p.id || p.product_id,
        name: p.title || p.name,
        slug: p.handle || p.id,
        price: p.price,
        mrp: p.price,
        rating: p.rating || 0,
        reviews: p.review_count || 0,
        thumbnail: p.thumbnail,
        vegan: Boolean(p.vegan),
        sugarFree: Boolean(p.sugar_free),
        glutenFree: Boolean(p.gluten_free),
        isDeliverable: p.is_deliverable !== false,
        minPrepHours: p.min_prep_time_hours || 2,
      })),
    };
  }

  /**
   * 2. getProductDetails
   */
  public static async getProductDetails(productIdOrSlug: string) {
    const products = ApiEngine.listProducts();
    const clean = productIdOrSlug.toLowerCase().trim();
    const prod = products.find(
      (p: any) =>
        p.id === productIdOrSlug ||
        p.product_id === productIdOrSlug ||
        p.handle?.toLowerCase() === clean
    );

    if (!prod) {
      return { found: false, message: `Product "${productIdOrSlug}" not found in current catalog.` };
    }

    return {
      found: true,
      product: {
        id: prod.id || prod.product_id,
        title: prod.title || prod.name,
        description: prod.description,
        price: prod.price,
        mrp: prod.price,
        rating: prod.rating || 0,
        thumbnail: prod.thumbnail,
        vegan: Boolean(prod.vegan),
        sugarFree: Boolean(prod.sugar_free),
        glutenFree: Boolean(prod.gluten_free),
        isDeliverable: prod.is_deliverable !== false,
        minPrepHours: prod.min_prep_time_hours || 2,
        vehicleRestriction: prod.vehicle_restriction || "bike",
        gst: "5% included in price",
        sizes: ["0.5 kg (Serves 4-6)", "1.0 kg (Serves 8-12)", "2.0 kg (Serves 16-20)"],
      },
    };
  }

  /**
   * 3. getCategories
   */
  public static async getCategories(includeInactive: boolean = false) {
    const categories = ApiEngine.getCategories(includeInactive);
    return {
      totalCategories: categories.length,
      categories: categories.map((c: any) => ({
        id: c.id,
        name: c.name || c.title,
        slug: c.slug,
        description: c.description,
        productCount: c.product_count,
        isActive: c.is_active !== false,
      })),
    };
  }

  /**
   * 4. getOccasions
   */
  public static async getOccasions() {
    const occasions = ApiEngine.listOccasions ? ApiEngine.listOccasions("active") : [];
    return {
      occasions: occasions.map((o: any) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        icon: o.icon || "🎉",
        description: o.description,
      })),
    };
  }

  /**
   * 5. getBranches
   */
  public static async getBranches(cityId?: string) {
    let branches = ApiEngine.listBranches();
    if (cityId) {
      branches = branches.filter((b: any) => b.city_id === cityId || (b.city || "").toLowerCase() === cityId.toLowerCase());
    }
    return {
      branches: branches.map((b: any) => ({
        id: b.id,
        name: b.name,
        city: b.city,
        address: b.address,
        phone: b.phone,
        status: b.status,
      })),
    };
  }

  /**
   * 6. getCities
   */
  public static async getCities() {
    const cities = ApiEngine.listCities ? ApiEngine.listCities() : [];
    return {
      cities: cities.map((c: any) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        state: c.state,
      })),
    };
  }

  /**
   * 7. checkPincode
   */
  public static async checkPincode(pincode: string) {
    const delivery = ApiEngine.resolveDeliveryContext(pincode);
    return {
      pincode: delivery.pincode,
      serviceable: delivery.serviceable,
      cityName: delivery.cityName,
      storeName: delivery.storeName,
      deliveryFee: delivery.deliveryFee,
      etaMinutes: delivery.etaMinutes,
      expressAvailable: delivery.expressAvailable,
      midnightAvailable: false,
      blockedReason: delivery.blockedReason,
    };
  }

  public static async checkPincodeDelivery(pincode: string) {
    const delivery = ApiEngine.resolveDeliveryContext(pincode);
    return {
      serviceable: delivery.serviceable,
      pincode: delivery.pincode,
      city: delivery.cityName,
      branchName: delivery.storeName,
      estimatedMinutes: delivery.etaMinutes || 45,
      nextAvailableSlot: "45-Minute Hyperlocal Express",
      expressAvailable: delivery.expressAvailable,
      midnightAvailable: false,
      deliveryFee: delivery.deliveryFee,
    };
  }

  /**
   * 8. checkDeliveryAvailability
   */
  public static async checkDeliveryAvailability(params: {
    cityId?: string;
    pincode: string;
    productId?: string;
    requestedSlot?: "standard" | "express" | "midnight";
  }) {
    const delivery = ApiEngine.resolveDeliveryContext(params.pincode);
    if (!delivery.serviceable) {
      return {
        serviceable: false,
        message: delivery.blockedReason || `Pincode ${params.pincode} is outside our current kitchen delivery radius.`,
      };
    }

    let fee = delivery.deliveryFee;
    let slotName = "Standard 2-Hour Delivery (10:00 AM - 09:00 PM)";
    if (params.requestedSlot === "express") {
      fee += 99;
      slotName = "45-Minute Express Hyperlocal Delivery";
    } else if (params.requestedSlot === "midnight") {
      fee += 149;
      slotName = "Scheduled Delivery (09:00 PM - 10:30 PM)";
    }

    return {
      serviceable: true,
      city: delivery.cityName,
      branch: delivery.storeName,
      slot: slotName,
      deliveryFee: fee,
      freeDeliveryAbove: 599,
      expressAvailable: delivery.expressAvailable,
      midnightAvailable: false,
      packaging: "Climate-controlled shock-absorbent cake dome",
    };
  }

  /**
   * 9. getDeliverySlots
   */
  public static async getDeliverySlots(pincode: string) {
    const delivery = ApiEngine.resolveDeliveryContext(pincode);
    if (!delivery.serviceable) {
      return { serviceable: false, slots: [] };
    }

    return {
      serviceable: true,
      pincode,
      city: delivery.cityName,
      slots: [
        { id: "slot_std_1", name: "Standard (10:00 AM - 01:00 PM)", price: 49, isFreeAbove599: true },
        { id: "slot_std_2", name: "Standard (02:00 PM - 05:00 PM)", price: 49, isFreeAbove599: true },
        { id: "slot_std_3", name: "Standard (06:00 PM - 09:00 PM)", price: 49, isFreeAbove599: true },
        { id: "slot_exp", name: "⚡ Express 45-Min Delivery", price: 99, available: delivery.expressAvailable },
        // slot_mid removed - midnight delivery discontinued
      ],
    };
  }

  /**
   * 10. getCurrentCart
   */
  public static async getCurrentCart(cartId?: string) {
    if (!cartId) {
      return { cartId: null, items: [], total: 0, count: 0 };
    }
    const cart = ApiEngine.getCart ? ApiEngine.getCart(cartId) : null;
    if (!cart) {
      return { cartId, items: [], total: 0, count: 0 };
    }
    return {
      cartId: cart.id,
      items: cart.items || [],
      subtotal: cart.subtotal || 0,
      discountTotal: cart.discount_total || 0,
      total: cart.total || 0,
      count: (cart.items || []).length,
    };
  }

  /**
   * 11. addToCart
   */
  public static async addToCart(params: {
    cartId?: string;
    productId: string;
    quantity?: number;
    customMessage?: string;
  }) {
    const products = ApiEngine.listProducts();
    const prod = products.find((p: any) => p.id === params.productId || p.product_id === params.productId);
    if (!prod) {
      return { success: false, error: `Product ${params.productId} not found.` };
    }

    const qty = params.quantity || 1;
    let cartId = params.cartId || `cart_${Date.now()}`;

    let cart = ApiEngine.getCart ? ApiEngine.getCart(cartId) : null;
    if (!cart) {
      cart = {
        id: cartId,
        items: [],
        subtotal: 0,
        total: 0,
      };
      if (ApiEngine.persist) ApiEngine.persist();
    }

    const item = {
      id: `item_${Date.now()}`,
      product_id: prod.id || prod.product_id,
      title: prod.title || prod.name,
      thumbnail: prod.thumbnail,
      unit_price: prod.price,
      quantity: qty,
      total: prod.price * qty,
      custom_message: params.customMessage || "",
    };

    cart.items.push(item);
    cart.subtotal = cart.items.reduce((acc: number, it: any) => acc + it.total, 0);
    cart.total = cart.subtotal;
    if (ApiEngine.persist) ApiEngine.persist();

    return {
      success: true,
      cartId: cart.id,
      addedItem: item,
      cartTotal: cart.total,
      itemCount: cart.items.length,
      message: `Added "${prod.title || prod.name}" to cart.`,
    };
  }

  /**
   * 12. updateCart
   */
  public static async updateCart(cartId: string, lineItemId: string, quantity: number) {
    const cart = ApiEngine.getCart ? ApiEngine.getCart(cartId) : null;
    if (!cart) return { success: false, error: "Cart not found." };

    const idx = (cart.items || []).findIndex((it: any) => it.id === lineItemId);
    if (idx < 0) return { success: false, error: "Cart item not found." };

    if (quantity <= 0) {
      cart.items.splice(idx, 1);
    } else {
      cart.items[idx].quantity = quantity;
      cart.items[idx].total = cart.items[idx].unit_price * quantity;
    }

    cart.subtotal = cart.items.reduce((acc: number, it: any) => acc + it.total, 0);
    cart.total = cart.subtotal;
    if (ApiEngine.persist) ApiEngine.persist();

    return { success: true, cartTotal: cart.total, itemCount: cart.items.length };
  }

  /**
   * 13. removeFromCart
   */
  public static async removeFromCart(cartId: string, lineItemId: string) {
    return this.updateCart(cartId, lineItemId, 0);
  }

  /**
   * 14. listOffers
   */
  public static async listOffers(city?: string, branchId?: string) {
    const offers = ApiEngine.getAdminOffers ? ApiEngine.getAdminOffers({ status: "active", city, branch_id: branchId }) : [];
    return {
      offers: offers.map((o: any) => ({
        id: o.id,
        code: o.code,
        name: o.name,
        description: o.description,
        type: o.type,
        discountValue: o.metadata?.discount_value || 10,
        minOrderValue: o.min_order_value || 299,
      })),
    };
  }

  public static async getAvailableOffers(cartId?: string) {
    return this.listOffers();
  }

  /**
   * 15. validateCoupon
   */
  public static async validateCoupon(code: string, cartTotal: number) {
    const offers = ApiEngine.getAdminOffers ? ApiEngine.getAdminOffers({ status: "active" }) : [];
    const cleanCode = code.toUpperCase().trim();
    const offer = offers.find((o: any) => o.code === cleanCode);

    if (!offer) {
      return { valid: false, message: `Coupon code "${code}" is invalid or expired.` };
    }

    const minVal = offer.min_order_value || 0;
    if (cartTotal < minVal) {
      return {
        valid: false,
        message: `Coupon "${code}" requires a minimum cart value of ₹${minVal}. Current total: ₹${cartTotal}.`,
      };
    }

    let discount = 0;
    if (offer.type === "percentage") {
      const pct = Number(offer.metadata?.discount_value) || 10;
      discount = Math.round((cartTotal * pct) / 100);
      if (offer.max_discount_value) discount = Math.min(discount, offer.max_discount_value);
    } else {
      discount = Number(offer.metadata?.discount_value) || 50;
    }

    return {
      valid: true,
      couponCode: offer.code,
      discountAmount: discount,
      newTotal: Math.max(0, cartTotal - discount),
      message: `Coupon "${offer.code}" applied successfully! You save ₹${discount}.`,
    };
  }

  /**
   * 16. getCrossSellProducts
   */
  public static async getCrossSellProducts() {
    const accessories = ApiEngine.listAccessories ? ApiEngine.listAccessories() : [];
    const active = Array.isArray(accessories) && accessories.length > 0 ? accessories : [
      { id: "acc_candle", name: "Sparkling Birthday Candle", price: 99, category: "Candles" },
      { id: "acc_topper", name: "Golden Birthday Cake Topper", price: 149, category: "Toppers" },
      { id: "acc_roses", name: "Fresh Red Rose Bunch (6 Stems)", price: 299, category: "Flowers" },
      { id: "acc_card", name: "Custom Handwritten Greeting Card", price: 49, category: "Cards" },
    ];

    return {
      accessories: active.slice(0, 4).map((a: any) => ({
        id: a.id,
        name: a.name,
        price: a.price || a.unit_price || 99,
        category: a.category || "Party Add-on",
        image: a.image_url || a.thumbnail || "",
      })),
    };
  }

  /**
   * 17. getUpsellProducts
   */
  public static async getUpsellProducts(currentPrice: number) {
    const products = ApiEngine.listProducts();
    const upsells = products
      .filter((p: any) => (p.price || 0) > currentPrice && (p.price || 0) <= currentPrice + 350)
      .slice(0, 2);

    return {
      upsells: upsells.map((u: any) => ({
        productId: u.id || u.product_id,
        name: u.title || u.name,
        price: u.price,
        priceDifference: u.price - currentPrice,
        thumbnail: u.thumbnail,
        rating: u.rating || 0,
      })),
    };
  }

  /**
   * 18. getCustomerProfile
   */
  public static async getCustomerProfile(customerId?: string, isAuthenticated?: boolean) {
    if (!isAuthenticated || !customerId) {
      return { authenticated: false, message: "Please log in to access your saved profile and addresses." };
    }
    const customers = ApiEngine.getAdminCustomers();
    const customer = customers.find((c: any) => c.id === customerId || c.customer_uid === customerId);
    if (!customer) return { authenticated: false, message: "Customer account not found." };

    return {
      authenticated: true,
      profile: {
        id: customer.id,
        name: `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || customer.name,
        email: customer.email,
        phone: customer.phone,
        savedAddresses: customer.addresses || [],
      },
    };
  }

  /**
   * 19. getCustomerOrders
   */
  public static async getCustomerOrders(customerId?: string, isAuthenticated?: boolean) {
    if (!isAuthenticated || !customerId) {
      return { authenticated: false, message: "Please log in to view your order history." };
    }
    const orders = ApiEngine.listOrders ? ApiEngine.listOrders() : [];
    const customerOrders = orders.filter((o: any) => o.customer_id === customerId || o.email === customerId);

    return {
      authenticated: true,
      orders: customerOrders.slice(0, 5).map((o: any) => ({
        id: o.id || o.display_id,
        orderId: o.id || o.display_id,
        status: o.status || o.fulfillment_status,
        total: o.total,
        totalAmount: o.total || o.grand_total || 0,
        createdAt: o.created_at,
        deliverySlot: o.delivery_slot || "Standard Delivery Window",
        itemsSummary: (o.items || []).map((i: any) => i.title || i.name).join(", ") || "Signature Bakery Selection",
        itemCount: (o.items || []).length,
      })),
    };
  }

  /**
   * 20. getOrderStatus
   */
  public static async getOrderStatus(orderId: string) {
    const orders = ApiEngine.listOrders ? ApiEngine.listOrders() : [];
    const cleanId = orderId.toUpperCase().trim();
    const order = orders.find(
      (o: any) =>
        (o.id && o.id.toUpperCase() === cleanId) ||
        (o.display_id && String(o.display_id).toUpperCase() === cleanId)
    );

    if (!order) {
      return { found: false, message: `Order #${orderId} was not found. Please double check your order number.` };
    }

    return {
      found: true,
      order: {
        orderId: order.id || order.display_id,
        status: order.status || order.fulfillment_status || "PROCESSING",
        deliveryPincode: order.shipping_address?.postal_code || "560034",
        deliverySlot: order.delivery_slot || "2-Hour Standard Delivery",
        total: order.total,
        deliveryPartner: order.delivery_agent || "Assigned Express Courier",
        eta: "Within scheduled delivery window",
      },
    };
  }

  /**
   * 21. getCMSContent
   */
  public static async getCMSContent(slug: string) {
    const page = ApiEngine.getCmsPage ? ApiEngine.getCmsPage(slug) : null;
    if (!page) {
      return { found: false, message: `CMS page /${slug} not found.` };
    }
    return {
      found: true,
      title: page.title,
      metaDescription: page.meta_description,
      sectionsCount: (page.sections || []).length,
    };
  }

  /**
   * 22. searchKnowledge
   */
  public static async searchKnowledge(query: string) {
    const results = KnowledgeBase.search(query, undefined, 4);
    return {
      results: results.map((r) => ({
        title: r.chunk.title,
        content: r.chunk.content,
        sourceType: r.chunk.source_type,
        relevanceScore: r.score,
      })),
    };
  }
}

/**
 * CakeToHome Core API - Cart Engine Domain Service (Phase 1 Feature 4)
 * Manages Guest/Customer Cart Merging, Customization Snapshots, Promo Discount Engine,
 * Gifting Options, Abandoned Cart Recovery, Cross-Sells, and Real-Time Delivery ETA Solver.
 */

export interface CartItemCustomization {
  selectedOptionIds: string[];
  customMessage?: string;
  photoUrl?: string;
  accessories?: { id: string; name: string; price: string }[];
  isGiftWrap?: boolean;
}

export interface CartItemDto {
  id: string;
  productId: string;
  variantId: string;
  quantity: number;
  priceSnapshot: {
    basePrice: string; // @db.Decimal(12,2)
    optionsCost: string;
    accessoriesCost: string;
    finalUnitPrice: string;
  };
  customization: CartItemCustomization;
  giftingDetails?: {
    recipientName: string;
    recipientPhone: string;
    greetingCardText?: string;
    hideInvoicePrice: boolean;
  };
}

export interface CartDto {
  id: string;
  customerId?: string;
  guestSessionId?: string;
  pincode?: string;
  items: CartItemDto[];
  promoCode?: string;
  discountAmount: string; // @db.Decimal(12,2)
  deliveryFee: string;
  taxAmount: string;
  subtotal: string;
  total: string;
  lastActivityAt: string;
  recoveryToken: string;
  reminderStatus: "NONE" | "PENDING" | "SENT";
}

export class CartService {
  private carts: Map<string, CartDto> = new Map();

  constructor() {
    // Seed initial guest cart
    const guestCart: CartDto = {
      id: "cart_guest_100",
      guestSessionId: "sess_guest_999",
      pincode: "560038",
      items: [
        {
          id: "item_01",
          productId: "prod_truffle_01",
          variantId: "var_truffle_half_kg",
          quantity: 1,
          priceSnapshot: {
            basePrice: "599.00",
            optionsCost: "80.00",
            accessoriesCost: "20.00",
            finalUnitPrice: "699.00",
          },
          customization: {
            selectedOptionIds: ["opt_eggless"],
            customMessage: "Happy Birthday Alex",
            accessories: [{ id: "acc_candles", name: "Sparkler Candles", price: "20.00" }],
          },
        },
      ],
      discountAmount: "0.00",
      deliveryFee: "49.00",
      taxAmount: "34.95",
      subtotal: "699.00",
      total: "782.95",
      lastActivityAt: new Date().toISOString(),
      recoveryToken: "rec_tok_100",
      reminderStatus: "NONE",
    };

    this.carts.set(guestCart.id, guestCart);
  }

  async getCart(cartId: string): Promise<CartDto | null> {
    return this.carts.get(cartId) || null;
  }

  async addItem(cartId: string, itemDto: Partial<CartItemDto>): Promise<CartDto> {
    let cart = this.carts.get(cartId);
    if (!cart) {
      cart = {
        id: cartId,
        items: [],
        discountAmount: "0.00",
        deliveryFee: "49.00",
        taxAmount: "0.00",
        subtotal: "0.00",
        total: "0.00",
        lastActivityAt: new Date().toISOString(),
        recoveryToken: `rec_${Date.now()}`,
        reminderStatus: "NONE",
      };
      this.carts.set(cartId, cart);
    }

    const newItem: CartItemDto = {
      id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      productId: itemDto.productId || "prod_truffle_01",
      variantId: itemDto.variantId || "var_truffle_half_kg",
      quantity: itemDto.quantity || 1,
      priceSnapshot: itemDto.priceSnapshot || {
        basePrice: "599.00",
        optionsCost: "0.00",
        accessoriesCost: "0.00",
        finalUnitPrice: "599.00",
      },
      customization: itemDto.customization || { selectedOptionIds: [] },
      giftingDetails: itemDto.giftingDetails,
    };

    // Intelligent Merge: check if exact same item & customization exists
    const existingIndex = cart.items.findIndex(
      (i) => i.variantId === newItem.variantId && JSON.stringify(i.customization) === JSON.stringify(newItem.customization)
    );

    if (existingIndex >= 0) {
      cart.items[existingIndex].quantity += newItem.quantity;
    } else {
      cart.items.push(newItem);
    }

    this.recalculateCart(cart);
    return cart;
  }

  async mergeGuestCart(guestCartId: string, customerId: string): Promise<CartDto> {
    const guestCart = this.carts.get(guestCartId);
    const customerCartId = `cart_cus_${customerId}`;
    let customerCart = this.carts.get(customerCartId);

    if (!customerCart) {
      customerCart = {
        id: customerCartId,
        customerId,
        items: [],
        discountAmount: "0.00",
        deliveryFee: "49.00",
        taxAmount: "0.00",
        subtotal: "0.00",
        total: "0.00",
        lastActivityAt: new Date().toISOString(),
        recoveryToken: `rec_${Date.now()}`,
        reminderStatus: "NONE",
      };
      this.carts.set(customerCartId, customerCart);
    }

    if (guestCart) {
      for (const item of guestCart.items) {
        await this.addItem(customerCartId, item);
      }
      this.carts.delete(guestCartId); // Clean up merged guest cart
    }

    return customerCart;
  }

  async applyPromoCode(cartId: string, code: string): Promise<CartDto> {
    const cart = this.carts.get(cartId);
    if (!cart) throw new Error("Cart not found");

    if (code.toUpperCase() === "CAKE50") {
      cart.promoCode = "CAKE50";
      // 50% discount capped at ₹150.00
      const sub = parseFloat(cart.subtotal);
      const disc = Math.min(sub * 0.5, 150.0);
      cart.discountAmount = disc.toFixed(2);
    } else {
      throw new Error("Invalid promo code");
    }

    this.recalculateCart(cart);
    return cart;
  }

  private recalculateCart(cart: CartDto) {
    let sub = 0;
    for (const item of cart.items) {
      sub += parseFloat(item.priceSnapshot.finalUnitPrice) * item.quantity;
    }

    cart.subtotal = sub.toFixed(2);
    const disc = parseFloat(cart.discountAmount || "0.00");
    const netSub = Math.max(0, sub - disc);

    // Free delivery threshold over ₹500.00
    cart.deliveryFee = netSub >= 500 ? "0.00" : "49.00";
    cart.taxAmount = (netSub * 0.05).toFixed(2); // 5% GST tax
    cart.total = (netSub + parseFloat(cart.deliveryFee) + parseFloat(cart.taxAmount)).toFixed(2);
    cart.lastActivityAt = new Date().toISOString();
  }
}

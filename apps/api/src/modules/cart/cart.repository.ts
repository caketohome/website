import { CartMapper } from "./cart.mapper";
import { CartDTO, AddCartItemInput, AddCustomCakeInput, UpdateCartItemInput } from "./cart.types";
import { CART_CONSTANTS } from "./cart.constants";

export class CartRepository {
  private prisma: any;
  private inMemoryCarts: Map<string, any> = new Map();

  constructor(prismaClient?: any) {
    this.prisma = prismaClient;
    // Seed initial demo cart session
    const demoCart = {
      id: "cart_guest_100",
      guestSessionId: "sess_guest_999",
      pincode: "560038",
      items: [
        {
          id: "item_01",
          productId: "prod_01",
          variantId: "var_truffle_half_kg",
          quantity: 1,
          priceSnapshot: {
            basePrice: 599.0,
            optionsCost: 80.0,
            accessoriesCost: 20.0,
            finalUnitPrice: 699.0,
          },
          customization: {
            selectedOptionIds: ["opt_"],
            customMessage: "Happy Birthday Alex",
            accessories: [{ id: "acc_candles", name: "Sparkler Candles", price: 20.0 }],
          },
        },
      ],
      discountAmount: 0.0,
      deliveryFee: 49.0,
      taxAmount: 34.95,
      subtotal: 699.0,
      total: 782.95,
      lastActivityAt: new Date().toISOString(),
      recoveryToken: "rec_tok_100",
      reminderStatus: "NONE",
    };
    this.inMemoryCarts.set(demoCart.id, demoCart);
  }

  private recalculate(cart: any): any {
    let sub = 0;
    for (const item of cart.items) {
      sub += item.priceSnapshot.finalUnitPrice * item.quantity;
    }

    cart.subtotal = sub;
    const disc = cart.discountAmount || 0.0;
    const netSub = Math.max(0, sub - disc);

    cart.deliveryFee = netSub >= CART_CONSTANTS.FREE_DELIVERY_THRESHOLD || sub === 0 ? 0.0 : CART_CONSTANTS.DEFAULT_DELIVERY_FEE;
    cart.taxAmount = Number((netSub * CART_CONSTANTS.GST_TAX_RATE).toFixed(2));
    cart.total = Number((netSub + cart.deliveryFee + cart.taxAmount).toFixed(2));
    cart.lastActivityAt = new Date().toISOString();

    return cart;
  }

  async getCart(cartId: string): Promise<CartDTO | null> {
    if (this.prisma) {
      const raw = await this.prisma.cart.findUnique({ where: { id: cartId }, include: { items: true } });
      return raw ? CartMapper.toCartDTO(raw) : null;
    }
    const raw = this.inMemoryCarts.get(cartId);
    return raw ? CartMapper.toCartDTO(raw) : null;
  }

  async getOrCreateCart(cartId: string): Promise<any> {
    let raw = this.inMemoryCarts.get(cartId);
    if (!raw) {
      raw = {
        id: cartId,
        items: [],
        discountAmount: 0.0,
        deliveryFee: CART_CONSTANTS.DEFAULT_DELIVERY_FEE,
        taxAmount: 0.0,
        subtotal: 0.0,
        total: 0.0,
        lastActivityAt: new Date().toISOString(),
        recoveryToken: `rec_${cartId}`,
        reminderStatus: "NONE",
      };
      this.inMemoryCarts.set(cartId, raw);
    }
    return raw;
  }

  async addItem(cartId: string, input: AddCartItemInput): Promise<CartDTO> {
    const rawCart = await this.getOrCreateCart(cartId);

    const newItem: any = {
      id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      productId: input.productId,
      variantId: input.variantId || `var_${input.productId}`,
      quantity: input.quantity,
      priceSnapshot: {
        basePrice: 599.0,
        optionsCost: 0.0,
        accessoriesCost: 0.0,
        finalUnitPrice: 599.0,
      },
      customization: input.customization || { selectedOptionIds: [] },
      giftingDetails: input.giftingDetails,
    };

    const existingIndex = rawCart.items.findIndex(
      (i: any) => i.productId === newItem.productId && JSON.stringify(i.customization) === JSON.stringify(newItem.customization)
    );

    if (existingIndex >= 0) {
      rawCart.items[existingIndex].quantity += newItem.quantity;
    } else {
      rawCart.items.push(newItem);
    }

    this.recalculate(rawCart);
    return CartMapper.toCartDTO(rawCart);
  }

  async addCustomCake(cartId: string, input: AddCustomCakeInput): Promise<CartDTO> {
    const rawCart = await this.getOrCreateCart(cartId);

    const basePrice = 899.0 * input.tiers;
    const Surcharge = input.is_artisan ? 50.0 : 0.0;
    const accessoriesCost = (input.accessories || []).reduce((acc, a) => acc + (a.price || 0), 0);
    const finalUnitPrice = basePrice + Surcharge + accessoriesCost;

    const newItem: any = {
      id: `custom_cake_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      productId: input.productId || "prod_custom_cake_01",
      variantId: `var_custom_${input.tiers}tier`,
      quantity: input.quantity,
      priceSnapshot: {
        basePrice,
        optionsCost: Surcharge,
        accessoriesCost,
        finalUnitPrice,
      },
      customization: {
        tiers: input.tiers,
        tierFlavors: input.tierFlavors,
        shape: input.shape,
        selectedOptionIds: input.is_artisan ? ["opt_"] : [],
        customMessage: input.customMessage,
        photoUrl: input.photoUrl,
        accessories: input.accessories,
      },
    };

    rawCart.items.push(newItem);
    this.recalculate(rawCart);
    return CartMapper.toCartDTO(rawCart);
  }

  async updateItem(cartId: string, itemId: string, input: UpdateCartItemInput): Promise<CartDTO> {
    const rawCart = await this.getOrCreateCart(cartId);
    const itemIndex = rawCart.items.findIndex((i: any) => i.id === itemId || i.productId === itemId);

    if (itemIndex < 0) {
      throw new Error(`Cart item with ID '${itemId}' not found in cart.`);
    }

    if (input.quantity === 0) {
      rawCart.items.splice(itemIndex, 1);
    } else {
      if (input.quantity !== undefined) rawCart.items[itemIndex].quantity = input.quantity;
      if (input.customization !== undefined) {
        rawCart.items[itemIndex].customization = {
          ...rawCart.items[itemIndex].customization,
          ...input.customization,
        };
      }
    }

    this.recalculate(rawCart);
    return CartMapper.toCartDTO(rawCart);
  }

  async removeItem(cartId: string, itemId: string): Promise<CartDTO> {
    const rawCart = await this.getOrCreateCart(cartId);
    rawCart.items = rawCart.items.filter((i: any) => i.id !== itemId && i.productId !== itemId);
    this.recalculate(rawCart);
    return CartMapper.toCartDTO(rawCart);
  }

  async mergeGuestCart(guestCartId: string, customerCartId: string): Promise<CartDTO> {
    const guestCart = this.inMemoryCarts.get(guestCartId);
    const customerCart = await this.getOrCreateCart(customerCartId);

    if (guestCart && guestCart.items) {
      for (const item of guestCart.items) {
        await this.addItem(customerCartId, item);
      }
      this.inMemoryCarts.delete(guestCartId);
    }

    return CartMapper.toCartDTO(customerCart);
  }

  async applyPromoCode(cartId: string, promoCode: string): Promise<CartDTO> {
    const rawCart = await this.getOrCreateCart(cartId);

    if (promoCode.toUpperCase() === "CAKE50") {
      rawCart.promoCode = "CAKE50";
      const disc = Math.min(rawCart.subtotal * 0.5, 150.0);
      rawCart.discountAmount = Number(disc.toFixed(2));
    } else {
      throw new Error(`Invalid or expired promo code '${promoCode}'.`);
    }

    this.recalculate(rawCart);
    return CartMapper.toCartDTO(rawCart);
  }
}

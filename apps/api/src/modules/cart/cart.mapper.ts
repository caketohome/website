import { CartDTO, CartItemDTO } from "./cart.types";

export class CartMapper {
  static toCartItemDTO(raw: any): CartItemDTO {
    if (!raw) return null as any;
    const priceSnap = raw.priceSnapshot || {};
    return {
      id: raw.id,
      productId: raw.productId || raw.product_id,
      variantId: raw.variantId || raw.variant_id || `var_${raw.productId}`,
      quantity: Number(raw.quantity || 1),
      priceSnapshot: {
        basePrice: Number(priceSnap.basePrice ?? 599.0),
        optionsCost: Number(priceSnap.optionsCost ?? 0.0),
        accessoriesCost: Number(priceSnap.accessoriesCost ?? 0.0),
        finalUnitPrice: Number(priceSnap.finalUnitPrice ?? 599.0),
      },
      customization: raw.customization || { selectedOptionIds: [] },
      giftingDetails: raw.giftingDetails || undefined,
    };
  }

  static toCartDTO(raw: any): CartDTO {
    if (!raw) return null as any;
    const items = Array.isArray(raw.items) ? raw.items.map(CartMapper.toCartItemDTO) : [];
    return {
      id: raw.id,
      customerId: raw.customerId || raw.customer_id || undefined,
      guestSessionId: raw.guestSessionId || raw.guest_session_id || undefined,
      pincode: raw.pincode || undefined,
      items,
      promoCode: raw.promoCode || raw.promo_code || undefined,
      discountAmount: Number(raw.discountAmount ?? 0.0),
      deliveryFee: Number(raw.deliveryFee ?? 49.0),
      taxAmount: Number(raw.taxAmount ?? 0.0),
      subtotal: Number(raw.subtotal ?? 0.0),
      total: Number(raw.total ?? 0.0),
      lastActivityAt: raw.lastActivityAt ? new Date(raw.lastActivityAt).toISOString() : new Date().toISOString(),
      recoveryToken: raw.recoveryToken || `rec_${raw.id}`,
      reminderStatus: raw.reminderStatus || "NONE",
    };
  }
}

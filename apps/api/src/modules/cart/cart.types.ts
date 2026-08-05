export interface CartItemCustomization {
  selectedOptionIds?: string[];
  customMessage?: string;
  photoUrl?: string;
  accessories?: { id: string; name: string; price: number }[];
  isGiftWrap?: boolean;
  tiers?: number;
  tierFlavors?: string[];
  shape?: string;
}

export interface CartItemDTOv1 {
  id: string;
  productId: string;
  variantId: string;
  quantity: number;
  priceSnapshot: {
    basePrice: number;
    optionsCost: number;
    accessoriesCost: number;
    finalUnitPrice: number;
  };
  customization: CartItemCustomization;
  giftingDetails?: {
    recipientName: string;
    recipientPhone: string;
    greetingCardText?: string;
    hideInvoicePrice: boolean;
  };
}

export type CartItemDTO = CartItemDTOv1;

export interface CartDTOv1 {
  id: string;
  customerId?: string;
  guestSessionId?: string;
  pincode?: string;
  items: CartItemDTOv1[];
  promoCode?: string;
  discountAmount: number;
  deliveryFee: number;
  taxAmount: number;
  subtotal: number;
  total: number;
  lastActivityAt: string;
  recoveryToken: string;
  reminderStatus: "NONE" | "PENDING" | "SENT";
}

export type CartDTO = CartDTOv1;

export interface AddCartItemInput {
  productId: string;
  variantId?: string;
  quantity: number;
  customization?: CartItemCustomization;
  giftingDetails?: {
    recipientName: string;
    recipientPhone: string;
    greetingCardText?: string;
    hideInvoicePrice: boolean;
  };
}

export interface AddCustomCakeInput {
  productId?: string;
  title?: string;
  tiers: number;
  tierFlavors: string[];
  shape?: string;
  isEggless: boolean;
  customMessage?: string;
  photoUrl?: string;
  accessories?: { id: string; name: string; price: number }[];
  quantity: number;
}

export interface UpdateCartItemInput {
  quantity?: number;
  customization?: CartItemCustomization;
}

export interface ApplyPromoInput {
  promoCode: string;
}

export interface MergeCartInput {
  guestCartId: string;
}

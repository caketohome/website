import { AddCartItemInput, AddCustomCakeInput, UpdateCartItemInput, ApplyPromoInput, MergeCartInput } from "./cart.types";
import { CART_CONSTANTS } from "./cart.constants";
import { BadRequestError } from "../../core/errors/app-error";

export function validateAddToCartInput(body: any): AddCartItemInput {
  if (!body || typeof body !== "object") {
    throw new BadRequestError("Request body must be a valid JSON object.");
  }

  const productId = body.productId ? String(body.productId).trim() : "";
  if (!productId) {
    throw new BadRequestError("Cart item 'productId' is required.");
  }

  const quantity = parseInt(body.quantity || 1, 10);
  if (isNaN(quantity) || quantity < 1 || quantity > CART_CONSTANTS.MAX_QUANTITY_PER_ITEM) {
    throw new BadRequestError(`Cart item quantity must be an integer between 1 and ${CART_CONSTANTS.MAX_QUANTITY_PER_ITEM}.`);
  }

  return {
    productId,
    variantId: body.variantId ? String(body.variantId).trim() : undefined,
    quantity,
    customization: body.customization && typeof body.customization === "object" ? body.customization : undefined,
    giftingDetails: body.giftingDetails && typeof body.giftingDetails === "object" ? body.giftingDetails : undefined,
  };
}

export function validateAddCustomCakeInput(body: any): AddCustomCakeInput {
  if (!body || typeof body !== "object") {
    throw new BadRequestError("Request body must be a valid JSON object.");
  }

  const tiers = parseInt(body.tiers || 1, 10);
  if (isNaN(tiers) || tiers < 1 || tiers > 3) {
    throw new BadRequestError("Custom cake tiers must be between 1 and 3.");
  }

  const tierFlavors = Array.isArray(body.tierFlavors) ? body.tierFlavors.map((f: any) => String(f).trim()) : ["Chocolate Truffle"];
  if (tierFlavors.length === 0) {
    throw new BadRequestError("At least 1 tier flavor selection is required for a custom cake.");
  }

  const customMessage = body.customMessage ? String(body.customMessage).trim() : undefined;
  if (customMessage && customMessage.length > 100) {
    throw new BadRequestError("Custom cake icing message cannot exceed 100 characters.");
  }

  const quantity = parseInt(body.quantity || 1, 10);
  if (isNaN(quantity) || quantity < 1 || quantity > CART_CONSTANTS.MAX_QUANTITY_PER_ITEM) {
    throw new BadRequestError(`Custom cake quantity must be an integer between 1 and ${CART_CONSTANTS.MAX_QUANTITY_PER_ITEM}.`);
  }

  return {
    productId: body.productId ? String(body.productId).trim() : "prod_custom_cake_01",
    title: body.title ? String(body.title).trim() : "Handcrafted Custom Celebration Cake",
    tiers,
    tierFlavors,
    shape: body.shape ? String(body.shape).trim() : "Round",
    is_artisan: Boolean(body.is_artisan ?? true),
    customMessage,
    photoUrl: body.photoUrl ? String(body.photoUrl).trim() : undefined,
    accessories: Array.isArray(body.accessories) ? body.accessories : [],
    quantity,
  };
}

export function validateUpdateCartItemInput(body: any): UpdateCartItemInput {
  if (!body || typeof body !== "object") {
    throw new BadRequestError("Request body must be a valid JSON object.");
  }

  let quantity: number | undefined = undefined;
  if (body.quantity !== undefined) {
    quantity = parseInt(body.quantity, 10);
    if (isNaN(quantity) || quantity < 0 || quantity > CART_CONSTANTS.MAX_QUANTITY_PER_ITEM) {
      throw new BadRequestError(`Cart item quantity must be an integer between 0 and ${CART_CONSTANTS.MAX_QUANTITY_PER_ITEM}.`);
    }
  }

  return {
    quantity,
    customization: body.customization && typeof body.customization === "object" ? body.customization : undefined,
  };
}

export function validateApplyPromoInput(body: any): ApplyPromoInput {
  if (!body || typeof body !== "object") {
    throw new BadRequestError("Request body must be a valid JSON object.");
  }

  const promoCode = body.promoCode ? String(body.promoCode).trim() : "";
  if (!promoCode || promoCode.length < 3) {
    throw new BadRequestError("Promo code must be at least 3 characters long.");
  }

  return { promoCode };
}

export function validateMergeCartInput(body: any): MergeCartInput {
  if (!body || typeof body !== "object") {
    throw new BadRequestError("Request body must be a valid JSON object.");
  }

  const guestCartId = body.guestCartId ? String(body.guestCartId).trim() : "";
  if (!guestCartId) {
    throw new BadRequestError("Property 'guestCartId' is required for cart merging.");
  }

  return { guestCartId };
}

import { CartService } from "../cart.service";
import {
  validateAddToCartInput,
  validateAddCustomCakeInput,
  validateUpdateCartItemInput,
  validateApplyPromoInput,
  validateMergeCartInput,
} from "../cart.validator";

describe("CartService Capability 6.1 & 6.2 Unit Tests", () => {
  let service: CartService;

  beforeEach(() => {
    service = new CartService();
  });

  it("Capability 6.1: should fetch or initialize active cart session with calculation", async () => {
    const cart = await service.getCart("cart_test_1");
    expect(cart).toBeDefined();
    expect(cart.id).toBe("cart_test_1");
    expect(cart.subtotal).toBeGreaterThan(0);
    expect(cart.total).toBeGreaterThan(0);
  });

  it("Capability 6.1: should validate add to cart input parameters", () => {
    expect(() => validateAddToCartInput({})).toThrow("Cart item 'productId' is required.");
    expect(() => validateAddToCartInput({ productId: "prod_01", quantity: 0 })).toThrow("Cart item quantity must be an integer between 1 and 50.");

    const valid = validateAddToCartInput({ productId: "prod_01", quantity: 2 });
    expect(valid.productId).toBe("prod_01");
    expect(valid.quantity).toBe(2);
  });

  it("Capability 6.1: should add item to cart and recalculate subtotal, tax, and delivery fee", async () => {
    const cart = await service.addItem("cart_test_2", { productId: "prod_02", quantity: 1 });
    expect(cart.items.length).toBe(1);
    expect(cart.items[0].productId).toBe("prod_02");
    expect(cart.subtotal).toBe(599);
    expect(cart.deliveryFee).toBe(0); // Free delivery >= 500
    expect(cart.taxAmount).toBe(29.95);
  });

  it("Capability 6.2: should validate custom cake tier, icing message, and flavor parameters", () => {
    expect(() => validateAddCustomCakeInput({ tiers: 4 })).toThrow("Custom cake tiers must be between 1 and 3.");
    expect(() =>
      validateAddCustomCakeInput({
        tiers: 2,
        customMessage: "A".repeat(101),
      })
    ).toThrow("Custom cake icing message cannot exceed 100 characters.");

    const valid = validateAddCustomCakeInput({
      tiers: 2,
      tierFlavors: ["Belgian Chocolate", "Red Velvet"],
      isEggless: true,
      customMessage: "Happy 25th Anniversary Mom & Dad",
      quantity: 1,
    });
    expect(valid.tiers).toBe(2);
    expect(valid.isEggless).toBe(true);
    expect(valid.customMessage).toBe("Happy 25th Anniversary Mom & Dad");
  });

  it("Capability 6.2: should add 2-tier custom cake with eggless surcharge and accessories", async () => {
    const cart = await service.addCustomCake("cart_custom_1", {
      tiers: 2,
      tierFlavors: ["Dark Truffle", "Hazelnut"],
      isEggless: true,
      customMessage: "Happy Birthday Alex",
      accessories: [{ id: "acc_topper", name: "Custom Name Topper", price: 150.0 }],
      quantity: 1,
    });

    expect(cart.items.length).toBe(1);
    const item = cart.items[0];
    expect(item.customization.tiers).toBe(2);
    expect(item.customization.tierFlavors).toEqual(["Dark Truffle", "Hazelnut"]);
    expect(item.priceSnapshot.basePrice).toBe(1798.0); // 899 * 2 tiers
    expect(item.priceSnapshot.optionsCost).toBe(50.0); // Eggless surcharge
    expect(item.priceSnapshot.accessoriesCost).toBe(150.0);
    expect(item.priceSnapshot.finalUnitPrice).toBe(1998.0);
  });

  it("Capability 6.1: should update item quantity and remove item when quantity is 0", async () => {
    const cart1 = await service.addItem("cart_test_3", { productId: "prod_01", quantity: 1 });
    const itemId = cart1.items[0].id;

    const cart2 = await service.updateItem("cart_test_3", itemId, { quantity: 3 });
    expect(cart2.items[0].quantity).toBe(3);

    const cart3 = await service.removeItem("cart_test_3", itemId);
    expect(cart3.items.length).toBe(0);
  });

  it("Capability 6.1: should apply promo code CAKE50 and calculate 50% discount", async () => {
    await service.addItem("cart_promo_1", { productId: "prod_01", quantity: 1 });
    const cart = await service.applyPromo("cart_promo_1", { promoCode: "CAKE50" });
    expect(cart.promoCode).toBe("CAKE50");
    expect(cart.discountAmount).toBe(150); // Max 150 cap
  });

  it("Capability 6.1: should merge guest cart items into customer cart session", async () => {
    await service.addItem("cart_guest_merge", { productId: "prod_01", quantity: 1 });
    const customerCart = await service.mergeCart("cart_cus_100", { guestCartId: "cart_guest_merge" });
    expect(customerCart.items.some((i) => i.productId === "prod_01")).toBe(true);
  });
});

import { CartRepository } from "./cart.repository";
import { AddCartItemInput, AddCustomCakeInput, UpdateCartItemInput, ApplyPromoInput, MergeCartInput } from "./cart.types";

export class CartService {
  private repository: CartRepository;

  constructor(repository: CartRepository = new CartRepository()) {
    this.repository = repository;
  }

  async getCart(cartId: string = "cart_guest_100") {
    let cart = await this.repository.getCart(cartId);
    if (!cart) {
      cart = await this.repository.addItem(cartId, { productId: "prod_01", quantity: 1 });
    }
    return cart;
  }

  async addItem(cartId: string = "cart_guest_100", input: AddCartItemInput) {
    return this.repository.addItem(cartId, input);
  }

  async addCustomCake(cartId: string = "cart_guest_100", input: AddCustomCakeInput) {
    return this.repository.addCustomCake(cartId, input);
  }

  async updateItem(cartId: string = "cart_guest_100", itemId: string, input: UpdateCartItemInput) {
    return this.repository.updateItem(cartId, itemId, input);
  }

  async removeItem(cartId: string = "cart_guest_100", itemId: string) {
    return this.repository.removeItem(cartId, itemId);
  }

  async mergeCart(customerCartId: string, input: MergeCartInput) {
    return this.repository.mergeGuestCart(input.guestCartId, customerCartId);
  }

  async applyPromo(cartId: string = "cart_guest_100", input: ApplyPromoInput) {
    return this.repository.applyPromoCode(cartId, input.promoCode);
  }
}

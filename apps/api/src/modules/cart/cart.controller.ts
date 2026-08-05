import { Request, Response, NextFunction } from "express";
import { CartService } from "./cart.service";
import {
  validateAddToCartInput,
  validateAddCustomCakeInput,
  validateUpdateCartItemInput,
  validateApplyPromoInput,
  validateMergeCartInput,
} from "./cart.validator";

export class CartController {
  private service: CartService;

  constructor(service: CartService = new CartService()) {
    this.service = service;
  }

  getCart = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cartId = (req.headers["x-cart-id"] as string) || "cart_guest_100";
      const cart = await this.service.getCart(cartId);
      return res.status(200).json({
        success: true,
        data: cart,
      });
    } catch (error) {
      return next(error);
    }
  };

  addItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cartId = (req.headers["x-cart-id"] as string) || "cart_guest_100";
      const input = validateAddToCartInput(req.body);
      const cart = await this.service.addItem(cartId, input);
      return res.status(201).json({
        success: true,
        data: cart,
      });
    } catch (error) {
      return next(error);
    }
  };

  addCustomCake = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cartId = (req.headers["x-cart-id"] as string) || "cart_guest_100";
      const input = validateAddCustomCakeInput(req.body);
      const cart = await this.service.addCustomCake(cartId, input);
      return res.status(201).json({
        success: true,
        data: cart,
      });
    } catch (error) {
      return next(error);
    }
  };

  updateItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cartId = (req.headers["x-cart-id"] as string) || "cart_guest_100";
      const itemId = req.params.itemId;
      const input = validateUpdateCartItemInput(req.body);
      const cart = await this.service.updateItem(cartId, itemId, input);
      return res.status(200).json({
        success: true,
        data: cart,
      });
    } catch (error) {
      return next(error);
    }
  };

  removeItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cartId = (req.headers["x-cart-id"] as string) || "cart_guest_100";
      const itemId = req.params.itemId;
      const cart = await this.service.removeItem(cartId, itemId);
      return res.status(200).json({
        success: true,
        data: cart,
      });
    } catch (error) {
      return next(error);
    }
  };

  mergeCart = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const customerCartId = (req.headers["x-cart-id"] as string) || "cart_cus_100";
      const input = validateMergeCartInput(req.body);
      const cart = await this.service.mergeCart(customerCartId, input);
      return res.status(200).json({
        success: true,
        data: cart,
      });
    } catch (error) {
      return next(error);
    }
  };

  applyPromo = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cartId = (req.headers["x-cart-id"] as string) || "cart_guest_100";
      const input = validateApplyPromoInput(req.body);
      const cart = await this.service.applyPromo(cartId, input);
      return res.status(200).json({
        success: true,
        data: cart,
      });
    } catch (error) {
      return next(error);
    }
  };
}

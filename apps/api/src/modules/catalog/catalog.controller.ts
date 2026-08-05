import { Request, Response, NextFunction } from "express";
import { CatalogService } from "./catalog.service";
import {
  validateProductListingQuery,
  validateSearchQuery,
  validateFilterQuery,
  validateCreateReviewInput,
  validateAddWishlistItemInput,
} from "./catalog.validator";

export class CatalogController {
  private service: CatalogService;

  constructor(service: CatalogService = new CatalogService()) {
    this.service = service;
  }

  listProducts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = validateProductListingQuery(req.query);
      const result = await this.service.listProducts(query);
      return res.status(200).json({
        success: true,
        data: result.products,
        meta: result.meta,
      });
    } catch (error) {
      return next(error);
    }
  };

  searchProducts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = validateSearchQuery(req.query);
      const result = await this.service.searchProducts(query);
      return res.status(200).json({
        success: true,
        data: result.products,
        meta: result.meta,
      });
    } catch (error) {
      return next(error);
    }
  };

  filterProducts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = validateFilterQuery(req.query);
      const result = await this.service.filterProducts(query);
      return res.status(200).json({
        success: true,
        data: result.products,
        meta: result.meta,
      });
    } catch (error) {
      return next(error);
    }
  };

  getProductById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const productId = req.params.id;
      const product = await this.service.getProductById(productId);
      return res.status(200).json({
        success: true,
        data: product,
      });
    } catch (error) {
      return next(error);
    }
  };

  listProductReviews = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const productId = req.params.id;
      const result = await this.service.listProductReviews(productId);
      return res.status(200).json({
        success: true,
        data: result.reviews,
        summary: result.summary,
      });
    } catch (error) {
      return next(error);
    }
  };

  createProductReview = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const productId = req.params.id;
      const input = validateCreateReviewInput(req.body);
      const review = await this.service.createProductReview(productId, input);
      return res.status(201).json({
        success: true,
        data: review,
      });
    } catch (error) {
      return next(error);
    }
  };

  getWishlist = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getWishlist();
      return res.status(200).json({
        success: true,
        data: result.items,
        count: result.count,
      });
    } catch (error) {
      return next(error);
    }
  };

  addToWishlist = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = validateAddWishlistItemInput(req.body);
      const item = await this.service.addToWishlist(input);
      return res.status(201).json({
        success: true,
        data: item,
      });
    } catch (error) {
      return next(error);
    }
  };

  removeFromWishlist = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const productId = req.params.productId;
      const result = await this.service.removeFromWishlist(productId);
      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };

  listCategories = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const categories = await this.service.listCategories();
      return res.status(200).json({
        success: true,
        data: categories,
      });
    } catch (error) {
      return next(error);
    }
  };

  getCategoryById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const categoryId = req.params.id;
      const category = await this.service.getCategoryById(categoryId);
      return res.status(200).json({
        success: true,
        data: category,
      });
    } catch (error) {
      return next(error);
    }
  };
}

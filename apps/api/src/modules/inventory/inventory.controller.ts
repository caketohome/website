import { Request, Response, NextFunction } from "express";
import { InventoryService } from "./inventory.service";
import { validateReserveStockInput, validateReleaseReservationInput, validateConfirmSaleInput } from "./inventory.validator";

export class InventoryController {
  private service: InventoryService;

  constructor(service: InventoryService = new InventoryService()) {
    this.service = service;
  }

  getStockMatrix = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const branchId = req.query.branchId ? String(req.query.branchId).trim() : undefined;
      const variantId = req.query.variantId ? String(req.query.variantId).trim() : undefined;
      const result = await this.service.getStockMatrix(branchId, variantId);
      return res.status(200).json({
        success: true,
        data: result.items,
        count: result.count,
      });
    } catch (error) {
      return next(error);
    }
  };

  reserveStock = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = validateReserveStockInput(req.body);
      const result = await this.service.reserveStock(input);
      return res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };

  releaseReservation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = validateReleaseReservationInput(req.body);
      const result = await this.service.releaseReservation(input);
      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };

  confirmSale = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = validateConfirmSaleInput(req.body);
      const result = await this.service.confirmSale(input);
      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };
}

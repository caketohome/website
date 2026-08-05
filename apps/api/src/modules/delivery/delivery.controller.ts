import { Request, Response, NextFunction } from "express";
import { DeliveryService } from "./delivery.service";
import { validateCheckServiceabilityInput, validateReserveSlotInput, validateCompleteDeliveryInput } from "./delivery.validator";

export class DeliveryController {
  private service: DeliveryService;

  constructor(service: DeliveryService = new DeliveryService()) {
    this.service = service;
  }

  checkServiceability = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = validateCheckServiceabilityInput(req.query);
      const result = await this.service.checkServiceability(input);
      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };

  listDeliveryZones = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.listDeliveryZones();
      return res.status(200).json({
        success: true,
        data: result.zones,
        count: result.count,
      });
    } catch (error) {
      return next(error);
    }
  };

  getDeliveryZoneById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const zoneId = req.params.id;
      const zone = await this.service.getDeliveryZoneById(zoneId);
      return res.status(200).json({
        success: true,
        data: zone,
      });
    } catch (error) {
      return next(error);
    }
  };

  getSlotCapacityGrid = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const branchId = req.query.branchId ? String(req.query.branchId).trim() : "br_koramangala_01";
      const date = req.query.date ? String(req.query.date).trim() : new Date().toISOString().slice(0, 10);
      const result = await this.service.getSlotCapacityGrid(branchId, date);
      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };

  reserveSlot = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = validateReserveSlotInput(req.body);
      const result = await this.service.reserveSlot(input);
      return res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };

  listDrivers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const branchId = req.query.branchId ? String(req.query.branchId).trim() : undefined;
      const drivers = await this.service.listDrivers(branchId);
      return res.status(200).json({
        success: true,
        data: drivers,
      });
    } catch (error) {
      return next(error);
    }
  };

  createDeliveryJob = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orderId, orderNumber, branchId, street, pincode } = req.body || {};
      const job = await this.service.createDeliveryJob({
        orderId: orderId || `ord_${Date.now()}`,
        orderNumber: orderNumber || `CTH-20260731-${Date.now()}`,
        branchId: branchId || "br_koramangala_01",
        street: street || "100 Feet Road",
        pincode: pincode || "560038",
      });
      return res.status(201).json({
        success: true,
        data: job,
      });
    } catch (error) {
      return next(error);
    }
  };

  completeDelivery = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = validateCompleteDeliveryInput(req.body, req.params.id);
      const result = await this.service.completeDelivery(input);
      return res.status(200).json({
        success: true,
        data: result.job,
        driver: result.driver,
      });
    } catch (error) {
      return next(error);
    }
  };
}

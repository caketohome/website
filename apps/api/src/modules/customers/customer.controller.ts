import { Response, NextFunction } from "express";
import { CustomerService } from "./customer.service";
import { validateOtpRequest, validateOtpVerify, validateAddressInput } from "./customer.validator";
import { AuthenticatedRequest } from "./customer.middleware";

export class CustomerController {
  private service: CustomerService;

  constructor(service: CustomerService = new CustomerService()) {
    this.service = service;
  }

  requestOtp = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const input = validateOtpRequest(req.body);
      const result = await this.service.requestOtp(input);
      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };

  verifyOtp = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const input = validateOtpVerify(req.body);
      const result = await this.service.verifyOtp(input);
      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };

  getProfile = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const customerId = req.user!.customer_id;
      const profile = await this.service.getProfile(customerId);
      return res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (error) {
      return next(error);
    }
  };

  listAddresses = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const customerId = req.user!.customer_id;
      const addresses = await this.service.listAddresses(customerId);
      return res.status(200).json({
        success: true,
        data: addresses,
      });
    } catch (error) {
      return next(error);
    }
  };

  createAddress = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const customerId = req.user!.customer_id;
      const input = validateAddressInput(req.body);
      const address = await this.service.createAddress(customerId, input);
      return res.status(201).json({
        success: true,
        data: address,
      });
    } catch (error) {
      return next(error);
    }
  };

  deleteAddress = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const customerId = req.user!.customer_id;
      const addressId = req.params.id;
      await this.service.deleteAddress(addressId, customerId);
      return res.status(200).json({
        success: true,
        data: { id: addressId, deleted: true },
      });
    } catch (error) {
      return next(error);
    }
  };
}

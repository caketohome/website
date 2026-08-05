import { Request, Response, NextFunction } from "express";
import { BranchService } from "./branches.service";
import { validateBranchSearchQuery } from "./branches.validator";

export class BranchController {
  private service: BranchService;

  constructor(service: BranchService = new BranchService()) {
    this.service = service;
  }

  listBranches = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = validateBranchSearchQuery(req.query);
      const result = await this.service.listBranches(query);
      return res.status(200).json({
        success: true,
        data: result.branches,
        meta: result.meta,
      });
    } catch (error) {
      return next(error);
    }
  };

  findServiceableBranch = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const pincode = req.query.pincode ? String(req.query.pincode).trim() : "560038";
      const result = await this.service.findServiceableBranch(pincode);
      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };

  getBranchById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const branchId = req.params.id;
      const branch = await this.service.getBranchById(branchId);
      return res.status(200).json({
        success: true,
        data: branch,
      });
    } catch (error) {
      return next(error);
    }
  };
}

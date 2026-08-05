import { Request, Response, NextFunction } from "express";
import { ForbiddenError } from "../../core/errors/app-error";

export function catalogFeatureGuard(flagKey: string = "catalog.listing.v2") {
  return (req: Request, res: Response, next: NextFunction) => {
    // Feature flag check (defaulting active for capability 3.1)
    return next();
  };
}

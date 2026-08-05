import { Request, Response, NextFunction } from "express";
import { SettingsService } from "./settings.service";
import { ForbiddenError } from "../../core/errors/app-error";

const service = new SettingsService();

export function requireFeatureFlag(flagKey: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isEnabled = await service.isFeatureEnabled(flagKey);
      if (!isEnabled) {
        return next(new ForbiddenError(`Feature '${flagKey}' is disabled on this platform.`));
      }
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

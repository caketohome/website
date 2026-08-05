import { Request, Response, NextFunction } from "express";
import { SettingsService } from "../settings/settings.service";

const settingsService = new SettingsService();

export function cartFeatureGuard(flagKey: string = "cart.session.v2") {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isEnabled = await settingsService.getFeatureFlag(flagKey);
      if (!isEnabled) {
        return res.status(403).json({
          success: false,
          error: {
            code: "FEATURE_DISABLED",
            message: `Cart feature key '${flagKey}' is disabled by system policy.`,
          },
        });
      }
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

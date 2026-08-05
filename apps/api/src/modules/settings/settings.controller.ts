import { Request, Response, NextFunction } from "express";
import { SettingsService } from "./settings.service";
import { validateSettingInput } from "./settings.validator";

export class SettingsController {
  private service: SettingsService;

  constructor(service: SettingsService = new SettingsService()) {
    this.service = service;
  }

  getFeatureFlags = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const flags = await this.service.getFeatureFlags();
      return res.status(200).json({
        success: true,
        data: flags,
      });
    } catch (error) {
      return next(error);
    }
  };

  getGroupSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const group = req.params.group || "general";
      const settings = await this.service.getGroupSettings(group, false);
      return res.status(200).json({
        success: true,
        data: settings,
      });
    } catch (error) {
      return next(error);
    }
  };

  upsertSetting = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = validateSettingInput(req.body);
      const setting = await this.service.setSetting(input);
      return res.status(200).json({
        success: true,
        data: setting,
      });
    } catch (error) {
      return next(error);
    }
  };
}

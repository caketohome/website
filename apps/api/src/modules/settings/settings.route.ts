import { Router } from "express";
import { SettingsController } from "./settings.controller";

const router = Router();
const controller = new SettingsController();

router.get("/settings/feature-flags", controller.getFeatureFlags);
router.get("/settings/groups/:group", controller.getGroupSettings);
router.post("/settings", controller.upsertSetting);

export { router as settingsRouter };

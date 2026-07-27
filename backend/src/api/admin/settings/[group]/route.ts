import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { SETTINGS_MODULE } from "../../../../modules/settings";

/**
 * GET /admin/settings/:group
 * Retrieve all settings within a group as a key/value map.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const settingsModule = req.scope.resolve(SETTINGS_MODULE);
    const group = req.params.group as string;

    const settings = await settingsModule.getGroup(group, true);
    return res.status(200).json({ group, settings });
}

import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { MedusaError } from "@medusajs/utils";
import zod from "zod";
import { SETTINGS_MODULE } from "../../../modules/settings";

const upsertSchema = zod.object({
    group: zod.string().min(1),
    key: zod.string().min(1),
    value: zod.unknown(),
    is_json: zod.boolean().optional(),
    is_secret: zod.boolean().optional(),
    description: zod.string().optional(),
});

/**
 * GET /admin/settings
 * List all settings, optionally filtered by group via ?group=xxx
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const settingsModule = req.scope.resolve(SETTINGS_MODULE) as any;
    const group = req.query.group as string | undefined;

    if (group) {
        const settings = await settingsModule.getGroup(group, true);
        return res.status(200).json({ group, settings });
    }

    const settings = await settingsModule.listSettings({});
    return res.status(200).json({ settings });
}

/**
 * POST /admin/settings
 * Upsert a single setting value.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const parsed = upsertSchema.safeParse(req.body);

    if (!parsed.success) {
        throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            parsed.error.message
        );
    }

    const settingsModule = req.scope.resolve(SETTINGS_MODULE) as any;
    const { group, key, value, is_json, is_secret, description } = parsed.data;

    await settingsModule.upsertValue(group, key, value, {
        is_json,
        is_secret,
        description,
    });

    return res.status(200).json({ message: "Setting saved", group, key });
}

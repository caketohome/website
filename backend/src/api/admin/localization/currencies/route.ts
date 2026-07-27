import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { LOCALIZATION_MODULE } from "../../../../modules/localization";

/**
 * GET /admin/localization/currencies
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const locModule = req.scope.resolve(LOCALIZATION_MODULE);
    const currencies = await locModule.listCurrencies({});
    return res.status(200).json({ currencies });
}

/**
 * POST /admin/localization/currencies
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const locModule = req.scope.resolve(LOCALIZATION_MODULE);

    const body = req.body as {
        code: string;
        symbol: string;
        name: string;
        rate?: number;
        is_default?: boolean;
        is_enabled?: boolean;
    };

    if (!body.code || !body.symbol || !body.name) {
        return res
            .status(400)
            .json({ message: "code, symbol, name are required" });
    }

    const currency = await locModule.createCurrencies({
        code: body.code,
        symbol: body.symbol,
        name: body.name,
        rate: body.rate ?? 1,
        is_default: body.is_default ?? false,
        is_enabled: body.is_enabled ?? true,
    });

    return res.status(200).json({ currency });
}

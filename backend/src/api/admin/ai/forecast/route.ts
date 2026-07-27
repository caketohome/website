import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { AI_MODULE } from "../../../../modules/ai";

/**
 * POST /admin/ai/forecast
 * Forecast a time series (inventory/demand/sales forecasting).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const aiModule = req.scope.resolve(AI_MODULE);

    const body = req.body as {
        data: number[];
        horizon: number;
    };

    if (!Array.isArray(body.data) || !body.horizon) {
        return res.status(400).json({ message: "data (number[]) and horizon are required" });
    }

    const result = await aiModule.forecast({
        data: body.data,
        horizon: body.horizon,
    });

    return res.status(200).json({ result });
}

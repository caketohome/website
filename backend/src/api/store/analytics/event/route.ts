import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ANALYTICS_MODULE } from "../../../../modules/analytics";

/**
 * POST /store/analytics/event
 * Public storefront event ingestion (visitors, add_to_cart, checkout_started, search, etc.)
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const analyticsModule = req.scope.resolve(ANALYTICS_MODULE);

    const body = req.body as {
        event_type: string;
        entity_id?: string;
        customer_id?: string;
        session_id?: string;
        branch_id?: string;
        payload?: Record<string, unknown>;
    };

    if (!body.event_type) {
        return res.status(400).json({ message: "event_type is required" });
    }

    await analyticsModule.track({
        event_type: body.event_type,
        entity_id: body.entity_id,
        customer_id: body.customer_id,
        session_id: body.session_id,
        branch_id: body.branch_id,
        payload: body.payload,
    });

    return res.status(200).json({ tracked: true });
}

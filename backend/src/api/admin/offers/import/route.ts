import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { RULES_MODULE } from "../../../../modules/rules";

/**
 * POST /admin/offers/import
 * Bulk import coupons from CSV or JSON with validation.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const actorId = (req as any).auth_context?.actor_id as string | undefined;
    if (!actorId) {
        return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
    }
    const rulesModule = req.scope.resolve(RULES_MODULE);

    const body = req.body as { coupons?: any[]; csv_data?: string };
    let couponsToImport: any[] = [];

    if (Array.isArray(body.coupons)) {
        couponsToImport = body.coupons;
    } else if (body.csv_data) {
        const lines = body.csv_data.split("\n").map((l) => l.trim()).filter(Boolean);
        const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
        for (let i = 1; i < lines.length; i++) {
            const vals = lines[i].split(",").map((v) => v.trim());
            const obj: Record<string, any> = {};
            header.forEach((h, idx) => {
                obj[h] = vals[idx];
            });
            if (obj.code || obj.name) couponsToImport.push(obj);
        }
    }

    if (couponsToImport.length === 0) {
        return res.status(400).json({ message: "No valid coupons found to import." });
    }

    const offerPayloads = couponsToImport.map((c) => {
        const formattedCode = c.code ? String(c.code).trim().toUpperCase() : `PROMO${Math.floor(1000 + Math.random() * 9000)}`;
        return {
            name: c.name || `Coupon ${formattedCode}`,
            code: formattedCode,
            type: c.type || "percentage",
            status: c.status || "active",
            priority: Number(c.priority) || 0,
            usage_limit: c.usage_limit ? Number(c.usage_limit) : null,
            per_customer_limit: c.per_customer_limit ? Number(c.per_customer_limit) : 1,
            is_public: true,
            is_stackable: false,
            created_by: actorId,
            metadata: JSON.stringify({ discount_value: Number(c.discount_value) || 10 }),
        };
    });

    const created = await rulesModule.createOffers(offerPayloads);
    const createdList = Array.isArray(created) ? created : [created];

    return res.status(201).json({
        imported_count: createdList.length,
        coupons: createdList,
        success: true,
    });
}

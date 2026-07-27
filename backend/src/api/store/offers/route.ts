import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { RULES_MODULE } from "../../../modules/rules";

/**
 * GET /store/offers
 * List active, public offers visible to customers.
 * Used to display available promotions on the storefront.
 * Supports optional ?type= and ?branch_id= filters.
 *
 * Only returns offers with status=active, is_public=true,
 * and within their valid date range.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const rulesModule = req.scope.resolve(RULES_MODULE);

    const filters: Record<string, unknown> = {
        status: "active",
        is_public: true,
    };

    if (req.query.type) filters.type = req.query.type;

    const allOffers = await rulesModule.listOffers(filters);

    // Further filter by date range and branch
    const now = new Date();
    const branchId = req.query.branch_id as string | undefined;

    const offers = (allOffers as unknown as Record<string, unknown>[]).filter(
        (offer) => {
            const startsAt = offer.starts_at as Date | null;
            const endsAt = offer.ends_at as Date | null;

            if (startsAt && now < startsAt) return false;
            if (endsAt && now > endsAt) return false;

            // Branch filter
            if (branchId && offer.branch_ids) {
                let branchIds: string[];
                try {
                    branchIds =
                        typeof offer.branch_ids === "string"
                            ? JSON.parse(offer.branch_ids)
                            : offer.branch_ids;
                } catch {
                    branchIds = [];
                }
                if (
                    Array.isArray(branchIds) &&
                    branchIds.length > 0 &&
                    !branchIds.includes(branchId)
                ) {
                    return false;
                }
            }

            return true;
        }
    );

    // Strip sensitive fields before returning
    const publicOffers = offers.map((offer) => ({
        id: offer.id,
        name: offer.name,
        code: offer.code,
        type: offer.type,
        description: offer.description,
        starts_at: offer.starts_at,
        ends_at: offer.ends_at,
    }));

    return res.status(200).json({ offers: publicOffers });
}

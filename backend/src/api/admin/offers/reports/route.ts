import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { RULES_MODULE } from "../../../../modules/rules";

/**
 * GET /admin/offers/reports
 * Returns time-series and multi-dimensional coupon reports (daily, weekly, monthly, branch-wise, city-wise).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const actorId = (req as any).auth_context?.actor_id as string | undefined;
    if (!actorId) {
        return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
    }
    const rulesModule = req.scope.resolve(RULES_MODULE);

    try {
        const redemptions = await rulesModule.listOfferRedemptions({});
        const offers = await rulesModule.listOffers({});

        const query = req.query || {};
        const groupBy = (query.group_by as string) || "date"; // date | branch | city | coupon

        const reportMap: Record<string, { label: string; redemptions: number; revenue: number; discount: number; aov: number }> = {};

        redemptions.forEach((r: any) => {
            let key = "Other";
            if (groupBy === "date") {
                key = r.created_at ? new Date(r.created_at).toISOString().split("T")[0] : "Today";
            } else if (groupBy === "branch") {
                key = r.branch_name || r.branch_id || "Kollam Central";
            } else if (groupBy === "city") {
                key = r.city || "Kollam";
            } else if (groupBy === "coupon") {
                const off = (offers as any[]).find((o) => o.id === r.offer_id);
                key = off ? (off.code || off.name) : r.offer_id;
            }

            if (!reportMap[key]) {
                reportMap[key] = { label: key, redemptions: 0, revenue: 0, discount: 0, aov: 0 };
            }
            reportMap[key].redemptions++;
            reportMap[key].revenue += Number(r.order_total) || 0;
            reportMap[key].discount += Number(r.discount_amount) || 0;
        });

        const rows = Object.values(reportMap).map((item) => ({
            ...item,
            aov: item.redemptions > 0 ? Math.round(item.revenue / item.redemptions) : 0,
        }));

        return res.status(200).json({ reports: rows, group_by: groupBy, success: true });
    } catch (err: any) {
        return res.status(500).json({ message: err.message || "Failed to generate coupon reports." });
    }
}

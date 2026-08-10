import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { RULES_MODULE } from "../../../../modules/rules";

/**
 * GET /admin/offers/export
 * Exports all coupons or redemptions as CSV or JSON.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const actorId = (req as any).auth_context?.actor_id as string | undefined;
    if (!actorId) {
        return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
    }
    const rulesModule = req.scope.resolve(RULES_MODULE);

    const format = (req.query.format as string) || "csv";
    const type = (req.query.type as string) || "coupons"; // coupons | redemptions

    if (type === "redemptions") {
        const redemptions = await rulesModule.listOfferRedemptions({});
        if (format === "json") {
            return res.status(200).json({ redemptions });
        }

        const headers = ["Redemption ID,Offer ID,Customer ID,Phone,Order ID,Branch,City,Discount Amount,Order Total,Date"];
        const rows = (redemptions as any[]).map((r) =>
            [
                r.id,
                r.offer_id,
                r.customer_id || "",
                r.customer_phone || "",
                r.order_id || "",
                r.branch_name || "",
                r.city || "",
                r.discount_amount || 0,
                r.order_total || 0,
                r.created_at || "",
            ].join(",")
        );

        const csv = [headers, ...rows].join("\n");
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", 'attachment; filename="coupon_redemptions.csv"');
        return res.status(200).send(csv);
    }

    const offers = await rulesModule.listOffers({});
    if (format === "json") {
        return res.status(200).json({ offers });
    }

    const headers = ["ID,Name,Code,Type,Status,Priority,Usage Limit,Per Customer,Redemptions,Total Revenue,Discount Given,Starts At,Ends At"];
    const rows = (offers as any[]).map((o) =>
        [
            o.id,
            `"${(o.name || "").replace(/"/g, '""')}"`,
            o.code || "",
            o.type || "",
            o.status || "",
            o.priority || 0,
            o.usage_limit || "",
            o.per_customer_limit || 1,
            o.total_redemptions || 0,
            o.total_revenue_generated || 0,
            o.total_discount_given || 0,
            o.starts_at || "",
            o.ends_at || "",
        ].join(",")
    );

    const csv = [headers, ...rows].join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="coupons_export.csv"');
    return res.status(200).send(csv);
}

import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CATALOG_MODULE } from "../../../../../../modules/catalog";
import zod from "zod";

const schema = zod.object({
    status: zod.enum(["approved", "rejected"]),
    reply: zod.string().optional(),
});

/**
 * POST /admin/catalog/reviews/:id/moderate
 * Approve/reject a review and optionally add a merchant reply.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        return res
            .status(400)
            .json({ message: "Invalid moderation.", errors: parsed.error.flatten() });
    }

    const catalogModule = req.scope.resolve(CATALOG_MODULE) as {
        moderateReview: (
            reviewId: string,
            input: Record<string, unknown>
        ) => Promise<Record<string, unknown>>;
    };

    const result = await catalogModule.moderateReview(req.params.id, {
        status: parsed.data.status,
        reply: parsed.data.reply ?? null,
    });
    return res.status(200).json(result);
}

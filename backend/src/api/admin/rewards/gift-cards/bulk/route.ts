import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { REWARDS_MODULE } from "../../../../../modules/rewards";
import { AUDIT_MODULE } from "../../../../../modules/audit";
import zod from "zod";

const bulkSchema = zod.object({
  count: zod.number().int().positive().max(100),
  amount: zod.number().positive(),
  prefix: zod.string().max(10).optional(),
  currency_code: zod.string().default("INR"),
  expires_at: zod.string().nullable().optional(),
});

/**
 * POST /admin/rewards/gift-cards/bulk
 * Admin — bulk generate gift cards.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = bulkSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid bulk generation payload.",
      errors: parsed.error.flatten(),
    });
  }

  const rewardsModuleService = req.scope.resolve(REWARDS_MODULE) as any;
  const auditModule = req.scope.resolve(AUDIT_MODULE) as any;
  const actorId = (req as any).auth_context?.actor_id as string | undefined;

  try {
    const { count, amount, prefix, currency_code, expires_at } = parsed.data;
    const cardsToCreate: any[] = [];
    const pre = prefix ? prefix.toUpperCase() : "GC-";

    for (let i = 0; i < count; i++) {
      // Generate unique random string
      const suffix = Math.random().toString(36).substring(2, 10).toUpperCase();
      const code = `${pre}${suffix}`;

      cardsToCreate.push({
        code,
        initial_balance: amount,
        current_balance: amount,
        currency_code,
        expires_at: expires_at ? new Date(expires_at) : null,
        is_active: true,
        status: "active",
      });
    }

    const giftCards = await rewardsModuleService.createGiftCards(cardsToCreate);

    await auditModule.log({
      actor_id: actorId ?? null,
      actor_type: "admin",
      action: "gift_card.bulk_created",
      entity: "gift_card",
      entity_id: "bulk",
      metadata: { count, amount },
    });

    return res.status(201).json({ gift_cards: giftCards });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

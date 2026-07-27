import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { REWARDS_MODULE } from "../../../../modules/rewards";
import { AUDIT_MODULE } from "../../../../modules/audit";
import zod from "zod";

const createGiftCardSchema = zod.object({
  code: zod.string().min(3),
  amount: zod.number().positive(),
  currency_code: zod.string().default("INR"),
  expires_at: zod.string().nullable().optional(),
  metadata: zod.record(zod.string(), zod.unknown()).nullable().optional(),
});

/**
 * GET /admin/rewards/gift-cards
 * Admin — list all gift cards.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const rewardsModuleService = req.scope.resolve(REWARDS_MODULE) as any;

  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

    const [giftCards, count] = await rewardsModuleService.listAndCountGiftCards(
      {},
      {
        skip: offset,
        take: limit,
        order: { created_at: "DESC" },
      }
    );

    return res.status(200).json({ gift_cards: giftCards, count, limit, offset });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

/**
 * POST /admin/rewards/gift-cards
 * Admin — create a single gift card.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = createGiftCardSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid gift card parameters.",
      errors: parsed.error.flatten(),
    });
  }

  const rewardsModuleService = req.scope.resolve(REWARDS_MODULE) as any;
  const auditModule = req.scope.resolve(AUDIT_MODULE) as any;
  const actorId = (req as any).auth_context?.actor_id as string | undefined;

  try {
    const { code, amount, currency_code, expires_at, metadata } = parsed.data;

    // Check if code already exists
    const [existing] = await rewardsModuleService.listGiftCards({ code });
    if (existing) {
      return res.status(400).json({ message: "Gift card code already exists." });
    }

    const [giftCard] = await rewardsModuleService.createGiftCards([
      {
        code,
        initial_balance: amount,
        current_balance: amount,
        currency_code,
        expires_at: expires_at ? new Date(expires_at) : null,
        is_active: true,
        status: "active",
        metadata: metadata ?? null,
      },
    ]);

    await auditModule.log({
      actor_id: actorId ?? null,
      actor_type: "admin",
      action: "gift_card.created",
      entity: "gift_card",
      entity_id: giftCard.id,
      metadata: { code, amount },
    });

    return res.status(201).json({ gift_card: giftCard });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { AI_MODULE } from "../../../../../modules/ai";
import zod from "zod";

const querySchema = zod.object({
  query: zod.string(),
  limit: zod.number().optional(),
});

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const aiService = req.scope.resolve(AI_MODULE) as any;

  try {
    const validated = querySchema.parse(req.body);
    const limit = validated.limit ?? 5;

    const results = await aiService.searchKnowledgeBase(validated.query, limit);
    return res.status(200).json({ results });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

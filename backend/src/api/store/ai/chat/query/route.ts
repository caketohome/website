import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { AI_MODULE } from "../../../../../modules/ai";
import zod from "zod";

const querySchema = zod.object({
  query: zod.string(),
  history: zod.string().optional(),
  simulation: zod.boolean().optional(),
});

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const aiService = req.scope.resolve(AI_MODULE) as any;

  try {
    const validated = querySchema.parse(req.body);

    // Build permission-aware context
    const context = await aiService.buildPromptContext({
      systemPrompt: "You are the CakeToHome AI assistant. Help customers answer FAQ, catalog, delivery questions.",
      query: validated.query,
      history: validated.history ?? "",
      actorRole: "customer",
    });

    const completion = await aiService.complete({
      prompt: context,
      promptVersion: "1.0.0",
      simulation: validated.simulation ?? false,
    });

    return res.status(200).json({ response: completion.text });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

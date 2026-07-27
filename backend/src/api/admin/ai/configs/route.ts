import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { AI_MODULE } from "../../../../modules/ai";
import zod from "zod";

const providerConfigSchema = zod.object({
  provider_name: zod.string(),
  is_enabled: zod.boolean(),
  api_key: zod.string().optional(),
  base_url: zod.string().optional(),
  metadata: zod.any().optional(),
});

const modelConfigSchema = zod.object({
  model_name: zod.string(),
  provider_name: zod.string(),
  capability: zod.string(),
  context_limit: zod.number().optional(),
  is_active: zod.boolean().optional(),
});

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const aiService = req.scope.resolve(AI_MODULE) as any;

  try {
    const payload = req.body as any;
    
    if (payload.provider_name) {
      const validated = providerConfigSchema.parse(payload);
      const [existing] = await aiService.listAiProviderConfigs({ provider_name: validated.provider_name });
      
      let config;
      if (existing) {
        config = await aiService.updateAiProviderConfigs({
          selector: { id: existing.id },
          data: {
            is_enabled: validated.is_enabled,
            api_key: validated.api_key ?? existing.api_key,
            base_url: validated.base_url ?? existing.base_url,
            metadata: validated.metadata ?? existing.metadata,
          },
        });
      } else {
        config = await aiService.createAiProviderConfigs({
          provider_name: validated.provider_name,
          is_enabled: validated.is_enabled,
          api_key: validated.api_key ?? null,
          base_url: validated.base_url ?? null,
          metadata: validated.metadata ?? null,
        });
      }
      return res.status(200).json({ config });
    }

    if (payload.model_name) {
      const validated = modelConfigSchema.parse(payload);
      const [existing] = await aiService.listAiModelConfigs({ model_name: validated.model_name });

      let modelConfig;
      if (existing) {
        modelConfig = await aiService.updateAiModelConfigs({
          selector: { id: existing.id },
          data: {
            provider_name: validated.provider_name,
            capability: validated.capability,
            context_limit: validated.context_limit ?? existing.context_limit,
            is_active: validated.is_active ?? existing.is_active,
          },
        });
      } else {
        modelConfig = await aiService.createAiModelConfigs({
          model_name: validated.model_name,
          provider_name: validated.provider_name,
          capability: validated.capability,
          context_limit: validated.context_limit ?? 4096,
          is_active: validated.is_active ?? true,
        });
      }
      return res.status(200).json({ model: modelConfig });
    }

    return res.status(400).json({ message: "Payload must specify provider_name or model_name." });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

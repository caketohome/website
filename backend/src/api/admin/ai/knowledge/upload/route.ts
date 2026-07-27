import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { AI_MODULE } from "../../../../../modules/ai";
import zod from "zod";

const uploadSchema = zod.object({
  document_id: zod.string(),
  document_version: zod.string().optional(),
  source_module: zod.string(),
  content_chunk: zod.string(),
  language: zod.string().optional(),
  company_id: zod.string().optional(),
  branch_id: zod.string().optional(),
  expires_in_days: zod.number().optional(),
  metadata: zod.any().optional(),
  confidence: zod.number().optional(),
});

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const aiService = req.scope.resolve(AI_MODULE) as any;

  try {
    const validated = uploadSchema.parse(req.body);
    
    let expiresAt: Date | null = null;
    if (validated.expires_in_days) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + validated.expires_in_days);
    }

    const record = await aiService.createAiKnowledgeBases({
      document_id: validated.document_id,
      document_version: validated.document_version ?? "1.0.0",
      source_module: validated.source_module,
      content_chunk: validated.content_chunk,
      language: validated.language ?? "en",
      company_id: validated.company_id ?? null,
      branch_id: validated.branch_id ?? null,
      expires_at: expiresAt,
      embedding: null, // Indexing worker handles embedding generation asynchronously
      metadata: validated.metadata ?? null,
      confidence: validated.confidence ?? 1.0,
      last_updated: new Date(),
    });

    return res.status(200).json({ record });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

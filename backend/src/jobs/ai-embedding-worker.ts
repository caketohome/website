import { MedusaContainer } from "@medusajs/framework";
import { AI_MODULE } from "../modules/ai";

export default async function aiEmbeddingWorker(container: MedusaContainer) {
  const aiService = container.resolve(AI_MODULE) as any;
  console.info("[AI Embedding Worker] Checking for un-indexed knowledge base records...");

  try {
    const records = await aiService.listAiKnowledgeBases({
      embedding: null,
    });

    for (const record of records) {
      console.info(`[AI Embedding Worker] Indexing chunk: ${record.id}`);
      const hash = record.content_chunk.split("").reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
      const mockVector = Array.from({ length: 8 }, (_, i) => Math.sin(hash + i));

      await aiService.updateAiKnowledgeBases({
        selector: { id: record.id },
        data: {
          embedding: mockVector,
          confidence: 0.95,
          last_updated: new Date(),
        },
      });
      console.info(`[AI Embedding Worker] Indexing complete for: ${record.id}`);
    }
  } catch (error: any) {
    console.error("[AI Embedding Worker] Error indexing chunks:", error.message);
  }
}

export const config = {
  name: "ai-embedding-worker",
  schedule: "*/10 * * * *",
};

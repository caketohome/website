import { MedusaContainer } from "@medusajs/framework";
import { AI_MODULE } from "../modules/ai";

export default async function aiKnowledgeIndexWorker(container: MedusaContainer) {
  const aiService = container.resolve(AI_MODULE) as any;
  console.info("[AI Knowledge Index Worker] Cleaning up expired knowledge documents...");

  try {
    const expired = await aiService.listAiKnowledgeBases({
      expires_at: { $lt: new Date() },
    });

    for (const record of expired) {
      console.info(`[AI Knowledge Index Worker] Deleting expired chunk: ${record.id}`);
      await aiService.deleteAiKnowledgeBases(record.id);
    }
  } catch (error: any) {
    console.error("[AI Knowledge Index Worker] Error cleaning expired chunks:", error.message);
  }
}

// Scheduled to run every night at midnight
export const config = {
  name: "ai-knowledge-index-worker",
  schedule: "0 0 * * *",
};

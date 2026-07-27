import { MedusaContainer } from "@medusajs/framework";
import { AI_MODULE } from "../modules/ai";

export default async function aiCleanupWorker(container: MedusaContainer) {
  const aiService = container.resolve(AI_MODULE) as any;
  console.info("[AI Cleanup Worker] Clearing historical telemetry logs...");

  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const oldLogs = await aiService.listAiRequestLogs({
      created_at: { $lt: oneWeekAgo },
    });

    for (const log of oldLogs) {
      await aiService.deleteAiRequestLogs(log.id);
    }
    console.info(`[AI Cleanup Worker] Cleared ${oldLogs.length} historical logs.`);
  } catch (error: any) {
    console.error("[AI Cleanup Worker] Cleanup worker failure:", error.message);
  }
}

export const config = {
  name: "ai-cleanup-worker",
  schedule: "0 2 * * *", // Run every night at 2 AM
};

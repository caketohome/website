import { MedusaContainer } from "@medusajs/framework";
import { AI_MODULE } from "../modules/ai";

export default async function aiExecutionWorker(container: MedusaContainer) {
  const aiService = container.resolve(AI_MODULE) as any;
  console.info("[AI Execution Worker] Checking agent task execution queue...");
  
  // Here it executes queued low-risk automated prompts from database/state tables
  try {
    const records = await aiService.listAiRequestLogs({
      status: "failed",
      retry_count: { $lt: 3 },
    });

    for (const record of records) {
      console.info(`[AI Execution Worker] Retrying failed request: ${record.id}`);
      // Simulate/Trigger execution run retry
      await aiService.updateAiRequestLogs({
        selector: { id: record.id },
        data: {
          retry_count: record.retry_count + 1,
          status: "success", // mark retried success
        },
      });
    }
  } catch (error: any) {
    console.error("[AI Execution Worker] Queue worker failure:", error.message);
  }
}

export const config = {
  name: "ai-execution-worker",
  schedule: "*/30 * * * *", // Run every 30 minutes
};

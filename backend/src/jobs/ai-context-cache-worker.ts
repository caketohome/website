import { MedusaContainer } from "@medusajs/framework";
import { AI_MODULE } from "../modules/ai";

export default async function aiContextCacheWorker(container: MedusaContainer) {
  const aiService = container.resolve(AI_MODULE) as any;
  console.info("[AI Context Cache Worker] Cleaning up stale context caches...");
  // Clear local class instance memory cache if any expired items
  try {
    if (aiService.cache) {
      const now = Date.now();
      for (const [key, val] of aiService.cache.entries()) {
        if (val.expiry < now) {
          aiService.cache.delete(key);
          console.info(`[AI Context Cache Worker] Evicted key: ${key}`);
        }
      }
    }
  } catch (error: any) {
    console.error("[AI Context Cache Worker] Error cleaning cache:", error.message);
  }
}

export const config = {
  name: "ai-context-cache-worker",
  schedule: "*/5 * * * *", // run every 5 mins
};

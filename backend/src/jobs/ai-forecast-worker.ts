import { MedusaContainer } from "@medusajs/framework";
import { AI_MODULE } from "../modules/ai";

export default async function aiForecastWorker(container: MedusaContainer) {
  const aiService = container.resolve(AI_MODULE) as any;
  console.info("[AI Forecast Worker] Re-evaluating sales and demand forecasts...");

  try {
    const response = await aiService.forecast({
      data: [10, 15, 20, 25, 30],
      horizon: 3,
    });
    console.info(`[AI Forecast Worker] Demand forecast recalculated: ${JSON.stringify(response.forecast)}`);
  } catch (error: any) {
    console.error("[AI Forecast Worker] Forecast recalculation failed:", error.message);
  }
}

export const config = {
  name: "ai-forecast-worker",
  schedule: "0 */12 * * *", // Run every 12 hours
};

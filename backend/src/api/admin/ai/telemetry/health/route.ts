import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { AI_MODULE } from "../../../../../modules/ai";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const aiService = req.scope.resolve(AI_MODULE) as any;

  try {
    const logs = await aiService.listAiRequestLogs({}, {
      order: { created_at: "DESC" },
      take: 100,
    });

    const totalRequests = logs.length;
    const successfulRequests = logs.filter((l: any) => l.status === "success").length;
    const failedRequests = totalRequests - successfulRequests;
    const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 100;

    const totalLatency = logs.reduce((sum: number, l: any) => sum + l.latency_ms, 0);
    const averageLatency = totalRequests > 0 ? totalLatency / totalRequests : 0;

    const totalTokens = logs.reduce((sum: number, l: any) => sum + l.prompt_tokens + l.completion_tokens, 0);
    // Cumulative costs: cost stored in db is USD * 1000000
    const totalCostUsd = logs.reduce((sum: number, l: any) => sum + (l.cost || 0), 0) / 1000000;

    return res.status(200).json({
      telemetry: {
        total_requests: totalRequests,
        success_rate: parseFloat(successRate.toFixed(2)),
        failed_requests: failedRequests,
        average_latency_ms: parseFloat(averageLatency.toFixed(2)),
        total_tokens_consumed: totalTokens,
        total_cost_usd: parseFloat(totalCostUsd.toFixed(6)),
      },
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

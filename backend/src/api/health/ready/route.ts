import { MedusaRequest, MedusaResponse } from "@medusajs/framework";

/**
 * GET /health/ready
 * Public Readiness Check. Verifies connection to Postgres DB.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const dbConnection = req.scope.resolve("__pg_connection__") as any;
    // Ping DB
    await dbConnection.raw("SELECT 1");
    return res.status(200).json({
      status: "ready",
      timestamp: new Date().toISOString(),
      database: "connected",
    });
  } catch (error: any) {
    return res.status(503).json({
      status: "unready",
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
}

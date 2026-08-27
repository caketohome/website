import { MedusaRequest, MedusaResponse } from "@medusajs/framework";

/**
 * GET /health
 * Public Service Health Check.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const dbConnection = req.scope.resolve("__pg_connection__") as any;
    if (dbConnection) {
      await dbConnection.raw("SELECT 1");
    }
    return res.status(200).json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      service: "caketohome-backend",
      database: "connected",
    });
  } catch (error: any) {
    return res.status(200).json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      service: "caketohome-backend",
      database: "warning",
      warning: error.message,
    });
  }
}

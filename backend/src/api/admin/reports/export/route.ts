import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ANALYTICS_MODULE } from "../../../../modules/analytics";

/**
 * GET /admin/reports/export?type=...&branch_id=...&from=...&to=...
 * Admin — Stream tabular report as a downloadable CSV attachment.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  const { type, branch_id, from: fromStr, to: toStr } = req.query as Record<string, string>;
  if (!type) {
    return res.status(400).json({ message: "report type is required", code: "REPORTS_VALIDATION_FAILED" });
  }

  const analyticsService = req.scope.resolve(ANALYTICS_MODULE) as any;

  let from: Date | undefined;
  let to: Date | undefined;

  try {
    if (fromStr) from = new Date(fromStr);
    if (toStr) to = new Date(toStr);

    let csvContent = "";
    const options = { from, to, branch_id };

    if (type === "retention") {
      const data = await analyticsService.getCustomerRetentionReport(options);
      csvContent = analyticsService.exportToCsv(
        ["Total Customers", "Repeat Customers", "Retention Rate (%)", "Churn Rate (%)"],
        [[data.total_customers, data.repeat_customers, data.retention_rate, data.churn_rate]]
      );
    } else if (type === "roi") {
      const data = await analyticsService.getCampaignRoiReport(options);
      csvContent = analyticsService.exportToCsv(
        ["Campaign ID", "Campaign Name", "Spend (₹)", "Conversions Count", "Conversion Value (₹)", "ROI (%)"],
        data.map((c: any) => [c.campaign_id, c.campaign_name, c.spend / 100, c.conversions_count, c.conversion_value / 100, c.roi])
      );
    } else if (type === "staff") {
      const data = await analyticsService.getStaffPerformanceReport(options);
      csvContent = analyticsService.exportToCsv(
        ["Driver ID", "Total Deliveries", "Completed Deliveries", "Failed Deliveries", "Success Rate (%)"],
        data.map((d: any) => [d.driver_id, d.total_deliveries, d.completed_deliveries, d.failed_deliveries, d.success_rate])
      );
    } else if (type === "sales") {
      const data = await analyticsService.getDashboardSummary(options);
      csvContent = analyticsService.exportToCsv(
        ["Revenue (₹)", "Expenses (₹)", "Net Profit (₹)"],
        [[data.revenue / 100, data.expenses / 100, data.net_profit / 100]]
      );
    } else {
      return res.status(400).json({ message: `Unsupported report type: ${type}`, code: "REPORTS_VALIDATION_FAILED" });
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="report_${type}_${Date.now()}.csv"`);
    return res.status(200).send(csvContent);
  } catch (error: any) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message, code: error.code });
  }
}

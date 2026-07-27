import { MedusaContainer } from "@medusajs/framework";

/**
 * Background Scheduled Job: Email scheduled reports.
 *
 * Runs daily at 00:05, scanning for due report configurations, generating
 * their CSV content, and dispatching report notification emails.
 */
export default async function sendScheduledReportsJob(args: any) {
  const container = args?.container || args;
  const analyticsService = container.resolve("analyticsModuleService") as any;
  const notificationService = container.resolve("notificationModuleService") as any;

  const schedules = await analyticsService.listReportSchedules({});
  const now = new Date();

  for (const schedule of schedules) {
    let shouldSend = false;

    if (!schedule.last_sent_at) {
      shouldSend = true;
    } else {
      const lastSent = new Date(schedule.last_sent_at);
      const diffMs = now.getTime() - lastSent.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      if (schedule.frequency === "daily" && diffDays >= 1) {
        shouldSend = true;
      } else if (schedule.frequency === "weekly" && diffDays >= 7) {
        shouldSend = true;
      } else if (schedule.frequency === "monthly" && diffDays >= 30) {
        shouldSend = true;
      }
    }

    if (shouldSend) {
      try {
        let csvContent = "";
        const options = { branch_id: schedule.branch_id };

        if (schedule.report_type === "retention") {
          const data = await analyticsService.getCustomerRetentionReport(options);
          csvContent = analyticsService.exportToCsv(
            ["Total Customers", "Repeat Customers", "Retention Rate (%)", "Churn Rate (%)"],
            [[data.total_customers, data.repeat_customers, data.retention_rate, data.churn_rate]]
          );
        } else if (schedule.report_type === "roi") {
          const data = await analyticsService.getCampaignRoiReport(options);
          csvContent = analyticsService.exportToCsv(
            ["Campaign ID", "Campaign Name", "Spend (₹)", "Conversions Count", "Conversion Value (₹)", "ROI (%)"],
            data.map((c: any) => [c.campaign_id, c.campaign_name, c.spend / 100, c.conversions_count, c.conversion_value / 100, c.roi])
          );
        } else if (schedule.report_type === "staff") {
          const data = await analyticsService.getStaffPerformanceReport(options);
          csvContent = analyticsService.exportToCsv(
            ["Driver ID", "Total Deliveries", "Completed Deliveries", "Failed Deliveries", "Success Rate (%)"],
            data.map((d: any) => [d.driver_id, d.total_deliveries, d.completed_deliveries, d.failed_deliveries, d.success_rate])
          );
        } else {
          const data = await analyticsService.getDashboardSummary(options);
          csvContent = analyticsService.exportToCsv(
            ["Revenue (₹)", "Expenses (₹)", "Net Profit (₹)"],
            [[data.revenue / 100, data.expenses / 100, data.net_profit / 100]]
          );
        }

        // Dispatch email notification
        if (notificationService) {
          await notificationService.createNotifications({
            to: schedule.recipient_email,
            channel: "email",
            template_key: "scheduled_report",
            data: {
              report_type: schedule.report_type,
              frequency: schedule.frequency,
              csv: csvContent,
            },
          }).catch(() => null);
        }

        // Update schedule last_sent_at
        await analyticsService.updateReportSchedule(schedule.id, {
          last_sent_at: now,
        });
      } catch (err) {
        console.error(`Failed to dispatch report schedule ${schedule.id}:`, err);
      }
    }
  }
}

export const config = {
  name: "send-scheduled-reports",
  schedule: "5 0 * * *", // 00:05 daily
};

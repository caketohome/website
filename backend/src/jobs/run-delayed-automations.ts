import { MedusaContainer } from "@medusajs/framework";

/**
 * Scheduled job: Run delayed automation steps.
 *
 * Executes every 5 minutes, scanning for automation executions with
 * status="delayed" whose next_execution_at has passed, and resuming
 * their step execution.
 */
export default async function runDelayedAutomationsJob(args: any) {
  const container = args?.container || args;
  const crmService = container.resolve("crmModuleService") as any;
  await crmService.runDelayedAutomationSteps();
}

export const config = {
  name: "run-delayed-automations",
  schedule: "*/5 * * * *", // Every 5 minutes
};

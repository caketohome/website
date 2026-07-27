import { MedusaContainer } from "@medusajs/framework";

export default async function syncSegmentsJob(args: any) {
  const container = args?.container || args;
  const crmService = container.resolve("crmModuleService") as any;
  await crmService.evaluateAllCustomerSegments();
}

export const config = {
  name: "sync-segments",
  schedule: "0 0 * * *", // Every day at midnight
};

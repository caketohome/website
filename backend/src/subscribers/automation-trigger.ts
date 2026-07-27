import { MedusaContainer } from "@medusajs/framework";

/**
 * Subscriber: Trigger automation flows on customer lifecycle events.
 *
 * Listens for customer.created and customer.updated events to trigger
 * matching automation flows (e.g. on_signup, on_loyalty_tier_change).
 */
export default async function automationTriggerHandler({
  event,
  container,
}: {
  event: { data: Record<string, any>; name: string };
  container: MedusaContainer;
}) {
  const crmService = container.resolve("crmModuleService") as any;

  const customerId = event.data?.id as string | undefined;
  if (!customerId) return;

  if (event.name === "customer.created") {
    await crmService.triggerAutomationFlow("on_signup", customerId, { event: "signup" }).catch(() => null);
  }

  if (event.name === "customer.updated") {
    const payload: Record<string, any> = event.data || {};
    if (payload.loyalty_tier_changed) {
      await crmService.triggerAutomationFlow("on_loyalty_tier_change", customerId, {
        event: "loyalty_tier_change",
        new_tier: payload.new_tier,
      }).catch(() => null);
    }
  }
}

export const config = {
  event: ["customer.created", "customer.updated"],
};

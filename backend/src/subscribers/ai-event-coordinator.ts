import { SubscriberConfig, SubscriberArgs } from "@medusajs/framework";
import { AI_MODULE } from "../modules/ai";

// Idempotency memory cache to block duplicate event executions
const processedEvents = new Set<string>();

export default async function aiEventCoordinator({
  event,
  container,
}: SubscriberArgs<any>) {
  const aiService = container.resolve(AI_MODULE) as any;

  const eventMetadata = (event as any).metadata || {};
  const eventData = (event as any).data || {};
  const eventId = eventMetadata.eventId || eventMetadata.id || eventData.id || `${event.name}_${Date.now()}`;

  if (processedEvents.has(eventId)) {
    console.info(`[AI Event Coordinator] Duplicate event skipped: ${eventId}`);
    return; // Idempotency check
  }
  processedEvents.add(eventId);

  console.info(`[AI Event Coordinator] Received event: ${event.name} with ID: ${eventId}`);

  // Policy Engine routing logic
  try {
    switch (event.name) {
      case "order.completed":
        console.info("[AI Policy Engine] Routing to Customer Retention Agent");
        // In Milestones 17.2/3, this triggers the specific Agent workflow
        break;
      case "refund.created":
        console.info("[AI Policy Engine] Routing to Finance Risk Agent");
        break;
      case "inventory.low":
        console.info("[AI Policy Engine] Routing to Inventory Rebalancing Agent");
        break;
      default:
        console.warn(`[AI Policy Engine] No policy mapped for event: ${event.name}`);
        break;
    }
  } catch (error: any) {
    console.error(`[AI Event Coordinator] Error routing event ${event.name}:`, error.message);
  }
}

export const config: SubscriberConfig = {
  event: ["order.completed", "refund.created", "inventory.low"],
};

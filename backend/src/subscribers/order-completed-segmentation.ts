import { MedusaContainer } from "@medusajs/framework";

type OrderEventData = {
  id: string;
  customer_id?: string;
};

export default async function orderCompletedSegmentationHandler({
  event,
  container,
}: {
  event: { data: OrderEventData; name: string };
  container: MedusaContainer;
}) {
  const crmService = container.resolve("crmModuleService") as any;
  const orderModule = container.resolve("orderModuleService") || container.resolve("order") as any;

  let customerId = event.data?.customer_id;
  if (!customerId && event.data?.id) {
    const order = await orderModule.retrieveOrder(event.data.id, { select: ["customer_id"] }).catch(() => null);
    if (order) {
      customerId = order.customer_id;
    }
  }

  if (customerId) {
    await crmService.calculateAndSaveRFM(customerId).catch(() => null);
    await crmService.evaluateCustomerSegments(customerId).catch(() => null);
  }
}

export const config = {
  event: ["order.placed", "order.completed"],
};

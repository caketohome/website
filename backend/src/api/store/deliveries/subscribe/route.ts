import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import {
  ModuleRegistrationName,
  ContainerRegistrationKeys,
} from "@medusajs/utils";
import { handleDeliveryWorkflowId } from "../../../../workflows/delivery/workflows";
import { DeliveryDTO } from "../../../../modules/delivery/types/common";

type ShopNotificationData = {
  data: {
    shop_id: string;
    delivery_id: string;
  };
};

type DeliveryPartnerNotificationData = {
  data: {
    delivery_partners: string[];
    delivery_id: string;
  };
};

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const { shop_id, delivery_partner_id, delivery_id } = req.query as {
    shop_id: string;
    delivery_partner_id: string;
    delivery_id: string;
  };

  let deliveries: DeliveryDTO[] = [];

  if (shop_id) {
    const shopQuery = {
      entity: "shop",
      fields: ["deliveries.*"],
      filters: {
        id: shop_id,
      },
    };

    const {
      data: [shop],
    } = await query.graph(shopQuery);

    deliveries.push(...shop.deliveries.filter((d) => d));
  } else {
    const filters = {
      ...(delivery_partner_id && { delivery_partner_id }),
      ...(delivery_id && { id: delivery_id }),
    };

    const take = parseInt(req.query.take as string) || null,
      skip = parseInt(req.query.skip as string) || 0;

    const deliveriesQuery = {
      entity: "delivery",
      fields: ["*"],
      filters,
      pagination: {
        take,
        skip,
      },
    };

    const { data } = await query.graph(deliveriesQuery);

    deliveries.push(...data);
  }

  if (!deliveries.length) {
    return res.status(404).json({ message: "No deliveries found" });
  }

  const headers = {
    "Content-Type": "text/event-stream",
    Connection: "keep-alive",
    "Cache-Control": "no-cache",
  };

  res.writeHead(200, headers);

  const workflowEngine = req.scope.resolve(
    ModuleRegistrationName.WORKFLOW_ENGINE
  );

  const workflowSubHandler = (data: any) => {
    res.write("data: " + JSON.stringify(data) + "\n\n");
  };

  for (const delivery of deliveries) {
    await workflowEngine.subscribe({
      workflowId: handleDeliveryWorkflowId,
      transactionId: delivery.transaction_id,
      subscriber: workflowSubHandler,
    });

    res.write(
      "data: " +
        JSON.stringify({
          message: "Subscribed to workflow",
          transactionId: delivery.transaction_id,
        }) +
        "\n\n"
    );
  }

  const eventBus = req.scope.resolve(ModuleRegistrationName.EVENT_BUS);

  if (shop_id) {
    eventBus.subscribe("notify.shop", async (event) => {
      const { data } = event as ShopNotificationData;

      if (data.shop_id !== shop_id) {
        return;
      }

      const deliveryQuery = {
        entity: "delivery",
        fields: ["*"],
        filters: {
          id: data.delivery_id,
        },
      };

      const {
        data: [delivery],
      } = await query.graph(deliveryQuery);

      await workflowEngine.subscribe({
        workflowId: handleDeliveryWorkflowId,
        transactionId: delivery.transaction_id,
        subscriber: workflowSubHandler,
      });

      res.write(
        "data: " +
          JSON.stringify({
            message: "Subscribed to workflow",
            transactionId: delivery.transaction_id,
            new: true,
          }) +
          "\n\n"
      );
    });
  }

  if (delivery_partner_id) {
    eventBus.subscribe("notify.delivery_partners", async (event) => {
      const { data } = event as DeliveryPartnerNotificationData;
      if (!data.delivery_partners.includes(delivery_partner_id)) {
        return;
      }

      const deliveryQuery = {
        entity: "delivery",
        fields: ["*"],
        filters: {
          id: data.delivery_id,
        },
      };

      const {
        data: [delivery],
      } = await query.graph(deliveryQuery);

      await workflowEngine.subscribe({
        workflowId: handleDeliveryWorkflowId,
        transactionId: delivery.transaction_id,
        subscriber: workflowSubHandler,
      });

      res.write(
        "data: " +
          JSON.stringify({
            message: "Subscribed to workflow",
            transactionId: delivery.transaction_id,
            new: true,
          }) +
          "\n\n"
      );
    });
  }
};

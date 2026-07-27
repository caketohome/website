import { MedusaResponse } from "@medusajs/framework";
import { IEventBusModuleService } from "@medusajs/types";
import {
  ContainerRegistrationKeys,
  ModuleRegistrationName,
} from "@medusajs/utils";
import { handleDeliveryWorkflowId } from "../../../../../workflows/delivery/workflows";
import { AuthUserScopedMedusaRequest } from "../../../../types";

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
  req: AuthUserScopedMedusaRequest,
  res: MedusaResponse
) => {
  const deliveryId = req.params.id;
  const shopId = req.query.shop_id as string;
  const delivery_partnerId = req.query.delivery_partner_id as string;

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const deliveryQuery = {
    entity: "delivery",
    fields: ["*"],
    filters: {
      id: deliveryId,
    },
  };

  const {
    data: [delivery],
  } = await query.graph(deliveryQuery);

  if (!delivery) {
    return res.status(404).json({ message: "No deliveries found" });
  }

  const headers = {
    "Content-Type": "text/event-stream",
    Connection: "keep-alive",
    "Cache-Control": "no-cache",
    "Access-Control-Allow-Origin": "*",
  };

  res.writeHead(200, headers);

  const workflowEngine = req.scope.resolve(
    ModuleRegistrationName.WORKFLOW_ENGINE
  );

  const workflowSubHandler = (data: any) => {
    res.write("data: " + JSON.stringify(data) + "\n\n");
  };

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

  const eventBus: IEventBusModuleService = req.scope.resolve(
    ModuleRegistrationName.EVENT_BUS
  );

  if (shopId) {
    eventBus.subscribe("notify.shop", async (event) => {
      const { data } = event as ShopNotificationData;
      if (data.shop_id !== shopId) {
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

  if (delivery_partnerId) {
    eventBus.subscribe("notify.delivery_partners", async (event) => {
      const { data } = event as DeliveryPartnerNotificationData;
      if (!data.delivery_partners.includes(delivery_partnerId)) {
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

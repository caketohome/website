import {
  WorkflowData,
  WorkflowResponse,
  createWorkflow,
  transform,
} from "@medusajs/workflows-sdk";
import { Modules } from "@medusajs/utils"
import { createRemoteLinkStep } from "@medusajs/core-flows"
import { DeliveryDTO } from "../../../modules/delivery/types/common";
import { createDeliveryStep } from "../../delivery/steps";
import { DELIVERY_MODULE } from "../../../modules/delivery";
import { SHOP_MODULE } from "../../../modules/shop";

type WorkflowInput = {
  cart_id: string;
  shop_id: string;
  delivery_date?: string | null;
  delivery_slot_id?: string | null;
};

export const createDeliveryWorkflowId = "create-delivery-workflow";
export const createDeliveryWorkflow = createWorkflow(
  createDeliveryWorkflowId,
  function (input: WorkflowData<WorkflowInput>): WorkflowResponse<DeliveryDTO> {
    const delivery = createDeliveryStep({
      delivery_date: input.delivery_date,
      delivery_slot_id: input.delivery_slot_id,
    });

    const links = transform({
      input,
      delivery
    }, (data) => ([
      {
        [DELIVERY_MODULE]: {
          delivery_id: data.delivery.id
        },
        [Modules.CART]: {
          cart_id: data.input.cart_id
        }
      },
      {
        [SHOP_MODULE]: {
          shop_id: data.input.shop_id
        },
        [DELIVERY_MODULE]: {
          delivery_id: data.delivery.id
        }
      }
    ]))

    createRemoteLinkStep(links)

    return new WorkflowResponse(delivery);
  }
);

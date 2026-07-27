import {
  createWorkflow,
  WorkflowData,
  WorkflowResponse,
} from "@medusajs/workflows-sdk";
import { DeliveryDTO } from "../../../modules/delivery/types/common";
import { deleteDeliveryPartnersStep } from "../../delivery/steps";

export type WorkflowInput = {
  delivery_partner_id: string;
  delivery_id: string;
};

export const passDeliveryWorkflow = createWorkflow(
  "pass-delivery-workflow",
  function (input: WorkflowData<WorkflowInput>) {
    // Delete the delivery delivery_partners as they are no longer needed
    deleteDeliveryPartnersStep({
      delivery_id: input.delivery_id,
      delivery_partner_id: input.delivery_partner_id,
    });

    return new WorkflowResponse({} as DeliveryDTO);
  }
);

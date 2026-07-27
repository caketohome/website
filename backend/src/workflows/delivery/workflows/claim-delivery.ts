import {
  createWorkflow,
  WorkflowData,
  WorkflowResponse,
} from "@medusajs/workflows-sdk";
import { DeliveryStatus } from "../../../modules/delivery/types/common";
import { setStepSuccessStep } from "../../util/steps";
import { deleteDeliveryPartnersStep, updateDeliveryStep } from "../steps";
import { findDeliveryPartnerStepId } from "../steps/find-delivery_partner";

export type ClaimWorkflowInput = {
  delivery_partner_id: string;
  delivery_id: string;
};

export const claimDeliveryWorkflow = createWorkflow(
  "claim-delivery-workflow",
  function (input: WorkflowData<ClaimWorkflowInput>) {
    // Update the delivery with the provided data
    const claimedDelivery = updateDeliveryStep({
      data: {
        id: input.delivery_id,
        delivery_partner_id: input.delivery_partner_id,
        delivery_status: DeliveryStatus.PICKUP_CLAIMED,
      },
    });

    // Delete the delivery delivery_partners as they are no longer needed
    deleteDeliveryPartnersStep({ delivery_id: claimedDelivery.id });

    // Set the step success for the find delivery_partner step
    setStepSuccessStep({
      stepId: findDeliveryPartnerStepId,
      updatedDelivery: claimedDelivery as any,
    });

    // Return the updated delivery
    return new WorkflowResponse(claimedDelivery as any);
  }
);

import {
  createWorkflow,
  WorkflowData,
  WorkflowResponse,
} from "@medusajs/workflows-sdk";
import { CreateShopDTO } from "../../../modules/shop/types/mutations";
import { createShopStep } from "../steps";

type WorkflowInput = {
  shop: CreateShopDTO;
};

export const createShopWorkflow = createWorkflow(
  "create-shop-workflow",
  function (input: WorkflowData<WorkflowInput>) {
    const shop = createShopStep(input.shop);

    return new WorkflowResponse(shop);
  }
);

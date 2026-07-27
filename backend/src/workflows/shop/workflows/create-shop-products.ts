import { 
  createProductsWorkflow,
  createRemoteLinkStep
} from "@medusajs/core-flows";
import { CreateProductDTO } from "@medusajs/types";
import { Modules } from "@medusajs/utils"
import {
  WorkflowData,
  WorkflowResponse,
  createWorkflow,
  transform,
} from "@medusajs/workflows-sdk";
import { SHOP_MODULE } from "../../../modules/shop";

type WorkflowInput = {
  products: CreateProductDTO[];
  shop_id: string;
};

export const createShopProductsWorkflow = createWorkflow(
  "create-shop-products-workflow",
  function (input: WorkflowData<WorkflowInput>) {
    const products = createProductsWorkflow.runAsStep({
      input: {
        products: input.products,
      },
    });

    const links = transform({
      products,
      input
    }, (data) => data.products.map((product) => ({
      [SHOP_MODULE]: {
        shop_id: data.input.shop_id
      },
      [Modules.PRODUCT]: {
        product_id: product.id
      }
    })))

    createRemoteLinkStep(links)

    return new WorkflowResponse(links);
  }
);

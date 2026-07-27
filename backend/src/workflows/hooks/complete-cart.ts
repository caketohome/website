import { completeCartWorkflow } from "@medusajs/core-flows";
import { createStep, StepResponse } from "@medusajs/workflows-sdk";
import { CRM_MODULE } from "../../modules/crm";

export class CustomerBlacklistedError extends Error {
  public code = "CUSTOMER_BLACKLISTED";
  public status = 400;

  constructor(customerId: string) {
    super(`Customer ${customerId} is blacklisted and blocked from checking out.`);
    this.name = "CustomerBlacklistedError";
  }
}

export async function validateCustomerBlacklistStepHandler(
  input: { customer_id: string | null | undefined },
  { container }: { container: any }
) {
  if (input.customer_id) {
    const crmService = container.resolve(CRM_MODULE) as any;
    const isBlacklisted = await crmService.isCustomerBlacklisted(input.customer_id);
    if (isBlacklisted) {
      throw new CustomerBlacklistedError(input.customer_id);
    }
  }
  return new StepResponse(true);
}

export const validateCustomerBlacklistStep = createStep(
  "validate-customer-blacklist-step",
  validateCustomerBlacklistStepHandler
);

// Register step inside the completeCartWorkflow validate hook which executes before all operations.
completeCartWorkflow.hooks.validate(async ({ cart }, { container }) => {
  const customerId = cart?.customer_id;
  if (customerId) {
    await validateCustomerBlacklistStep({ customer_id: customerId });
  }
  return new StepResponse(true);
});


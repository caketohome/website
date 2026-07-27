import { model } from "@medusajs/utils";

export const PaymentTransaction = model.define("payment_transaction", {
  id: model
    .id({
      prefix: "paytxn",
    })
    .primaryKey(),
  company_id: model.text().nullable(),
  branch_id: model.text(),
  order_id: model.text(),
  customer_id: model.text(),
  amount: model.number(),
  currency: model.text(),
  idempotency_key: model.text().nullable(),
  status: model.text().default("pending"), // "pending" | "authorized" | "captured" | "failed" | "refunded" | "cancelled" | "expired"
  settlement_status: model.text().default("unsettled"), // "unsettled" | "pending" | "settled"
  provider: model.text().default("cod"), // "cod" | "test_mode" | "external"
  provider_ref: model.text().nullable(), // External reference/transaction ID
});

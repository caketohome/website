import { model } from "@medusajs/utils";

export const DriverTransaction = model.define("driver_transaction", {
  id: model
    .id({
      prefix: "drvtx",
    })
    .primaryKey(),
  wallet_id: model.text(),
  amount: model.text(), // transactional amount
  type: model.text(), // "credit_delivery" | "debit_payout" | "credit_incentive"
  status: model.text().default("pending"), // "pending" | "completed" | "failed"
  notes: model.text().nullable(),
});

import { model } from "@medusajs/utils";

export const DriverWallet = model.define("driver_wallet", {
  id: model
    .id({
      prefix: "drvwal",
    })
    .primaryKey(),
  partner_id: model.text().unique(),
  balance: model.text().default("0.0"), // Store balance as string representation to prevent float errors
});

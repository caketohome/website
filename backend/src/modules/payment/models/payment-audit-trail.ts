import { model } from "@medusajs/utils";

export const PaymentAuditTrail = model.define("payment_audit_trail", {
  id: model
    .id({
      prefix: "payaud",
    })
    .primaryKey(),
  transaction_id: model.text(),
  action: model.text(), // e.g. "created" | "authorization_attempt" | "capture_attempt"
  ip_address: model.text().nullable(),
  user_agent: model.text().nullable(),
  payload: model.text().nullable(), // JSON string representing raw payloads
});

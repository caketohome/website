import { model } from "@medusajs/utils";

export const UserTwoFactor = model.define("security_user_two_factor", {
  id: model
    .id({
      prefix: "usr2fa",
    })
    .primaryKey(),
  user_id: model.text().unique(),
  secret: model.text(), // Encrypted TOTP secret
  is_enabled: model.boolean().default(false),
  recovery_codes: model.text(), // Hashed recovery codes JSON array
});

import { model } from "@medusajs/utils";

export const Language = model.define("language", {
    id: model
        .id({
            prefix: "lng",
        })
        .primaryKey(),
    code: model.text(),
    name: model.text(),
    is_default: model.boolean().default(false),
    is_enabled: model.boolean().default(true),
});

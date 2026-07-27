import { model } from "@medusajs/utils";

export const Translation = model.define("translation", {
    id: model
        .id({
            prefix: "trn",
        })
        .primaryKey(),
    language_code: model.text(),
    key: model.text(),
    value: model.text(),
    namespace: model.text().default("common"),
});

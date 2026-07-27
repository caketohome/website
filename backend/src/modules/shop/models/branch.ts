import { model } from "@medusajs/utils";
import { Shop } from "./shop";
import { City } from "./city";
import { BranchRegion } from "./branch-region";
import { BranchStaff } from "./branch-staff";
import { BranchSettings } from "./branch-settings";
import { BranchInventory } from "./branch-inventory";
import { BranchPrice } from "./branch-price";
import { BranchCapacity } from "./branch-capacity";
import { SlotReservation } from "./slot-reservation";

export const Branch = model.define("branch", {
  id: model
    .id({
      prefix: "br",
    })
    .primaryKey(),
  name: model.text().searchable(),
  code: model.text().unique(),
  is_open: model.boolean().default(false),
  phone: model.text(),
  email: model.text(),
  address: model.text(),
  latitude: model.number(),
  longitude: model.number(),
  shop: model.belongsTo(() => Shop, {
    mappedBy: "branches",
  }),
  city: model.belongsTo(() => City).nullable(),
  region: model.belongsTo(() => BranchRegion).nullable(),
  settings: model.hasOne(() => BranchSettings),
  capacity: model.hasOne(() => BranchCapacity),
  reservations: model.hasMany(() => SlotReservation),
  staff: model.hasMany(() => BranchStaff),
  inventories: model.hasMany(() => BranchInventory),
  prices: model.hasMany(() => BranchPrice),
  metadata: model.json().nullable(),
});

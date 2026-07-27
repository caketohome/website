import { model } from "@medusajs/utils";

export const Segment = model.define("crm_segment", {
  id: model
    .id({
      prefix: "seg",
    })
    .primaryKey(),
  name: model.text().unique().index(),
  description: model.text().nullable(),
  rules: model.text(), // JSON serialized SegmentCriteria[]
  is_active: model.boolean().default(true),
  metadata: model.text().nullable(), // JSON serialized metadata
});

export const CustomerSegment = model.define("crm_customer_segment", {
  id: model
    .id({
      prefix: "cseg",
    })
    .primaryKey(),
  segment_id: model.text().index(),
  customer_id: model.text().index(),
  joined_at: model.dateTime().default(new Date()),
});

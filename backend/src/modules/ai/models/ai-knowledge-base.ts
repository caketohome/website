import { model } from "@medusajs/utils";

export const AiKnowledgeBase = model.define("ai_knowledge_base", {
  id: model.id({ prefix: "aikb" }).primaryKey(),
  document_id: model.text(),
  document_version: model.text().default("1.0.0"),
  source_module: model.text(),
  published_at: model.dateTime(),
  expires_at: model.dateTime().nullable(),
  language: model.text().default("en"),
  company_id: model.text().nullable(),
  branch_id: model.text().nullable(),
  content_chunk: model.text(),
  embedding: model.json().nullable(), // stores vector floats array
  metadata: model.json().nullable(),
  confidence: model.number().default(1),
  retrieval_score: model.number().nullable(),
  last_updated: model.dateTime(),
});

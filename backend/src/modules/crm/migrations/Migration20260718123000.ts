import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260718123000 extends Migration {
  override async up(): Promise<void> {
    this.addSql('alter table if exists "crm_campaign" add column if not exists "description" text null;');
    this.addSql('alter table if exists "crm_campaign" add column if not exists "campaign_type" text not null default \'offer\';');
    this.addSql('alter table if exists "crm_campaign" add column if not exists "audience" jsonb null;');
    this.addSql('alter table if exists "crm_campaign" add column if not exists "created_by" text null;');
    this.addSql('alter table if exists "crm_campaign" add column if not exists "metadata" jsonb null;');
  }

  override async down(): Promise<void> {
    this.addSql('alter table if exists "crm_campaign" drop column if exists "description";');
    this.addSql('alter table if exists "crm_campaign" drop column if exists "campaign_type";');
    this.addSql('alter table if exists "crm_campaign" drop column if exists "audience";');
    this.addSql('alter table if exists "crm_campaign" drop column if exists "created_by";');
    this.addSql('alter table if exists "crm_campaign" drop column if exists "metadata";');
  }
}

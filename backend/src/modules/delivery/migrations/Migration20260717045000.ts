import { Migration } from '@mikro-orm/migrations';

export class Migration20260717045000 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table if exists "delivery" add column if not exists "delivery_date" text null;');
    this.addSql('alter table if exists "delivery" add column if not exists "delivery_slot_id" text null;');
  }

  async down(): Promise<void> {
    this.addSql('alter table if exists "delivery" drop column if exists "delivery_date";');
    this.addSql('alter table if exists "delivery" drop column if exists "delivery_slot_id";');
  }

}

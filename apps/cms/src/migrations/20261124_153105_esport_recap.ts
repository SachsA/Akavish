import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Scout settings: the morning esport recap (on by default) and its tiers
// (S and A for the existing settings row). Additive.

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_scout_settings_esport_recap_tiers" AS ENUM('s', 'a', 'b', 'c', 'd');
  CREATE TABLE "scout_settings_esport_recap_tiers" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_scout_settings_esport_recap_tiers",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  ALTER TABLE "scout_settings" ADD COLUMN "esport_recap" boolean DEFAULT true;
  ALTER TABLE "scout_settings" ADD COLUMN "last_esport_recap" varchar;
  ALTER TABLE "scout_settings_esport_recap_tiers" ADD CONSTRAINT "scout_settings_esport_recap_tiers_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."scout_settings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "scout_settings_esport_recap_tiers_order_idx" ON "scout_settings_esport_recap_tiers" USING btree ("order");
  CREATE INDEX "scout_settings_esport_recap_tiers_parent_idx" ON "scout_settings_esport_recap_tiers" USING btree ("parent_id");
  INSERT INTO "scout_settings_esport_recap_tiers" ("order", "parent_id", "value") SELECT 1, "id", 's' FROM "scout_settings";
  INSERT INTO "scout_settings_esport_recap_tiers" ("order", "parent_id", "value") SELECT 2, "id", 'a' FROM "scout_settings";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "scout_settings_esport_recap_tiers" CASCADE;
  ALTER TABLE "scout_settings" DROP COLUMN "esport_recap";
  ALTER TABLE "scout_settings" DROP COLUMN "last_esport_recap";
  DROP TYPE "public"."enum_scout_settings_esport_recap_tiers";`)
}

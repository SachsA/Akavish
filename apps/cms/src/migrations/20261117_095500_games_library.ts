import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_games_releases_platforms" AS ENUM('pc', 'mac', 'ps5', 'ps4', 'ps3', 'ps2', 'ps1', 'psp', 'vita', 'xbox-series', 'xbox-one', 'xbox-360', 'xbox', 'switch-2', 'switch', 'wii-u', 'wii', 'gamecube', 'n64', '3ds', 'ds', 'ios', 'android', 'quest');
  CREATE TYPE "public"."enum_games_releases_precision" AS ENUM('day', 'month', 'quarter', 'year', 'tba');
  CREATE TYPE "public"."enum_games_platforms" AS ENUM('pc', 'mac', 'ps5', 'ps4', 'ps3', 'ps2', 'ps1', 'psp', 'vita', 'xbox-series', 'xbox-one', 'xbox-360', 'xbox', 'switch-2', 'switch', 'wii-u', 'wii', 'gamecube', 'n64', '3ds', 'ds', 'ios', 'android', 'quest');
  CREATE TYPE "public"."enum_games_release_date_precision" AS ENUM('day', 'month', 'quarter', 'year', 'tba');
  CREATE TABLE "games_releases_platforms" (
  	"order" integer NOT NULL,
  	"parent_id" varchar NOT NULL,
  	"value" "enum_games_releases_platforms",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "games_releases" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"precision" "enum_games_releases_precision" DEFAULT 'day' NOT NULL,
  	"date" timestamp(3) with time zone
  );
  
  CREATE TABLE "games_platforms" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_games_platforms",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "companies" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"logo_id" integer,
  	"tag_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "companies_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  ALTER TABLE "games" ADD COLUMN "release_date_precision" "enum_games_release_date_precision";
  ALTER TABLE "games_rels" ADD COLUMN "companies_id" integer;
  ALTER TABLE "scout_stories" ADD COLUMN "game_facts" jsonb;
  ALTER TABLE "scout_events" ADD COLUMN "recap_game_facts" jsonb;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "companies_id" integer;
  ALTER TABLE "games_releases_platforms" ADD CONSTRAINT "games_releases_platforms_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."games_releases"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "games_releases" ADD CONSTRAINT "games_releases_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "games_platforms" ADD CONSTRAINT "games_platforms_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "companies" ADD CONSTRAINT "companies_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "companies" ADD CONSTRAINT "companies_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "companies_texts" ADD CONSTRAINT "companies_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "games_releases_platforms_order_idx" ON "games_releases_platforms" USING btree ("order");
  CREATE INDEX "games_releases_platforms_parent_idx" ON "games_releases_platforms" USING btree ("parent_id");
  CREATE INDEX "games_releases_order_idx" ON "games_releases" USING btree ("_order");
  CREATE INDEX "games_releases_parent_id_idx" ON "games_releases" USING btree ("_parent_id");
  CREATE INDEX "games_platforms_order_idx" ON "games_platforms" USING btree ("order");
  CREATE INDEX "games_platforms_parent_idx" ON "games_platforms" USING btree ("parent_id");
  CREATE UNIQUE INDEX "companies_name_idx" ON "companies" USING btree ("name");
  CREATE UNIQUE INDEX "companies_slug_idx" ON "companies" USING btree ("slug");
  CREATE INDEX "companies_logo_idx" ON "companies" USING btree ("logo_id");
  CREATE INDEX "companies_tag_idx" ON "companies" USING btree ("tag_id");
  CREATE INDEX "companies_updated_at_idx" ON "companies" USING btree ("updated_at");
  CREATE INDEX "companies_created_at_idx" ON "companies" USING btree ("created_at");
  CREATE INDEX "companies_texts_order_parent" ON "companies_texts" USING btree ("order","parent_id");
  ALTER TABLE "games_rels" ADD CONSTRAINT "games_rels_companies_fk" FOREIGN KEY ("companies_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_companies_fk" FOREIGN KEY ("companies_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "games_rels_companies_id_idx" ON "games_rels" USING btree ("companies_id");
  CREATE INDEX "payload_locked_documents_rels_companies_id_idx" ON "payload_locked_documents_rels" USING btree ("companies_id");`)
  // The dates already there are exact days, until the backfill gives each
  // game its releases (docs: PROGRESS, games library).
  await db.execute(sql`UPDATE "games" SET "release_date_precision" = 'day' WHERE "release_date" IS NOT NULL;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "games_releases_platforms" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "games_releases" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "games_platforms" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "companies" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "companies_texts" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "games_releases_platforms" CASCADE;
  DROP TABLE "games_releases" CASCADE;
  DROP TABLE "games_platforms" CASCADE;
  DROP TABLE "companies" CASCADE;
  DROP TABLE "companies_texts" CASCADE;
  ALTER TABLE "games_rels" DROP CONSTRAINT "games_rels_companies_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_companies_fk";
  
  DROP INDEX "games_rels_companies_id_idx";
  DROP INDEX "payload_locked_documents_rels_companies_id_idx";
  ALTER TABLE "games" DROP COLUMN "release_date_precision";
  ALTER TABLE "games_rels" DROP COLUMN "companies_id";
  ALTER TABLE "scout_stories" DROP COLUMN "game_facts";
  ALTER TABLE "scout_events" DROP COLUMN "recap_game_facts";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "companies_id";
  DROP TYPE "public"."enum_games_releases_platforms";
  DROP TYPE "public"."enum_games_releases_precision";
  DROP TYPE "public"."enum_games_platforms";
  DROP TYPE "public"."enum_games_release_date_precision";`)
}

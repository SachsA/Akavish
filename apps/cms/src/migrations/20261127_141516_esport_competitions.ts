import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Esport competitions (2026-11-27): esport-leagues, esport-series (editions,
// winners, prize pool), esport-teams, an article's competitions
// (articles_rels) and the hourly esportCompetitions task. Additive.

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_esport_leagues_game" AS ENUM('cs2', 'valorant', 'lol', 'r6', 'rl');
  CREATE TYPE "public"."enum_esport_leagues_tier" AS ENUM('s', 'a', 'b', 'c', 'd', 'unranked');
  CREATE TYPE "public"."enum_esport_series_game" AS ENUM('cs2', 'valorant', 'lol', 'r6', 'rl');
  CREATE TYPE "public"."enum_esport_series_tier" AS ENUM('s', 'a', 'b', 'c', 'd', 'unranked');
  CREATE TYPE "public"."enum_esport_teams_game" AS ENUM('cs2', 'valorant', 'lol', 'r6', 'rl');
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE IF NOT EXISTS 'esportCompetitions' BEFORE 'scoutDraft';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE IF NOT EXISTS 'esportCompetitions' BEFORE 'scoutDraft';
  CREATE TABLE "esport_leagues" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"panda_id" numeric NOT NULL,
  	"game" "enum_esport_leagues_game" NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"panda_slug" varchar,
  	"logo_url" varchar,
  	"tier" "enum_esport_leagues_tier" DEFAULT 'unranked' NOT NULL,
  	"last_at" timestamp(3) with time zone,
  	"latest" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "esport_leagues_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "esport_series" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"panda_id" numeric NOT NULL,
  	"game" "enum_esport_series_game" NOT NULL,
  	"league_id" integer,
  	"name" varchar NOT NULL,
  	"year" numeric,
  	"slug" varchar,
  	"begin_at" timestamp(3) with time zone,
  	"end_at" timestamp(3) with time zone,
  	"tier" "enum_esport_series_tier" DEFAULT 'unranked' NOT NULL,
  	"winner_id" integer,
  	"prize_pool" varchar,
  	"country" varchar,
  	"stages" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "esport_teams" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"panda_id" numeric NOT NULL,
  	"game" "enum_esport_teams_game",
  	"name" varchar NOT NULL,
  	"acronym" varchar,
  	"slug" varchar,
  	"logo_url" varchar,
  	"location" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "articles_rels" ADD COLUMN "esport_leagues_id" integer;
  ALTER TABLE "_articles_v_rels" ADD COLUMN "esport_leagues_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "esport_leagues_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "esport_series_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "esport_teams_id" integer;
  ALTER TABLE "esport_leagues_texts" ADD CONSTRAINT "esport_leagues_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."esport_leagues"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "esport_series" ADD CONSTRAINT "esport_series_league_id_esport_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."esport_leagues"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "esport_series" ADD CONSTRAINT "esport_series_winner_id_esport_teams_id_fk" FOREIGN KEY ("winner_id") REFERENCES "public"."esport_teams"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "esport_leagues_panda_id_idx" ON "esport_leagues" USING btree ("panda_id");
  CREATE INDEX "esport_leagues_game_idx" ON "esport_leagues" USING btree ("game");
  CREATE UNIQUE INDEX "esport_leagues_slug_idx" ON "esport_leagues" USING btree ("slug");
  CREATE INDEX "esport_leagues_tier_idx" ON "esport_leagues" USING btree ("tier");
  CREATE INDEX "esport_leagues_last_at_idx" ON "esport_leagues" USING btree ("last_at");
  CREATE INDEX "esport_leagues_updated_at_idx" ON "esport_leagues" USING btree ("updated_at");
  CREATE INDEX "esport_leagues_created_at_idx" ON "esport_leagues" USING btree ("created_at");
  CREATE INDEX "esport_leagues_texts_order_parent" ON "esport_leagues_texts" USING btree ("order","parent_id");
  CREATE UNIQUE INDEX "esport_series_panda_id_idx" ON "esport_series" USING btree ("panda_id");
  CREATE INDEX "esport_series_game_idx" ON "esport_series" USING btree ("game");
  CREATE INDEX "esport_series_league_idx" ON "esport_series" USING btree ("league_id");
  CREATE INDEX "esport_series_begin_at_idx" ON "esport_series" USING btree ("begin_at");
  CREATE INDEX "esport_series_end_at_idx" ON "esport_series" USING btree ("end_at");
  CREATE INDEX "esport_series_tier_idx" ON "esport_series" USING btree ("tier");
  CREATE INDEX "esport_series_winner_idx" ON "esport_series" USING btree ("winner_id");
  CREATE INDEX "esport_series_updated_at_idx" ON "esport_series" USING btree ("updated_at");
  CREATE INDEX "esport_series_created_at_idx" ON "esport_series" USING btree ("created_at");
  CREATE UNIQUE INDEX "esport_teams_panda_id_idx" ON "esport_teams" USING btree ("panda_id");
  CREATE INDEX "esport_teams_game_idx" ON "esport_teams" USING btree ("game");
  CREATE INDEX "esport_teams_slug_idx" ON "esport_teams" USING btree ("slug");
  CREATE INDEX "esport_teams_updated_at_idx" ON "esport_teams" USING btree ("updated_at");
  CREATE INDEX "esport_teams_created_at_idx" ON "esport_teams" USING btree ("created_at");
  ALTER TABLE "articles_rels" ADD CONSTRAINT "articles_rels_esport_leagues_fk" FOREIGN KEY ("esport_leagues_id") REFERENCES "public"."esport_leagues"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_rels" ADD CONSTRAINT "_articles_v_rels_esport_leagues_fk" FOREIGN KEY ("esport_leagues_id") REFERENCES "public"."esport_leagues"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_esport_leagues_fk" FOREIGN KEY ("esport_leagues_id") REFERENCES "public"."esport_leagues"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_esport_series_fk" FOREIGN KEY ("esport_series_id") REFERENCES "public"."esport_series"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_esport_teams_fk" FOREIGN KEY ("esport_teams_id") REFERENCES "public"."esport_teams"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "articles_rels_esport_leagues_id_idx" ON "articles_rels" USING btree ("esport_leagues_id");
  CREATE INDEX "_articles_v_rels_esport_leagues_id_idx" ON "_articles_v_rels" USING btree ("esport_leagues_id");
  CREATE INDEX "payload_locked_documents_rels_esport_leagues_id_idx" ON "payload_locked_documents_rels" USING btree ("esport_leagues_id");
  CREATE INDEX "payload_locked_documents_rels_esport_series_id_idx" ON "payload_locked_documents_rels" USING btree ("esport_series_id");
  CREATE INDEX "payload_locked_documents_rels_esport_teams_id_idx" ON "payload_locked_documents_rels" USING btree ("esport_teams_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "esport_leagues" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "esport_leagues_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "esport_series" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "esport_teams" DISABLE ROW LEVEL SECURITY;
  DROP TABLE IF EXISTS "esport_leagues" CASCADE;
  DROP TABLE IF EXISTS "esport_leagues_texts" CASCADE;
  DROP TABLE IF EXISTS "esport_series" CASCADE;
  DROP TABLE IF EXISTS "esport_teams" CASCADE;
  ALTER TABLE "articles_rels" DROP CONSTRAINT IF EXISTS "articles_rels_esport_leagues_fk";
  
  ALTER TABLE "_articles_v_rels" DROP CONSTRAINT IF EXISTS "_articles_v_rels_esport_leagues_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_esport_leagues_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_esport_series_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_esport_teams_fk";
  
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'translateArticle', 'translateTaxonomy', 'scoutTick', 'esportSync', 'scoutDraft', 'schedulePublish');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_task_slug" USING "task_slug"::"public"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'translateArticle', 'translateTaxonomy', 'scoutTick', 'esportSync', 'scoutDraft', 'schedulePublish');
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_task_slug" USING "task_slug"::"public"."enum_payload_jobs_task_slug";
  DROP INDEX IF EXISTS "articles_rels_esport_leagues_id_idx";
  DROP INDEX IF EXISTS "_articles_v_rels_esport_leagues_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_esport_leagues_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_esport_series_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_esport_teams_id_idx";
  ALTER TABLE "articles_rels" DROP COLUMN IF EXISTS "esport_leagues_id";
  ALTER TABLE "_articles_v_rels" DROP COLUMN IF EXISTS "esport_leagues_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "esport_leagues_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "esport_series_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "esport_teams_id";
  DROP TYPE IF EXISTS "public"."enum_esport_leagues_game";
  DROP TYPE IF EXISTS "public"."enum_esport_leagues_tier";
  DROP TYPE IF EXISTS "public"."enum_esport_series_game";
  DROP TYPE IF EXISTS "public"."enum_esport_series_tier";
  DROP TYPE IF EXISTS "public"."enum_esport_teams_game";`)
}

import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Esport (scout step 4): tournaments and matches from PandaScore
// (src/esport/), and the `esportSync` task. Additive: two new tables.

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_esport_tournaments_game" AS ENUM('cs2', 'valorant', 'lol', 'r6', 'rl');
  CREATE TYPE "public"."enum_esport_tournaments_tier" AS ENUM('s', 'a', 'b', 'c', 'd', 'unranked');
  CREATE TYPE "public"."enum_esport_matches_game" AS ENUM('cs2', 'valorant', 'lol', 'r6', 'rl');
  CREATE TYPE "public"."enum_esport_matches_status" AS ENUM('not_started', 'running', 'finished', 'canceled', 'postponed');
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'esportSync' BEFORE 'scoutDraft';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'esportSync' BEFORE 'scoutDraft';
  CREATE TABLE "esport_tournaments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"panda_id" numeric NOT NULL,
  	"game" "enum_esport_tournaments_game" NOT NULL,
  	"name" varchar NOT NULL,
  	"league" varchar,
  	"league_logo_url" varchar,
  	"serie" varchar,
  	"tier" "enum_esport_tournaments_tier" DEFAULT 'unranked' NOT NULL,
  	"begin_at" timestamp(3) with time zone,
  	"end_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "esport_matches" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"panda_id" numeric NOT NULL,
  	"game" "enum_esport_matches_game" NOT NULL,
  	"tournament_id" integer,
  	"name" varchar NOT NULL,
  	"status" "enum_esport_matches_status" NOT NULL,
  	"scheduled_at" timestamp(3) with time zone,
  	"begin_at" timestamp(3) with time zone,
  	"end_at" timestamp(3) with time zone,
  	"best_of" numeric,
  	"team1_panda_id" numeric,
  	"team1_name" varchar,
  	"team1_acronym" varchar,
  	"team1_logo_url" varchar,
  	"team2_panda_id" numeric,
  	"team2_name" varchar,
  	"team2_acronym" varchar,
  	"team2_logo_url" varchar,
  	"score1" numeric,
  	"score2" numeric,
  	"winner" numeric,
  	"forfeit" boolean DEFAULT false,
  	"draw" boolean DEFAULT false,
  	"stream_url" varchar,
  	"modified_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "esport_tournaments_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "esport_matches_id" integer;
  ALTER TABLE "esport_matches" ADD CONSTRAINT "esport_matches_tournament_id_esport_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."esport_tournaments"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "esport_tournaments_panda_id_idx" ON "esport_tournaments" USING btree ("panda_id");
  CREATE INDEX "esport_tournaments_game_idx" ON "esport_tournaments" USING btree ("game");
  CREATE INDEX "esport_tournaments_tier_idx" ON "esport_tournaments" USING btree ("tier");
  CREATE INDEX "esport_tournaments_begin_at_idx" ON "esport_tournaments" USING btree ("begin_at");
  CREATE INDEX "esport_tournaments_updated_at_idx" ON "esport_tournaments" USING btree ("updated_at");
  CREATE INDEX "esport_tournaments_created_at_idx" ON "esport_tournaments" USING btree ("created_at");
  CREATE UNIQUE INDEX "esport_matches_panda_id_idx" ON "esport_matches" USING btree ("panda_id");
  CREATE INDEX "esport_matches_game_idx" ON "esport_matches" USING btree ("game");
  CREATE INDEX "esport_matches_tournament_idx" ON "esport_matches" USING btree ("tournament_id");
  CREATE INDEX "esport_matches_status_idx" ON "esport_matches" USING btree ("status");
  CREATE INDEX "esport_matches_begin_at_idx" ON "esport_matches" USING btree ("begin_at");
  CREATE INDEX "esport_matches_end_at_idx" ON "esport_matches" USING btree ("end_at");
  CREATE INDEX "esport_matches_updated_at_idx" ON "esport_matches" USING btree ("updated_at");
  CREATE INDEX "esport_matches_created_at_idx" ON "esport_matches" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_esport_tournaments_fk" FOREIGN KEY ("esport_tournaments_id") REFERENCES "public"."esport_tournaments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_esport_matches_fk" FOREIGN KEY ("esport_matches_id") REFERENCES "public"."esport_matches"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_esport_tournaments_id_idx" ON "payload_locked_documents_rels" USING btree ("esport_tournaments_id");
  CREATE INDEX "payload_locked_documents_rels_esport_matches_id_idx" ON "payload_locked_documents_rels" USING btree ("esport_matches_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "esport_tournaments" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "esport_matches" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "esport_tournaments" CASCADE;
  DROP TABLE "esport_matches" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_esport_tournaments_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_esport_matches_fk";
  
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'translateArticle', 'translateTaxonomy', 'scoutTick', 'scoutDraft', 'schedulePublish');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_task_slug" USING "task_slug"::"public"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'translateArticle', 'translateTaxonomy', 'scoutTick', 'scoutDraft', 'schedulePublish');
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_task_slug" USING "task_slug"::"public"."enum_payload_jobs_task_slug";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_esport_tournaments_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_esport_matches_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "esport_tournaments_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "esport_matches_id";
  DROP TYPE "public"."enum_esport_tournaments_game";
  DROP TYPE "public"."enum_esport_tournaments_tier";
  DROP TYPE "public"."enum_esport_matches_game";
  DROP TYPE "public"."enum_esport_matches_status";`)
}

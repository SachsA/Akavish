import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_scout_sources_kind" AS ENUM('rss', 'x');
  CREATE TYPE "public"."enum_scout_sources_reliability" AS ENUM('official', 'high', 'variable');
  CREATE TYPE "public"."enum_scout_sources_cadence" AS ENUM('fast', 'normal');
  CREATE TYPE "public"."enum_scout_sources_language" AS ENUM('en', 'fr', 'other');
  CREATE TYPE "public"."enum_scout_items_status" AS ENUM('new', 'triaged', 'ignored');
  CREATE TYPE "public"."enum_scout_stories_best_reliability" AS ENUM('official', 'high', 'variable');
  CREATE TYPE "public"."enum_scout_stories_category" AS ENUM('news', 'leak', 'review', 'preview', 'conference', 'esport');
  CREATE TYPE "public"."enum_scout_stories_status" AS ENUM('new', 'listed', 'drafted', 'published', 'rejected');
  CREATE TYPE "public"."enum_scout_usage_kind" AS ENUM('llm', 'x');
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'scoutTick' BEFORE 'schedulePublish';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'scoutTick' BEFORE 'schedulePublish';
  CREATE TABLE "scout_sources" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"kind" "enum_scout_sources_kind" DEFAULT 'rss' NOT NULL,
  	"url" varchar NOT NULL,
  	"reliability" "enum_scout_sources_reliability" DEFAULT 'high' NOT NULL,
  	"cadence" "enum_scout_sources_cadence" DEFAULT 'normal' NOT NULL,
  	"language" "enum_scout_sources_language" DEFAULT 'en' NOT NULL,
  	"general" boolean DEFAULT false,
  	"active" boolean DEFAULT true,
  	"last_fetched_at" timestamp(3) with time zone,
  	"last_status" varchar,
  	"consecutive_failures" numeric DEFAULT 0,
  	"etag" varchar,
  	"last_modified" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "scout_items" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"url" varchar NOT NULL,
  	"summary" varchar,
  	"published_at" timestamp(3) with time zone,
  	"source_id" integer NOT NULL,
  	"status" "enum_scout_items_status" DEFAULT 'new' NOT NULL,
  	"story_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "scout_stories" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"score" numeric DEFAULT 0 NOT NULL,
  	"significance" numeric,
  	"source_count" numeric DEFAULT 0,
  	"best_reliability" "enum_scout_stories_best_reliability",
  	"game" varchar,
  	"category" "enum_scout_stories_category",
  	"status" "enum_scout_stories_status" DEFAULT 'new' NOT NULL,
  	"first_seen_at" timestamp(3) with time zone NOT NULL,
  	"last_item_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "scout_usage" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"kind" "enum_scout_usage_kind" NOT NULL,
  	"purpose" varchar NOT NULL,
  	"model" varchar,
  	"input_tokens" numeric,
  	"output_tokens" numeric,
  	"cost_usd" numeric NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "scout_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"paused" boolean DEFAULT false,
  	"threshold" numeric DEFAULT 60,
  	"last_morning_digest" varchar,
  	"last_evening_digest" varchar,
  	"last_budget_alert" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "payload_jobs_stats" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"stats" jsonb,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "payload_jobs" ADD COLUMN "meta" jsonb;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "scout_sources_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "scout_items_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "scout_stories_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "scout_usage_id" integer;
  ALTER TABLE "scout_items" ADD CONSTRAINT "scout_items_source_id_scout_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."scout_sources"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "scout_items" ADD CONSTRAINT "scout_items_story_id_scout_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."scout_stories"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "scout_sources_url_idx" ON "scout_sources" USING btree ("url");
  CREATE INDEX "scout_sources_updated_at_idx" ON "scout_sources" USING btree ("updated_at");
  CREATE INDEX "scout_sources_created_at_idx" ON "scout_sources" USING btree ("created_at");
  CREATE UNIQUE INDEX "scout_items_url_idx" ON "scout_items" USING btree ("url");
  CREATE INDEX "scout_items_source_idx" ON "scout_items" USING btree ("source_id");
  CREATE INDEX "scout_items_status_idx" ON "scout_items" USING btree ("status");
  CREATE INDEX "scout_items_story_idx" ON "scout_items" USING btree ("story_id");
  CREATE INDEX "scout_items_updated_at_idx" ON "scout_items" USING btree ("updated_at");
  CREATE INDEX "scout_items_created_at_idx" ON "scout_items" USING btree ("created_at");
  CREATE INDEX "scout_stories_score_idx" ON "scout_stories" USING btree ("score");
  CREATE INDEX "scout_stories_status_idx" ON "scout_stories" USING btree ("status");
  CREATE INDEX "scout_stories_updated_at_idx" ON "scout_stories" USING btree ("updated_at");
  CREATE INDEX "scout_stories_created_at_idx" ON "scout_stories" USING btree ("created_at");
  CREATE INDEX "scout_usage_updated_at_idx" ON "scout_usage" USING btree ("updated_at");
  CREATE INDEX "scout_usage_created_at_idx" ON "scout_usage" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_scout_sources_fk" FOREIGN KEY ("scout_sources_id") REFERENCES "public"."scout_sources"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_scout_items_fk" FOREIGN KEY ("scout_items_id") REFERENCES "public"."scout_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_scout_stories_fk" FOREIGN KEY ("scout_stories_id") REFERENCES "public"."scout_stories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_scout_usage_fk" FOREIGN KEY ("scout_usage_id") REFERENCES "public"."scout_usage"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_scout_sources_id_idx" ON "payload_locked_documents_rels" USING btree ("scout_sources_id");
  CREATE INDEX "payload_locked_documents_rels_scout_items_id_idx" ON "payload_locked_documents_rels" USING btree ("scout_items_id");
  CREATE INDEX "payload_locked_documents_rels_scout_stories_id_idx" ON "payload_locked_documents_rels" USING btree ("scout_stories_id");
  CREATE INDEX "payload_locked_documents_rels_scout_usage_id_idx" ON "payload_locked_documents_rels" USING btree ("scout_usage_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "scout_sources" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "scout_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "scout_stories" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "scout_usage" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "scout_settings" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_jobs_stats" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "scout_sources" CASCADE;
  DROP TABLE "scout_items" CASCADE;
  DROP TABLE "scout_stories" CASCADE;
  DROP TABLE "scout_usage" CASCADE;
  DROP TABLE "scout_settings" CASCADE;
  DROP TABLE "payload_jobs_stats" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_scout_sources_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_scout_items_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_scout_stories_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_scout_usage_fk";
  
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'schedulePublish');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_task_slug" USING "task_slug"::"public"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'schedulePublish');
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_task_slug" USING "task_slug"::"public"."enum_payload_jobs_task_slug";
  DROP INDEX "payload_locked_documents_rels_scout_sources_id_idx";
  DROP INDEX "payload_locked_documents_rels_scout_items_id_idx";
  DROP INDEX "payload_locked_documents_rels_scout_stories_id_idx";
  DROP INDEX "payload_locked_documents_rels_scout_usage_id_idx";
  ALTER TABLE "payload_jobs" DROP COLUMN "meta";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "scout_sources_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "scout_items_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "scout_stories_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "scout_usage_id";
  DROP TYPE "public"."enum_scout_sources_kind";
  DROP TYPE "public"."enum_scout_sources_reliability";
  DROP TYPE "public"."enum_scout_sources_cadence";
  DROP TYPE "public"."enum_scout_sources_language";
  DROP TYPE "public"."enum_scout_items_status";
  DROP TYPE "public"."enum_scout_stories_best_reliability";
  DROP TYPE "public"."enum_scout_stories_category";
  DROP TYPE "public"."enum_scout_stories_status";
  DROP TYPE "public"."enum_scout_usage_kind";`)
}

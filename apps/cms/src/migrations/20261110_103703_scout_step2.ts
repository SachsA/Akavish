import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'scoutDraft' BEFORE 'schedulePublish';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'scoutDraft' BEFORE 'schedulePublish';
  CREATE TABLE "scout_stories_feedback" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL,
  	"version" numeric
  );
  
  ALTER TABLE "articles" ADD COLUMN "ai_assisted" boolean DEFAULT false;
  ALTER TABLE "_articles_v" ADD COLUMN "version_ai_assisted" boolean DEFAULT false;
  ALTER TABLE "scout_stories" ADD COLUMN "article_id" integer;
  ALTER TABLE "scout_stories" ADD COLUMN "drafted_at" timestamp(3) with time zone;
  ALTER TABLE "scout_stories" ADD COLUMN "version" numeric DEFAULT 0;
  ALTER TABLE "scout_stories" ADD COLUMN "discord_message_id" varchar;
  ALTER TABLE "scout_stories" ADD COLUMN "rejection_reason" varchar;
  ALTER TABLE "scout_stories" ADD COLUMN "last_draft_text" varchar;
  ALTER TABLE "scout_settings" ADD COLUMN "drafts_enabled" boolean DEFAULT false;
  ALTER TABLE "scout_settings" ADD COLUMN "max_drafts_per_day" numeric DEFAULT 20;
  ALTER TABLE "scout_settings" ADD COLUMN "default_author_id" integer;
  ALTER TABLE "scout_stories_feedback" ADD CONSTRAINT "scout_stories_feedback_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."scout_stories"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "scout_stories_feedback_order_idx" ON "scout_stories_feedback" USING btree ("_order");
  CREATE INDEX "scout_stories_feedback_parent_id_idx" ON "scout_stories_feedback" USING btree ("_parent_id");
  ALTER TABLE "scout_stories" ADD CONSTRAINT "scout_stories_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "scout_settings" ADD CONSTRAINT "scout_settings_default_author_id_authors_id_fk" FOREIGN KEY ("default_author_id") REFERENCES "public"."authors"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "scout_stories_article_idx" ON "scout_stories" USING btree ("article_id");
  CREATE INDEX "scout_stories_drafted_at_idx" ON "scout_stories" USING btree ("drafted_at");
  CREATE INDEX "scout_settings_default_author_idx" ON "scout_settings" USING btree ("default_author_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "scout_stories_feedback" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "scout_stories_feedback" CASCADE;
  ALTER TABLE "scout_stories" DROP CONSTRAINT "scout_stories_article_id_articles_id_fk";
  
  ALTER TABLE "scout_settings" DROP CONSTRAINT "scout_settings_default_author_id_authors_id_fk";
  
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'scoutTick', 'schedulePublish');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_task_slug" USING "task_slug"::"public"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'scoutTick', 'schedulePublish');
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_task_slug" USING "task_slug"::"public"."enum_payload_jobs_task_slug";
  DROP INDEX "scout_stories_article_idx";
  DROP INDEX "scout_stories_drafted_at_idx";
  DROP INDEX "scout_settings_default_author_idx";
  ALTER TABLE "articles" DROP COLUMN "ai_assisted";
  ALTER TABLE "_articles_v" DROP COLUMN "version_ai_assisted";
  ALTER TABLE "scout_stories" DROP COLUMN "article_id";
  ALTER TABLE "scout_stories" DROP COLUMN "drafted_at";
  ALTER TABLE "scout_stories" DROP COLUMN "version";
  ALTER TABLE "scout_stories" DROP COLUMN "discord_message_id";
  ALTER TABLE "scout_stories" DROP COLUMN "rejection_reason";
  ALTER TABLE "scout_stories" DROP COLUMN "last_draft_text";
  ALTER TABLE "scout_settings" DROP COLUMN "drafts_enabled";
  ALTER TABLE "scout_settings" DROP COLUMN "max_drafts_per_day";
  ALTER TABLE "scout_settings" DROP COLUMN "default_author_id";`)
}

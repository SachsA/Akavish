import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_articles_fr_status" AS ENUM('pending', 'auto', 'edited', 'failed');
  CREATE TYPE "public"."enum__articles_v_version_fr_status" AS ENUM('pending', 'auto', 'edited', 'failed');
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'translateArticle' BEFORE 'scoutTick';
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'translateTaxonomy' BEFORE 'scoutTick';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'translateArticle' BEFORE 'scoutTick';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'translateTaxonomy' BEFORE 'scoutTick';
  ALTER TABLE "media" ADD COLUMN "alt_fr" varchar;
  ALTER TABLE "tags" ADD COLUMN "name_fr" varchar;
  ALTER TABLE "authors" ADD COLUMN "bio_fr" varchar;
  ALTER TABLE "articles" ADD COLUMN "fr_title" varchar;
  ALTER TABLE "articles" ADD COLUMN "fr_excerpt" varchar;
  ALTER TABLE "articles" ADD COLUMN "fr_content" jsonb;
  ALTER TABLE "articles" ADD COLUMN "fr_seo_title" varchar;
  ALTER TABLE "articles" ADD COLUMN "fr_seo_description" varchar;
  ALTER TABLE "articles" ADD COLUMN "fr_status" "enum_articles_fr_status";
  ALTER TABLE "articles" ADD COLUMN "fr_translated_at" timestamp(3) with time zone;
  ALTER TABLE "articles" ADD COLUMN "fr_source_hash" varchar;
  ALTER TABLE "_articles_v" ADD COLUMN "version_fr_title" varchar;
  ALTER TABLE "_articles_v" ADD COLUMN "version_fr_excerpt" varchar;
  ALTER TABLE "_articles_v" ADD COLUMN "version_fr_content" jsonb;
  ALTER TABLE "_articles_v" ADD COLUMN "version_fr_seo_title" varchar;
  ALTER TABLE "_articles_v" ADD COLUMN "version_fr_seo_description" varchar;
  ALTER TABLE "_articles_v" ADD COLUMN "version_fr_status" "enum__articles_v_version_fr_status";
  ALTER TABLE "_articles_v" ADD COLUMN "version_fr_translated_at" timestamp(3) with time zone;
  ALTER TABLE "_articles_v" ADD COLUMN "version_fr_source_hash" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'scoutTick', 'scoutDraft', 'schedulePublish');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_task_slug" USING "task_slug"::"public"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'scoutTick', 'scoutDraft', 'schedulePublish');
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_task_slug" USING "task_slug"::"public"."enum_payload_jobs_task_slug";
  ALTER TABLE "media" DROP COLUMN "alt_fr";
  ALTER TABLE "tags" DROP COLUMN "name_fr";
  ALTER TABLE "authors" DROP COLUMN "bio_fr";
  ALTER TABLE "articles" DROP COLUMN "fr_title";
  ALTER TABLE "articles" DROP COLUMN "fr_excerpt";
  ALTER TABLE "articles" DROP COLUMN "fr_content";
  ALTER TABLE "articles" DROP COLUMN "fr_seo_title";
  ALTER TABLE "articles" DROP COLUMN "fr_seo_description";
  ALTER TABLE "articles" DROP COLUMN "fr_status";
  ALTER TABLE "articles" DROP COLUMN "fr_translated_at";
  ALTER TABLE "articles" DROP COLUMN "fr_source_hash";
  ALTER TABLE "_articles_v" DROP COLUMN "version_fr_title";
  ALTER TABLE "_articles_v" DROP COLUMN "version_fr_excerpt";
  ALTER TABLE "_articles_v" DROP COLUMN "version_fr_content";
  ALTER TABLE "_articles_v" DROP COLUMN "version_fr_seo_title";
  ALTER TABLE "_articles_v" DROP COLUMN "version_fr_seo_description";
  ALTER TABLE "_articles_v" DROP COLUMN "version_fr_status";
  ALTER TABLE "_articles_v" DROP COLUMN "version_fr_translated_at";
  ALTER TABLE "_articles_v" DROP COLUMN "version_fr_source_hash";
  DROP TYPE "public"."enum_articles_fr_status";
  DROP TYPE "public"."enum__articles_v_version_fr_status";`)
}

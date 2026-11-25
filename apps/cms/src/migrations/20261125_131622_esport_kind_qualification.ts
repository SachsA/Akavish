import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Scout stories: esportKind 'qualification' (qualified / eliminated in a big
// event: drafted as a spoiler, unlike a plain result). Additive.

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_scout_stories_esport_kind" ADD VALUE 'qualification' BEFORE 'result';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "scout_stories" ALTER COLUMN "esport_kind" SET DATA TYPE text;
  UPDATE "scout_stories" SET "esport_kind" = 'result' WHERE "esport_kind" = 'qualification';
  DROP TYPE IF EXISTS "public"."enum_scout_stories_esport_kind";
  CREATE TYPE "public"."enum_scout_stories_esport_kind" AS ENUM('transfer', 'final', 'result', 'tournament', 'other');
  ALTER TABLE "scout_stories" ALTER COLUMN "esport_kind" SET DATA TYPE "public"."enum_scout_stories_esport_kind" USING "esport_kind"::"public"."enum_scout_stories_esport_kind";`)
}

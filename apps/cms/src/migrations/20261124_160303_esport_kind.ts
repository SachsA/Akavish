import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Scout stories: esportKind (transfer / final / result / tournament / other)
// so roster news get the Mercato tag and plain results are never auto-drafted.

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_scout_stories_esport_kind" AS ENUM('transfer', 'final', 'result', 'tournament', 'other');
  ALTER TABLE "scout_stories" ADD COLUMN "esport_kind" "enum_scout_stories_esport_kind";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "scout_stories" DROP COLUMN IF EXISTS "esport_kind";
  DROP TYPE IF EXISTS "public"."enum_scout_stories_esport_kind";`)
}

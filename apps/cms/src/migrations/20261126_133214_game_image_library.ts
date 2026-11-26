import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Game image library (scout/game-images.ts): when the scout last looked for a
// game's official images online, and the URLs it already tried. Additive.

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "games" ADD COLUMN "images_checked_at" timestamp(3) with time zone;
  ALTER TABLE "games" ADD COLUMN "image_sources" jsonb;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "games" DROP COLUMN IF EXISTS "images_checked_at";
  ALTER TABLE "games" DROP COLUMN IF EXISTS "image_sources";`)
}

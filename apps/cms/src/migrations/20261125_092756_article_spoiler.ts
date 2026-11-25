import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Articles: `spoiler` (gives a result away), blurred in lists for readers
// who hide esport scores (anti-spoil, 2026-11-25). Additive.

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "articles" ADD COLUMN "spoiler" boolean DEFAULT false;
  ALTER TABLE "_articles_v" ADD COLUMN "version_spoiler" boolean DEFAULT false;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "articles" DROP COLUMN IF EXISTS "spoiler";
  ALTER TABLE "_articles_v" DROP COLUMN IF EXISTS "version_spoiler";`)
}

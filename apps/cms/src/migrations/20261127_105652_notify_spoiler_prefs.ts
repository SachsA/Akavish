import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Readers' anti-spoil settings, a copy for the push notifications
// (notify.spoilerPrefs, lib/esport-follows.ts). Additive.

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "readers" ADD COLUMN "notify_spoiler_prefs" jsonb;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "readers" DROP COLUMN IF EXISTS "notify_spoiler_prefs";`)
}

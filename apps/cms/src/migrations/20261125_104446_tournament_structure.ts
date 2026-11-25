import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Esport tournaments: slug, serieId, hasBracket, structure (bracket matches
// and standings) and structureAt, for the tournament pages. Additive.

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "esport_tournaments" ADD COLUMN "slug" varchar;
  ALTER TABLE "esport_tournaments" ADD COLUMN "serie_id" numeric;
  ALTER TABLE "esport_tournaments" ADD COLUMN "has_bracket" boolean DEFAULT false;
  ALTER TABLE "esport_tournaments" ADD COLUMN "structure" jsonb;
  ALTER TABLE "esport_tournaments" ADD COLUMN "structure_at" timestamp(3) with time zone;
  CREATE INDEX "esport_tournaments_slug_idx" ON "esport_tournaments" USING btree ("slug");
  CREATE INDEX "esport_tournaments_serie_id_idx" ON "esport_tournaments" USING btree ("serie_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX IF EXISTS "esport_tournaments_slug_idx";
  DROP INDEX IF EXISTS "esport_tournaments_serie_id_idx";
  ALTER TABLE "esport_tournaments" DROP COLUMN IF EXISTS "slug";
  ALTER TABLE "esport_tournaments" DROP COLUMN IF EXISTS "serie_id";
  ALTER TABLE "esport_tournaments" DROP COLUMN IF EXISTS "has_bracket";
  ALTER TABLE "esport_tournaments" DROP COLUMN IF EXISTS "structure";
  ALTER TABLE "esport_tournaments" DROP COLUMN IF EXISTS "structure_at";`)
}

import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "articles" ADD COLUMN "featured" boolean DEFAULT false;
  ALTER TABLE "_articles_v" ADD COLUMN "version_featured" boolean DEFAULT false;
  CREATE INDEX "articles_featured_idx" ON "articles" USING btree ("featured");
  CREATE INDEX "_articles_v_version_version_featured_idx" ON "_articles_v" USING btree ("version_featured");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "articles_featured_idx";
  DROP INDEX "_articles_v_version_version_featured_idx";
  ALTER TABLE "articles" DROP COLUMN "featured";
  ALTER TABLE "_articles_v" DROP COLUMN "version_featured";`)
}

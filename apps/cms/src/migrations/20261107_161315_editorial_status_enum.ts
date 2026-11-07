import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_articles_editorial_status" AS ENUM('draft', 'published', 'archived');
  ALTER TABLE "articles" ALTER COLUMN "status" DROP DEFAULT;
  ALTER TABLE "articles" ALTER COLUMN "status" SET DATA TYPE "public"."enum_articles_editorial_status" USING "status"::text::"public"."enum_articles_editorial_status";
  ALTER TABLE "articles" ALTER COLUMN "status" SET DEFAULT 'draft';
  ALTER TABLE "_articles_v" ALTER COLUMN "version_status" DROP DEFAULT;
  ALTER TABLE "_articles_v" ALTER COLUMN "version_status" SET DATA TYPE "public"."enum_articles_editorial_status" USING "version_status"::text::"public"."enum_articles_editorial_status";
  ALTER TABLE "_articles_v" ALTER COLUMN "version_status" SET DEFAULT 'draft';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "articles" ALTER COLUMN "status" DROP DEFAULT;
  ALTER TABLE "articles" ALTER COLUMN "status" SET DATA TYPE "public"."enum_articles_status" USING "status"::text::"public"."enum_articles_status";
  ALTER TABLE "articles" ALTER COLUMN "status" SET DEFAULT 'draft';
  ALTER TABLE "_articles_v" ALTER COLUMN "version_status" DROP DEFAULT;
  ALTER TABLE "_articles_v" ALTER COLUMN "version_status" SET DATA TYPE "public"."enum__articles_v_version_status" USING "version_status"::text::"public"."enum__articles_v_version_status";
  ALTER TABLE "_articles_v" ALTER COLUMN "version_status" SET DEFAULT 'draft';
  DROP TYPE "public"."enum_articles_editorial_status";`)
}

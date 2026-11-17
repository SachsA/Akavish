import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "games_platform" CASCADE;
  ALTER TABLE "games" DROP COLUMN "developer";
  ALTER TABLE "games" DROP COLUMN "publisher";
  DROP TYPE "public"."enum_games_platform";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_games_platform" AS ENUM('PC', 'PlayStation', 'Xbox', 'Nintendo Switch', 'Mobile');
  CREATE TABLE "games_platform" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_games_platform",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  ALTER TABLE "games" ADD COLUMN "developer" varchar;
  ALTER TABLE "games" ADD COLUMN "publisher" varchar;
  ALTER TABLE "games_platform" ADD CONSTRAINT "games_platform_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "games_platform_order_idx" ON "games_platform" USING btree ("order");
  CREATE INDEX "games_platform_parent_idx" ON "games_platform" USING btree ("parent_id");`)
}

import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "articles_previous_slugs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"slug" varchar
  );
  
  CREATE TABLE "_articles_v_version_previous_slugs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar,
  	"_uuid" varchar
  );
  
  ALTER TABLE "articles_previous_slugs" ADD CONSTRAINT "articles_previous_slugs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_version_previous_slugs" ADD CONSTRAINT "_articles_v_version_previous_slugs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_articles_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "articles_previous_slugs_order_idx" ON "articles_previous_slugs" USING btree ("_order");
  CREATE INDEX "articles_previous_slugs_parent_id_idx" ON "articles_previous_slugs" USING btree ("_parent_id");
  CREATE INDEX "articles_previous_slugs_slug_idx" ON "articles_previous_slugs" USING btree ("slug");
  CREATE INDEX "_articles_v_version_previous_slugs_order_idx" ON "_articles_v_version_previous_slugs" USING btree ("_order");
  CREATE INDEX "_articles_v_version_previous_slugs_parent_id_idx" ON "_articles_v_version_previous_slugs" USING btree ("_parent_id");
  CREATE INDEX "_articles_v_version_previous_slugs_slug_idx" ON "_articles_v_version_previous_slugs" USING btree ("slug");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "articles_previous_slugs" CASCADE;
  DROP TABLE "_articles_v_version_previous_slugs" CASCADE;`)
}

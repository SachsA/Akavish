import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "games_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer
  );
  
  ALTER TABLE "articles_rels" ADD COLUMN "games_id" integer;
  ALTER TABLE "_articles_v_rels" ADD COLUMN "games_id" integer;
  ALTER TABLE "games_rels" ADD CONSTRAINT "games_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "games_rels" ADD CONSTRAINT "games_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "games_rels_order_idx" ON "games_rels" USING btree ("order");
  CREATE INDEX "games_rels_parent_idx" ON "games_rels" USING btree ("parent_id");
  CREATE INDEX "games_rels_path_idx" ON "games_rels" USING btree ("path");
  CREATE INDEX "games_rels_media_id_idx" ON "games_rels" USING btree ("media_id");
  ALTER TABLE "articles_rels" ADD CONSTRAINT "articles_rels_games_fk" FOREIGN KEY ("games_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_rels" ADD CONSTRAINT "_articles_v_rels_games_fk" FOREIGN KEY ("games_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "articles_rels_games_id_idx" ON "articles_rels" USING btree ("games_id");
  CREATE INDEX "_articles_v_rels_games_id_idx" ON "_articles_v_rels" USING btree ("games_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "games_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "games_rels" CASCADE;
  ALTER TABLE "articles_rels" DROP CONSTRAINT "articles_rels_games_fk";
  
  ALTER TABLE "_articles_v_rels" DROP CONSTRAINT "_articles_v_rels_games_fk";
  
  DROP INDEX "articles_rels_games_id_idx";
  DROP INDEX "_articles_v_rels_games_id_idx";
  ALTER TABLE "articles_rels" DROP COLUMN "games_id";
  ALTER TABLE "_articles_v_rels" DROP COLUMN "games_id";`)
}

import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "game_follows" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"reader_id" integer NOT NULL,
  	"game_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "game_follows_id" integer;
  ALTER TABLE "game_follows" ADD CONSTRAINT "game_follows_reader_id_readers_id_fk" FOREIGN KEY ("reader_id") REFERENCES "public"."readers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "game_follows" ADD CONSTRAINT "game_follows_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "game_follows_reader_idx" ON "game_follows" USING btree ("reader_id");
  CREATE INDEX "game_follows_game_idx" ON "game_follows" USING btree ("game_id");
  CREATE INDEX "game_follows_updated_at_idx" ON "game_follows" USING btree ("updated_at");
  CREATE INDEX "game_follows_created_at_idx" ON "game_follows" USING btree ("created_at");
  CREATE UNIQUE INDEX "reader_game_idx" ON "game_follows" USING btree ("reader_id","game_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_game_follows_fk" FOREIGN KEY ("game_follows_id") REFERENCES "public"."game_follows"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_game_follows_id_idx" ON "payload_locked_documents_rels" USING btree ("game_follows_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "game_follows" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "game_follows" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_game_follows_fk";
  
  DROP INDEX "payload_locked_documents_rels_game_follows_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "game_follows_id";`)
}

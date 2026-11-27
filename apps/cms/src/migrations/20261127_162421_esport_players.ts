import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Esport players (2026-11-27, step 3): esport-players, lineups' members,
// and an article's players (articles_rels). Additive.

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_esport_players_game" AS ENUM('cs2', 'valorant', 'lol', 'r6', 'rl');
  CREATE TABLE "esport_lineups_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"esport_players_id" integer
  );
  
  CREATE TABLE "esport_players" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"panda_id" numeric NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar,
  	"first_name" varchar,
  	"last_name" varchar,
  	"nationality" varchar,
  	"role" varchar,
  	"game" "enum_esport_players_game",
  	"current_team_id" integer,
  	"last_team_id" integer,
  	"last_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "esport_players_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  ALTER TABLE "articles_rels" ADD COLUMN "esport_players_id" integer;
  ALTER TABLE "_articles_v_rels" ADD COLUMN "esport_players_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "esport_players_id" integer;
  ALTER TABLE "esport_lineups_rels" ADD CONSTRAINT "esport_lineups_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."esport_lineups"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "esport_lineups_rels" ADD CONSTRAINT "esport_lineups_rels_esport_players_fk" FOREIGN KEY ("esport_players_id") REFERENCES "public"."esport_players"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "esport_players" ADD CONSTRAINT "esport_players_current_team_id_esport_teams_id_fk" FOREIGN KEY ("current_team_id") REFERENCES "public"."esport_teams"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "esport_players" ADD CONSTRAINT "esport_players_last_team_id_esport_teams_id_fk" FOREIGN KEY ("last_team_id") REFERENCES "public"."esport_teams"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "esport_players_texts" ADD CONSTRAINT "esport_players_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."esport_players"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "esport_lineups_rels_order_idx" ON "esport_lineups_rels" USING btree ("order");
  CREATE INDEX "esport_lineups_rels_parent_idx" ON "esport_lineups_rels" USING btree ("parent_id");
  CREATE INDEX "esport_lineups_rels_path_idx" ON "esport_lineups_rels" USING btree ("path");
  CREATE INDEX "esport_lineups_rels_esport_players_id_idx" ON "esport_lineups_rels" USING btree ("esport_players_id");
  CREATE UNIQUE INDEX "esport_players_panda_id_idx" ON "esport_players" USING btree ("panda_id");
  CREATE UNIQUE INDEX "esport_players_slug_idx" ON "esport_players" USING btree ("slug");
  CREATE INDEX "esport_players_game_idx" ON "esport_players" USING btree ("game");
  CREATE INDEX "esport_players_current_team_idx" ON "esport_players" USING btree ("current_team_id");
  CREATE INDEX "esport_players_last_team_idx" ON "esport_players" USING btree ("last_team_id");
  CREATE INDEX "esport_players_last_at_idx" ON "esport_players" USING btree ("last_at");
  CREATE INDEX "esport_players_updated_at_idx" ON "esport_players" USING btree ("updated_at");
  CREATE INDEX "esport_players_created_at_idx" ON "esport_players" USING btree ("created_at");
  CREATE INDEX "esport_players_texts_order_parent" ON "esport_players_texts" USING btree ("order","parent_id");
  ALTER TABLE "articles_rels" ADD CONSTRAINT "articles_rels_esport_players_fk" FOREIGN KEY ("esport_players_id") REFERENCES "public"."esport_players"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_rels" ADD CONSTRAINT "_articles_v_rels_esport_players_fk" FOREIGN KEY ("esport_players_id") REFERENCES "public"."esport_players"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_esport_players_fk" FOREIGN KEY ("esport_players_id") REFERENCES "public"."esport_players"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "articles_rels_esport_players_id_idx" ON "articles_rels" USING btree ("esport_players_id");
  CREATE INDEX "_articles_v_rels_esport_players_id_idx" ON "_articles_v_rels" USING btree ("esport_players_id");
  CREATE INDEX "payload_locked_documents_rels_esport_players_id_idx" ON "payload_locked_documents_rels" USING btree ("esport_players_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "esport_lineups_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "esport_players" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "esport_players_texts" DISABLE ROW LEVEL SECURITY;
  DROP TABLE IF EXISTS "esport_lineups_rels" CASCADE;
  DROP TABLE IF EXISTS "esport_players" CASCADE;
  DROP TABLE IF EXISTS "esport_players_texts" CASCADE;
  ALTER TABLE "articles_rels" DROP CONSTRAINT IF EXISTS "articles_rels_esport_players_fk";
  
  ALTER TABLE "_articles_v_rels" DROP CONSTRAINT IF EXISTS "_articles_v_rels_esport_players_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_esport_players_fk";
  
  DROP INDEX IF EXISTS "articles_rels_esport_players_id_idx";
  DROP INDEX IF EXISTS "_articles_v_rels_esport_players_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_esport_players_id_idx";
  ALTER TABLE "articles_rels" DROP COLUMN IF EXISTS "esport_players_id";
  ALTER TABLE "_articles_v_rels" DROP COLUMN IF EXISTS "esport_players_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "esport_players_id";
  DROP TYPE IF EXISTS "public"."enum_esport_players_game";`)
}

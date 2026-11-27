import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Esport teams (2026-11-27, step 2): esport-lineups (who played each
// edition, with which players), teams' own slug (the PandaScore one kept as
// panda_slug), tier, last edition, aliases, current roster, and an article's
// teams (articles_rels). Additive.

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_esport_teams_tier" AS ENUM('s', 'a', 'b', 'c', 'd', 'unranked');
  CREATE TYPE "public"."enum_esport_lineups_game" AS ENUM('cs2', 'valorant', 'lol', 'r6', 'rl');
  CREATE TYPE "public"."enum_esport_lineups_tier" AS ENUM('s', 'a', 'b', 'c', 'd', 'unranked');
  CREATE TABLE "esport_teams_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "esport_lineups" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"team_id" integer,
  	"series_id" integer,
  	"game" "enum_esport_lineups_game" NOT NULL,
  	"tier" "enum_esport_lineups_tier" DEFAULT 'unranked',
  	"begin_at" timestamp(3) with time zone,
  	"players" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  DROP INDEX "esport_teams_slug_idx";
  ALTER TABLE "articles_rels" ADD COLUMN "esport_teams_id" integer;
  ALTER TABLE "_articles_v_rels" ADD COLUMN "esport_teams_id" integer;
  ALTER TABLE "esport_teams" ADD COLUMN "panda_slug" varchar;
  -- The slug was PandaScore's; ours ("cs2-vitality") is set by the next sync.
  UPDATE "esport_teams" SET "panda_slug" = "slug", "slug" = NULL;
  ALTER TABLE "esport_teams" ADD COLUMN "tier" "enum_esport_teams_tier" DEFAULT 'unranked';
  ALTER TABLE "esport_teams" ADD COLUMN "last_at" timestamp(3) with time zone;
  ALTER TABLE "esport_teams" ADD COLUMN "players" jsonb;
  ALTER TABLE "esport_teams" ADD COLUMN "players_at" timestamp(3) with time zone;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "esport_lineups_id" integer;
  ALTER TABLE "esport_teams_texts" ADD CONSTRAINT "esport_teams_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."esport_teams"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "esport_lineups" ADD CONSTRAINT "esport_lineups_team_id_esport_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."esport_teams"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "esport_lineups" ADD CONSTRAINT "esport_lineups_series_id_esport_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."esport_series"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "esport_teams_texts_order_parent" ON "esport_teams_texts" USING btree ("order","parent_id");
  CREATE UNIQUE INDEX "esport_lineups_key_idx" ON "esport_lineups" USING btree ("key");
  CREATE INDEX "esport_lineups_team_idx" ON "esport_lineups" USING btree ("team_id");
  CREATE INDEX "esport_lineups_series_idx" ON "esport_lineups" USING btree ("series_id");
  CREATE INDEX "esport_lineups_game_idx" ON "esport_lineups" USING btree ("game");
  CREATE INDEX "esport_lineups_begin_at_idx" ON "esport_lineups" USING btree ("begin_at");
  CREATE INDEX "esport_lineups_updated_at_idx" ON "esport_lineups" USING btree ("updated_at");
  CREATE INDEX "esport_lineups_created_at_idx" ON "esport_lineups" USING btree ("created_at");
  ALTER TABLE "articles_rels" ADD CONSTRAINT "articles_rels_esport_teams_fk" FOREIGN KEY ("esport_teams_id") REFERENCES "public"."esport_teams"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_rels" ADD CONSTRAINT "_articles_v_rels_esport_teams_fk" FOREIGN KEY ("esport_teams_id") REFERENCES "public"."esport_teams"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_esport_lineups_fk" FOREIGN KEY ("esport_lineups_id") REFERENCES "public"."esport_lineups"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "articles_rels_esport_teams_id_idx" ON "articles_rels" USING btree ("esport_teams_id");
  CREATE INDEX "_articles_v_rels_esport_teams_id_idx" ON "_articles_v_rels" USING btree ("esport_teams_id");
  CREATE INDEX "esport_teams_tier_idx" ON "esport_teams" USING btree ("tier");
  CREATE INDEX "esport_teams_last_at_idx" ON "esport_teams" USING btree ("last_at");
  CREATE INDEX "payload_locked_documents_rels_esport_lineups_id_idx" ON "payload_locked_documents_rels" USING btree ("esport_lineups_id");
  CREATE UNIQUE INDEX "esport_teams_slug_idx" ON "esport_teams" USING btree ("slug");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "esport_teams_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "esport_lineups" DISABLE ROW LEVEL SECURITY;
  DROP TABLE IF EXISTS "esport_teams_texts" CASCADE;
  DROP TABLE IF EXISTS "esport_lineups" CASCADE;
  ALTER TABLE "articles_rels" DROP CONSTRAINT IF EXISTS "articles_rels_esport_teams_fk";
  
  ALTER TABLE "_articles_v_rels" DROP CONSTRAINT IF EXISTS "_articles_v_rels_esport_teams_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_esport_lineups_fk";
  
  DROP INDEX IF EXISTS "articles_rels_esport_teams_id_idx";
  DROP INDEX IF EXISTS "_articles_v_rels_esport_teams_id_idx";
  DROP INDEX IF EXISTS "esport_teams_tier_idx";
  DROP INDEX IF EXISTS "esport_teams_last_at_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_esport_lineups_id_idx";
  DROP INDEX IF EXISTS "esport_teams_slug_idx";
  CREATE INDEX "esport_teams_slug_idx" ON "esport_teams" USING btree ("slug");
  ALTER TABLE "articles_rels" DROP COLUMN IF EXISTS "esport_teams_id";
  ALTER TABLE "_articles_v_rels" DROP COLUMN IF EXISTS "esport_teams_id";
  UPDATE "esport_teams" SET "slug" = "panda_slug";
  ALTER TABLE "esport_teams" DROP COLUMN IF EXISTS "panda_slug";
  ALTER TABLE "esport_teams" DROP COLUMN IF EXISTS "tier";
  ALTER TABLE "esport_teams" DROP COLUMN IF EXISTS "last_at";
  ALTER TABLE "esport_teams" DROP COLUMN IF EXISTS "players";
  ALTER TABLE "esport_teams" DROP COLUMN IF EXISTS "players_at";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "esport_lineups_id";
  DROP TYPE IF EXISTS "public"."enum_esport_teams_tier";
  DROP TYPE IF EXISTS "public"."enum_esport_lineups_game";
  DROP TYPE IF EXISTS "public"."enum_esport_lineups_tier";`)
}

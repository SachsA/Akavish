import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Consoles become documents (collection `platforms`). The select values of
// each game's releases and of its computed list are copied into games_rels
// before the select tables go; down copies them back (for the 24 consoles
// that had a value).

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_platforms_family" AS ENUM('pc', 'playstation', 'xbox', 'nintendo', 'mobile', 'vr', 'other');
  CREATE TYPE "public"."enum_platforms_release_precision" AS ENUM('day', 'month', 'quarter', 'year', 'tba');
  CREATE TABLE "platforms" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"short" varchar,
  	"family" "enum_platforms_family" DEFAULT 'other' NOT NULL,
  	"position" numeric DEFAULT 0,
  	"release_precision" "enum_platforms_release_precision" DEFAULT 'tba',
  	"release_date" timestamp(3) with time zone,
  	"logo_id" integer,
  	"tag_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "platforms_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  ALTER TABLE "games_rels" ADD COLUMN "platforms_id" integer;

  -- The 24 consoles the select field had, in the same order inside each family.
  INSERT INTO "platforms" ("name", "slug", "short", "family", "position") VALUES
    ('PC', 'pc', 'PC', 'pc', 0),
    ('Mac', 'mac', 'Mac', 'pc', 1),
    ('PlayStation 5', 'ps5', 'PS5', 'playstation', 0),
    ('PlayStation 4', 'ps4', 'PS4', 'playstation', 1),
    ('PlayStation 3', 'ps3', 'PS3', 'playstation', 2),
    ('PlayStation 2', 'ps2', 'PS2', 'playstation', 3),
    ('PlayStation', 'ps1', 'PS1', 'playstation', 4),
    ('PSP', 'psp', 'PSP', 'playstation', 5),
    ('PS Vita', 'vita', 'Vita', 'playstation', 6),
    ('Xbox Series X|S', 'xbox-series', 'Xbox Series', 'xbox', 0),
    ('Xbox One', 'xbox-one', 'Xbox One', 'xbox', 1),
    ('Xbox 360', 'xbox-360', 'Xbox 360', 'xbox', 2),
    ('Xbox (2001)', 'xbox', 'Xbox', 'xbox', 3),
    ('Nintendo Switch 2', 'switch-2', 'Switch 2', 'nintendo', 0),
    ('Nintendo Switch', 'switch', 'Switch', 'nintendo', 1),
    ('Wii U', 'wii-u', 'Wii U', 'nintendo', 2),
    ('Wii', 'wii', 'Wii', 'nintendo', 3),
    ('GameCube', 'gamecube', 'GameCube', 'nintendo', 4),
    ('Nintendo 64', 'n64', 'N64', 'nintendo', 5),
    ('Nintendo 3DS', '3ds', '3DS', 'nintendo', 6),
    ('Nintendo DS', 'ds', 'DS', 'nintendo', 7),
    ('iOS', 'ios', 'iOS', 'mobile', 0),
    ('Android', 'android', 'Android', 'mobile', 1),
    ('Meta Quest', 'quest', 'Quest', 'vr', 0);
  -- Each release's consoles and each game's computed list, as relationships
  -- (games_rels: "releases.<index>.platforms", "platforms").
  INSERT INTO "games_rels" ("order", "parent_id", "path", "platforms_id")
    SELECT grp."order", gr."_parent_id", 'releases.' || (gr."_order" - 1) || '.platforms', p."id"
    FROM "games_releases_platforms" grp
    JOIN "games_releases" gr ON gr."id" = grp."parent_id"
    JOIN "platforms" p ON p."slug" = grp."value"::text;
  INSERT INTO "games_rels" ("order", "parent_id", "path", "platforms_id")
    SELECT gp."order", gp."parent_id", 'platforms', p."id"
    FROM "games_platforms" gp
    JOIN "platforms" p ON p."slug" = gp."value"::text;
  -- Each console's tag (its articles show on its page): the tag of the same
  -- name, else of its short name ("PS5"); the brand tags "PlayStation" and
  -- "Xbox" aren't the 1994 and 2001 consoles ("Xbox" goes to today's).
  UPDATE "platforms" p SET "tag_id" = t."id" FROM "tags" t
    WHERE p."slug" <> 'ps1' AND lower(t."name") = lower(p."name");
  UPDATE "platforms" p SET "tag_id" = t."id" FROM "tags" t
    WHERE p."tag_id" IS NULL AND p."slug" <> 'xbox' AND lower(t."name") = lower(p."short");
  UPDATE "platforms" p SET "tag_id" = t."id" FROM "tags" t
    WHERE p."tag_id" IS NULL AND p."slug" = 'xbox-series' AND lower(t."name") = 'xbox';

  ALTER TABLE "games_releases_platforms" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "games_platforms" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "games_releases_platforms" CASCADE;
  DROP TABLE "games_platforms" CASCADE;
  ALTER TABLE "scout_stories" ADD COLUMN "console_facts" jsonb;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "platforms_id" integer;
  ALTER TABLE "platforms" ADD CONSTRAINT "platforms_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "platforms" ADD CONSTRAINT "platforms_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "platforms_texts" ADD CONSTRAINT "platforms_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."platforms"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "platforms_name_idx" ON "platforms" USING btree ("name");
  CREATE UNIQUE INDEX "platforms_slug_idx" ON "platforms" USING btree ("slug");
  CREATE INDEX "platforms_logo_idx" ON "platforms" USING btree ("logo_id");
  CREATE INDEX "platforms_tag_idx" ON "platforms" USING btree ("tag_id");
  CREATE INDEX "platforms_updated_at_idx" ON "platforms" USING btree ("updated_at");
  CREATE INDEX "platforms_created_at_idx" ON "platforms" USING btree ("created_at");
  CREATE INDEX "platforms_texts_order_parent" ON "platforms_texts" USING btree ("order","parent_id");
  ALTER TABLE "games_rels" ADD CONSTRAINT "games_rels_platforms_fk" FOREIGN KEY ("platforms_id") REFERENCES "public"."platforms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_platforms_fk" FOREIGN KEY ("platforms_id") REFERENCES "public"."platforms"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "games_rels_platforms_id_idx" ON "games_rels" USING btree ("platforms_id");
  CREATE INDEX "payload_locked_documents_rels_platforms_id_idx" ON "payload_locked_documents_rels" USING btree ("platforms_id");
  DROP TYPE "public"."enum_games_releases_platforms";
  DROP TYPE "public"."enum_games_platforms";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_games_releases_platforms" AS ENUM('pc', 'mac', 'ps5', 'ps4', 'ps3', 'ps2', 'ps1', 'psp', 'vita', 'xbox-series', 'xbox-one', 'xbox-360', 'xbox', 'switch-2', 'switch', 'wii-u', 'wii', 'gamecube', 'n64', '3ds', 'ds', 'ios', 'android', 'quest');
  CREATE TYPE "public"."enum_games_platforms" AS ENUM('pc', 'mac', 'ps5', 'ps4', 'ps3', 'ps2', 'ps1', 'psp', 'vita', 'xbox-series', 'xbox-one', 'xbox-360', 'xbox', 'switch-2', 'switch', 'wii-u', 'wii', 'gamecube', 'n64', '3ds', 'ds', 'ios', 'android', 'quest');
  CREATE TABLE "games_releases_platforms" (
  	"order" integer NOT NULL,
  	"parent_id" varchar NOT NULL,
  	"value" "enum_games_releases_platforms",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "games_platforms" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_games_platforms",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  -- Back to the select values, for the 24 consoles that existed (a console
  -- created since has no value to go back to).
  INSERT INTO "games_releases_platforms" ("order", "parent_id", "value")
    SELECT r."order", gr."id", p."slug"::"enum_games_releases_platforms"
    FROM "games_rels" r
    JOIN "platforms" p ON p."id" = r."platforms_id"
    JOIN "games_releases" gr ON gr."_parent_id" = r."parent_id"
      AND r."path" = 'releases.' || (gr."_order" - 1) || '.platforms'
    WHERE p."slug" IN (SELECT unnest(enum_range(NULL::"enum_games_releases_platforms"))::text);
  INSERT INTO "games_platforms" ("order", "parent_id", "value")
    SELECT r."order", r."parent_id", p."slug"::"enum_games_platforms"
    FROM "games_rels" r JOIN "platforms" p ON p."id" = r."platforms_id"
    WHERE r."path" = 'platforms'
      AND p."slug" IN (SELECT unnest(enum_range(NULL::"enum_games_platforms"))::text);
  DELETE FROM "games_rels" WHERE "platforms_id" IS NOT NULL;
  ALTER TABLE "platforms" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "platforms_texts" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "platforms" CASCADE;
  DROP TABLE "platforms_texts" CASCADE;
  ALTER TABLE "games_rels" DROP CONSTRAINT IF EXISTS "games_rels_platforms_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_platforms_fk";
  
  DROP INDEX IF EXISTS "games_rels_platforms_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_platforms_id_idx";
  ALTER TABLE "games_releases_platforms" ADD CONSTRAINT "games_releases_platforms_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."games_releases"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "games_platforms" ADD CONSTRAINT "games_platforms_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "games_releases_platforms_order_idx" ON "games_releases_platforms" USING btree ("order");
  CREATE INDEX "games_releases_platforms_parent_idx" ON "games_releases_platforms" USING btree ("parent_id");
  CREATE INDEX "games_platforms_order_idx" ON "games_platforms" USING btree ("order");
  CREATE INDEX "games_platforms_parent_idx" ON "games_platforms" USING btree ("parent_id");
  ALTER TABLE "games_rels" DROP COLUMN "platforms_id";
  ALTER TABLE "scout_stories" DROP COLUMN "console_facts";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "platforms_id";
  DROP TYPE "public"."enum_platforms_family";
  DROP TYPE "public"."enum_platforms_release_precision";`)
}

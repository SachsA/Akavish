import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Esport follows (teams, events, matches), the readers' notifications (the
// bell) and their notify settings on Readers. Additive.

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_esport_follows_kind" AS ENUM('team', 'event', 'match');
  CREATE TYPE "public"."enum_reader_notifications_kind" AS ENUM('match_start', 'match_end', 'article');
  CREATE TABLE "esport_follows" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"reader_id" integer NOT NULL,
  	"kind" "enum_esport_follows_kind" NOT NULL,
  	"panda_id" numeric NOT NULL,
  	"game" varchar,
  	"label" varchar NOT NULL,
  	"acronym" varchar,
  	"logo" varchar,
  	"slug" varchar,
  	"at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "reader_notifications" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"reader_id" integer NOT NULL,
  	"kind" "enum_reader_notifications_kind" NOT NULL,
  	"data" jsonb NOT NULL,
  	"url" varchar NOT NULL,
  	"dedupe_key" varchar NOT NULL,
  	"read_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "readers" ADD COLUMN "notify_match_start" boolean DEFAULT true;
  ALTER TABLE "readers" ADD COLUMN "notify_results" boolean DEFAULT true;
  ALTER TABLE "readers" ADD COLUMN "notify_news" boolean DEFAULT true;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "esport_follows_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "reader_notifications_id" integer;
  ALTER TABLE "esport_follows" ADD CONSTRAINT "esport_follows_reader_id_readers_id_fk" FOREIGN KEY ("reader_id") REFERENCES "public"."readers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reader_notifications" ADD CONSTRAINT "reader_notifications_reader_id_readers_id_fk" FOREIGN KEY ("reader_id") REFERENCES "public"."readers"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "esport_follows_reader_idx" ON "esport_follows" USING btree ("reader_id");
  CREATE INDEX "esport_follows_kind_idx" ON "esport_follows" USING btree ("kind");
  CREATE INDEX "esport_follows_panda_id_idx" ON "esport_follows" USING btree ("panda_id");
  CREATE INDEX "esport_follows_updated_at_idx" ON "esport_follows" USING btree ("updated_at");
  CREATE INDEX "esport_follows_created_at_idx" ON "esport_follows" USING btree ("created_at");
  CREATE UNIQUE INDEX "reader_kind_pandaId_idx" ON "esport_follows" USING btree ("reader_id","kind","panda_id");
  CREATE INDEX "reader_notifications_reader_idx" ON "reader_notifications" USING btree ("reader_id");
  CREATE INDEX "reader_notifications_read_at_idx" ON "reader_notifications" USING btree ("read_at");
  CREATE INDEX "reader_notifications_updated_at_idx" ON "reader_notifications" USING btree ("updated_at");
  CREATE INDEX "reader_notifications_created_at_idx" ON "reader_notifications" USING btree ("created_at");
  CREATE UNIQUE INDEX "reader_dedupeKey_idx" ON "reader_notifications" USING btree ("reader_id","dedupe_key");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_esport_follows_fk" FOREIGN KEY ("esport_follows_id") REFERENCES "public"."esport_follows"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_reader_notifications_fk" FOREIGN KEY ("reader_notifications_id") REFERENCES "public"."reader_notifications"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_esport_follows_id_idx" ON "payload_locked_documents_rels" USING btree ("esport_follows_id");
  CREATE INDEX "payload_locked_documents_rels_reader_notifications_id_idx" ON "payload_locked_documents_rels" USING btree ("reader_notifications_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "esport_follows" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "reader_notifications" DISABLE ROW LEVEL SECURITY;
  DROP TABLE IF EXISTS "esport_follows" CASCADE;
  DROP TABLE IF EXISTS "reader_notifications" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_esport_follows_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_reader_notifications_fk";
  
  DROP INDEX IF EXISTS "payload_locked_documents_rels_esport_follows_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_reader_notifications_id_idx";
  ALTER TABLE "readers" DROP COLUMN IF EXISTS "notify_match_start";
  ALTER TABLE "readers" DROP COLUMN IF EXISTS "notify_results";
  ALTER TABLE "readers" DROP COLUMN IF EXISTS "notify_news";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "esport_follows_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "reader_notifications_id";
  DROP TYPE IF EXISTS "public"."enum_esport_follows_kind";
  DROP TYPE IF EXISTS "public"."enum_reader_notifications_kind";`)
}

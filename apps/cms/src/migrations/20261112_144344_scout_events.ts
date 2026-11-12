import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_scout_events_status" AS ENUM('live', 'ending', 'ended');
  CREATE TABLE "scout_events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"status" "enum_scout_events_status" DEFAULT 'live' NOT NULL,
  	"started_at" timestamp(3) with time zone NOT NULL,
  	"ended_at" timestamp(3) with time zone,
  	"article_id" integer,
  	"recap_article_id" integer,
  	"cover_id" integer,
  	"published" boolean DEFAULT false,
  	"intro" varchar,
  	"entries" jsonb,
  	"notes" jsonb,
  	"previous" jsonb,
  	"rev" numeric DEFAULT 0,
  	"items_since" timestamp(3) with time zone,
  	"last_update_at" timestamp(3) with time zone,
  	"discord_message_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "scout_events_id" integer;
  ALTER TABLE "scout_events" ADD CONSTRAINT "scout_events_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "scout_events" ADD CONSTRAINT "scout_events_recap_article_id_articles_id_fk" FOREIGN KEY ("recap_article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "scout_events" ADD CONSTRAINT "scout_events_cover_id_media_id_fk" FOREIGN KEY ("cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "scout_events_status_idx" ON "scout_events" USING btree ("status");
  CREATE INDEX "scout_events_article_idx" ON "scout_events" USING btree ("article_id");
  CREATE INDEX "scout_events_recap_article_idx" ON "scout_events" USING btree ("recap_article_id");
  CREATE INDEX "scout_events_cover_idx" ON "scout_events" USING btree ("cover_id");
  CREATE INDEX "scout_events_updated_at_idx" ON "scout_events" USING btree ("updated_at");
  CREATE INDEX "scout_events_created_at_idx" ON "scout_events" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_scout_events_fk" FOREIGN KEY ("scout_events_id") REFERENCES "public"."scout_events"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_scout_events_id_idx" ON "payload_locked_documents_rels" USING btree ("scout_events_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "scout_events" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "scout_events" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_scout_events_fk";
  
  DROP INDEX "payload_locked_documents_rels_scout_events_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "scout_events_id";
  DROP TYPE "public"."enum_scout_events_status";`)
}

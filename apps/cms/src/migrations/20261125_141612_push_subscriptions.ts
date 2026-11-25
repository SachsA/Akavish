import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Web push: push-subscriptions (one per browser) and notify.hideScores on
// Readers (a result's push leaves the score out). Additive.

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_push_subscriptions_locale" AS ENUM('en', 'fr');
  CREATE TABLE "push_subscriptions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"reader_id" integer NOT NULL,
  	"endpoint" varchar NOT NULL,
  	"p256dh" varchar NOT NULL,
  	"auth" varchar NOT NULL,
  	"locale" "enum_push_subscriptions_locale" DEFAULT 'en',
  	"user_agent" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "readers" ADD COLUMN "notify_hide_scores" boolean DEFAULT false;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "push_subscriptions_id" integer;
  ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_reader_id_readers_id_fk" FOREIGN KEY ("reader_id") REFERENCES "public"."readers"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "push_subscriptions_reader_idx" ON "push_subscriptions" USING btree ("reader_id");
  CREATE UNIQUE INDEX "push_subscriptions_endpoint_idx" ON "push_subscriptions" USING btree ("endpoint");
  CREATE INDEX "push_subscriptions_updated_at_idx" ON "push_subscriptions" USING btree ("updated_at");
  CREATE INDEX "push_subscriptions_created_at_idx" ON "push_subscriptions" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_push_subscriptions_fk" FOREIGN KEY ("push_subscriptions_id") REFERENCES "public"."push_subscriptions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_push_subscriptions_id_idx" ON "payload_locked_documents_rels" USING btree ("push_subscriptions_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "push_subscriptions" DISABLE ROW LEVEL SECURITY;
  DROP TABLE IF EXISTS "push_subscriptions" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_push_subscriptions_fk";
  
  DROP INDEX IF EXISTS "payload_locked_documents_rels_push_subscriptions_id_idx";
  ALTER TABLE "readers" DROP COLUMN IF EXISTS "notify_hide_scores";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "push_subscriptions_id";
  DROP TYPE IF EXISTS "public"."enum_push_subscriptions_locale";`)
}

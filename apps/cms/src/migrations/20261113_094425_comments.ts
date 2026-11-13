import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_comments_status" AS ENUM('visible', 'hidden', 'deleted');
  CREATE TYPE "public"."enum_comment_reports_reason" AS ENUM('spam', 'harassment', 'illegal', 'other');
  CREATE TYPE "public"."enum_comment_reports_status" AS ENUM('open', 'resolved');
  CREATE TABLE "comments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"body" varchar,
  	"status" "enum_comments_status" DEFAULT 'visible' NOT NULL,
  	"auto_hidden" boolean DEFAULT false,
  	"article_id" integer NOT NULL,
  	"reader_id" integer,
  	"parent_id" integer,
  	"reply_to_id" integer,
  	"reply_to_name" varchar,
  	"likes" numeric DEFAULT 0,
  	"dislikes" numeric DEFAULT 0,
  	"report_count" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "comment_votes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"reader_id" integer NOT NULL,
  	"comment_id" integer NOT NULL,
  	"value" numeric NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "comment_reports" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"comment_id" integer NOT NULL,
  	"reader_id" integer NOT NULL,
  	"reason" "enum_comment_reports_reason" NOT NULL,
  	"note" varchar,
  	"status" "enum_comment_reports_status" DEFAULT 'open' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "community_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"comments_enabled" boolean DEFAULT true,
  	"auto_hide_reports" numeric DEFAULT 3,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "articles" ADD COLUMN "comments_closed" boolean DEFAULT false;
  ALTER TABLE "_articles_v" ADD COLUMN "version_comments_closed" boolean DEFAULT false;
  ALTER TABLE "readers" ADD COLUMN "username" varchar;
  ALTER TABLE "readers" ADD COLUMN "banned" boolean DEFAULT false;
  ALTER TABLE "readers" ADD COLUMN "email_verified" boolean DEFAULT false;
  ALTER TABLE "readers" ADD COLUMN "clerk_created_at" timestamp(3) with time zone;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "comments_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "comment_votes_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "comment_reports_id" integer;
  ALTER TABLE "comments" ADD CONSTRAINT "comments_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "comments" ADD CONSTRAINT "comments_reader_id_readers_id_fk" FOREIGN KEY ("reader_id") REFERENCES "public"."readers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "comments" ADD CONSTRAINT "comments_reply_to_id_comments_id_fk" FOREIGN KEY ("reply_to_id") REFERENCES "public"."comments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "comment_votes" ADD CONSTRAINT "comment_votes_reader_id_readers_id_fk" FOREIGN KEY ("reader_id") REFERENCES "public"."readers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "comment_votes" ADD CONSTRAINT "comment_votes_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "comment_reports" ADD CONSTRAINT "comment_reports_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "comment_reports" ADD CONSTRAINT "comment_reports_reader_id_readers_id_fk" FOREIGN KEY ("reader_id") REFERENCES "public"."readers"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "comments_status_idx" ON "comments" USING btree ("status");
  CREATE INDEX "comments_article_idx" ON "comments" USING btree ("article_id");
  CREATE INDEX "comments_reader_idx" ON "comments" USING btree ("reader_id");
  CREATE INDEX "comments_parent_idx" ON "comments" USING btree ("parent_id");
  CREATE INDEX "comments_reply_to_idx" ON "comments" USING btree ("reply_to_id");
  CREATE INDEX "comments_likes_idx" ON "comments" USING btree ("likes");
  CREATE INDEX "comments_updated_at_idx" ON "comments" USING btree ("updated_at");
  CREATE INDEX "comments_created_at_idx" ON "comments" USING btree ("created_at");
  CREATE INDEX "comment_votes_reader_idx" ON "comment_votes" USING btree ("reader_id");
  CREATE INDEX "comment_votes_comment_idx" ON "comment_votes" USING btree ("comment_id");
  CREATE INDEX "comment_votes_updated_at_idx" ON "comment_votes" USING btree ("updated_at");
  CREATE INDEX "comment_votes_created_at_idx" ON "comment_votes" USING btree ("created_at");
  CREATE UNIQUE INDEX "reader_comment_idx" ON "comment_votes" USING btree ("reader_id","comment_id");
  CREATE INDEX "comment_reports_comment_idx" ON "comment_reports" USING btree ("comment_id");
  CREATE INDEX "comment_reports_reader_idx" ON "comment_reports" USING btree ("reader_id");
  CREATE INDEX "comment_reports_status_idx" ON "comment_reports" USING btree ("status");
  CREATE INDEX "comment_reports_updated_at_idx" ON "comment_reports" USING btree ("updated_at");
  CREATE INDEX "comment_reports_created_at_idx" ON "comment_reports" USING btree ("created_at");
  CREATE UNIQUE INDEX "reader_comment_1_idx" ON "comment_reports" USING btree ("reader_id","comment_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_comments_fk" FOREIGN KEY ("comments_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_comment_votes_fk" FOREIGN KEY ("comment_votes_id") REFERENCES "public"."comment_votes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_comment_reports_fk" FOREIGN KEY ("comment_reports_id") REFERENCES "public"."comment_reports"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_comments_id_idx" ON "payload_locked_documents_rels" USING btree ("comments_id");
  CREATE INDEX "payload_locked_documents_rels_comment_votes_id_idx" ON "payload_locked_documents_rels" USING btree ("comment_votes_id");
  CREATE INDEX "payload_locked_documents_rels_comment_reports_id_idx" ON "payload_locked_documents_rels" USING btree ("comment_reports_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "comments" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "comment_votes" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "comment_reports" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "community_settings" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "comments" CASCADE;
  DROP TABLE "comment_votes" CASCADE;
  DROP TABLE "comment_reports" CASCADE;
  DROP TABLE "community_settings" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_comments_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_comment_votes_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_comment_reports_fk";
  
  DROP INDEX "payload_locked_documents_rels_comments_id_idx";
  DROP INDEX "payload_locked_documents_rels_comment_votes_id_idx";
  DROP INDEX "payload_locked_documents_rels_comment_reports_id_idx";
  ALTER TABLE "articles" DROP COLUMN "comments_closed";
  ALTER TABLE "_articles_v" DROP COLUMN "version_comments_closed";
  ALTER TABLE "readers" DROP COLUMN "username";
  ALTER TABLE "readers" DROP COLUMN "banned";
  ALTER TABLE "readers" DROP COLUMN "email_verified";
  ALTER TABLE "readers" DROP COLUMN "clerk_created_at";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "comments_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "comment_votes_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "comment_reports_id";
  DROP TYPE "public"."enum_comments_status";
  DROP TYPE "public"."enum_comment_reports_reason";
  DROP TYPE "public"."enum_comment_reports_status";`)
}

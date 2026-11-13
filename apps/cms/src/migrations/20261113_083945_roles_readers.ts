import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'editor', 'writer');
  CREATE TYPE "public"."enum_readers_role" AS ENUM('owner', 'admin', 'moderator', 'author', 'reader');
  CREATE TABLE "readers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"clerk_id" varchar NOT NULL,
  	"display_name" varchar,
  	"email" varchar,
  	"image_url" varchar,
  	"role" "enum_readers_role" DEFAULT 'reader' NOT NULL,
  	"cms_user_id" integer,
  	"author_id" integer,
  	"last_seen_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "bookmarks" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"reader_id" integer NOT NULL,
  	"article_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "users" ADD COLUMN "role" "enum_users_role" DEFAULT 'writer' NOT NULL;
  -- Accounts that exist before roles keep doing everything they did: admins.
  -- New accounts start as writers (an admin promotes them).
  UPDATE "users" SET "role" = 'admin';
  ALTER TABLE "users" ADD COLUMN "author_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "readers_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "bookmarks_id" integer;
  ALTER TABLE "readers" ADD CONSTRAINT "readers_cms_user_id_users_id_fk" FOREIGN KEY ("cms_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "readers" ADD CONSTRAINT "readers_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_reader_id_readers_id_fk" FOREIGN KEY ("reader_id") REFERENCES "public"."readers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "readers_clerk_id_idx" ON "readers" USING btree ("clerk_id");
  CREATE INDEX "readers_email_idx" ON "readers" USING btree ("email");
  CREATE INDEX "readers_cms_user_idx" ON "readers" USING btree ("cms_user_id");
  CREATE INDEX "readers_author_idx" ON "readers" USING btree ("author_id");
  CREATE INDEX "readers_updated_at_idx" ON "readers" USING btree ("updated_at");
  CREATE INDEX "readers_created_at_idx" ON "readers" USING btree ("created_at");
  CREATE INDEX "bookmarks_reader_idx" ON "bookmarks" USING btree ("reader_id");
  CREATE INDEX "bookmarks_article_idx" ON "bookmarks" USING btree ("article_id");
  CREATE INDEX "bookmarks_updated_at_idx" ON "bookmarks" USING btree ("updated_at");
  CREATE INDEX "bookmarks_created_at_idx" ON "bookmarks" USING btree ("created_at");
  CREATE UNIQUE INDEX "reader_article_idx" ON "bookmarks" USING btree ("reader_id","article_id");
  ALTER TABLE "users" ADD CONSTRAINT "users_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_readers_fk" FOREIGN KEY ("readers_id") REFERENCES "public"."readers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_bookmarks_fk" FOREIGN KEY ("bookmarks_id") REFERENCES "public"."bookmarks"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_author_idx" ON "users" USING btree ("author_id");
  CREATE INDEX "payload_locked_documents_rels_readers_id_idx" ON "payload_locked_documents_rels" USING btree ("readers_id");
  CREATE INDEX "payload_locked_documents_rels_bookmarks_id_idx" ON "payload_locked_documents_rels" USING btree ("bookmarks_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "readers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "bookmarks" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "readers" CASCADE;
  DROP TABLE "bookmarks" CASCADE;
  ALTER TABLE "users" DROP CONSTRAINT "users_author_id_authors_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_readers_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_bookmarks_fk";
  
  DROP INDEX "users_author_idx";
  DROP INDEX "payload_locked_documents_rels_readers_id_idx";
  DROP INDEX "payload_locked_documents_rels_bookmarks_id_idx";
  ALTER TABLE "users" DROP COLUMN "role";
  ALTER TABLE "users" DROP COLUMN "author_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "readers_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "bookmarks_id";
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."enum_readers_role";`)
}

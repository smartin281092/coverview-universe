CREATE TABLE "local_preview_personas" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"space_label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "local_preview_personas_email_unique" UNIQUE("email"),
	CONSTRAINT "local_preview_personas_fixture_id" CHECK ("local_preview_personas"."id" ~ '^fixture_'),
	CONSTRAINT "local_preview_personas_test_email" CHECK ("local_preview_personas"."email" like '%.test')
);

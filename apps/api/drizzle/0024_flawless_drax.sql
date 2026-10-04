CREATE TABLE "health_recommendation_catalogs" (
	"id" text PRIMARY KEY NOT NULL,
	"year" integer NOT NULL,
	"dataset_id" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "health_recommendation_commands" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text NOT NULL,
	"key" text NOT NULL,
	"hash" text NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "health_recommendation_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"catalog_id" text NOT NULL,
	"case_id" text NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "health_recommendation_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"year" integer NOT NULL,
	"revision" integer NOT NULL,
	"config" jsonb NOT NULL,
	"actor_id" text,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "health_recommendation_revision_valid" CHECK ("health_recommendation_versions"."revision" >= 1)
);
--> statement-breakpoint
ALTER TABLE "health_recommendation_catalogs" ADD CONSTRAINT "health_recommendation_catalogs_dataset_id_health_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."health_datasets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_recommendation_commands" ADD CONSTRAINT "health_recommendation_commands_actor_id_identity_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_recommendation_reviews" ADD CONSTRAINT "health_recommendation_reviews_catalog_id_health_recommendation_catalogs_id_fk" FOREIGN KEY ("catalog_id") REFERENCES "public"."health_recommendation_catalogs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_recommendation_versions" ADD CONSTRAINT "health_recommendation_versions_actor_id_identity_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "health_recommendation_catalog_year" ON "health_recommendation_catalogs" USING btree ("year","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "health_recommendation_command_unique" ON "health_recommendation_commands" USING btree ("actor_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "health_recommendation_case_unique" ON "health_recommendation_reviews" USING btree ("catalog_id","case_id");--> statement-breakpoint
CREATE UNIQUE INDEX "health_recommendation_version_number" ON "health_recommendation_versions" USING btree ("year","revision");
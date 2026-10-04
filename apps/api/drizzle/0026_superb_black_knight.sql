CREATE TABLE "health_foreign_datasets" (
	"id" text PRIMARY KEY NOT NULL,
	"year" integer NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"source_url" text NOT NULL,
	"sha256" text NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "health_foreign_premiums" (
	"id" text PRIMARY KEY NOT NULL,
	"dataset_id" text NOT NULL,
	"insurer_id" integer NOT NULL,
	"country" text NOT NULL,
	"age_group" text NOT NULL,
	"age_subgroup" text NOT NULL,
	"accident" boolean NOT NULL,
	"deductible" integer NOT NULL,
	"monthly_premium_minor" integer NOT NULL,
	"raw" jsonb NOT NULL,
	CONSTRAINT "health_foreign_money" CHECK ("health_foreign_premiums"."monthly_premium_minor">=0 and "health_foreign_premiums"."deductible" in (0,300))
);
--> statement-breakpoint
ALTER TABLE "health_foreign_premiums" ADD CONSTRAINT "health_foreign_premiums_dataset_id_health_foreign_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."health_foreign_datasets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_foreign_premiums" ADD CONSTRAINT "health_foreign_premiums_insurer_id_health_insurers_id_fk" FOREIGN KEY ("insurer_id") REFERENCES "public"."health_insurers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "health_foreign_active_year" ON "health_foreign_datasets" USING btree ("year") WHERE "health_foreign_datasets"."active"=true;--> statement-breakpoint
CREATE UNIQUE INDEX "health_foreign_grain" ON "health_foreign_premiums" USING btree ("dataset_id","insurer_id","country","age_group","age_subgroup","accident","deductible");--> statement-breakpoint
CREATE INDEX "health_foreign_compare" ON "health_foreign_premiums" USING btree ("dataset_id","country","age_group","accident","monthly_premium_minor");
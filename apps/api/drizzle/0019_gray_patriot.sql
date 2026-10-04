CREATE TABLE "health_benefits" (
	"id" text PRIMARY KEY NOT NULL,
	"insurer_id" integer NOT NULL,
	"tariff_code" text,
	"kind" text NOT NULL,
	"key" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"value" boolean,
	"amount_minor" integer,
	"currency" text DEFAULT 'CHF' NOT NULL,
	"period" text,
	"conditions" text NOT NULL,
	"source_url" text NOT NULL,
	"verified_at" text NOT NULL,
	"valid_from" text,
	"valid_until" text,
	"year_confirmed" boolean NOT NULL,
	"requires_supplementary" boolean,
	CONSTRAINT "health_benefit_money" CHECK ("health_benefits"."amount_minor" is null or "health_benefits"."amount_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "health_datasets" (
	"id" text PRIMARY KEY NOT NULL,
	"year" integer NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sources" jsonb NOT NULL,
	"counts" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "health_eligibility" (
	"id" text PRIMARY KEY NOT NULL,
	"model_id" text NOT NULL,
	"region_key" text NOT NULL,
	"restricted" boolean NOT NULL,
	"municipality_ids" integer[] NOT NULL
);
--> statement-breakpoint
CREATE TABLE "health_insurers" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "health_localities" (
	"id" text PRIMARY KEY NOT NULL,
	"dataset_id" text NOT NULL,
	"region_key" text NOT NULL,
	"municipality_id" integer NOT NULL,
	"municipality" text NOT NULL,
	"postal_code" text NOT NULL,
	"locality" text NOT NULL,
	"search_text" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "health_models" (
	"id" text PRIMARY KEY NOT NULL,
	"dataset_id" text NOT NULL,
	"insurer_id" integer NOT NULL,
	"tariff_code" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "health_premiums" (
	"id" text PRIMARY KEY NOT NULL,
	"dataset_id" text NOT NULL,
	"model_id" text NOT NULL,
	"region_key" text NOT NULL,
	"age_group" text NOT NULL,
	"age_subgroup" text NOT NULL,
	"accident" boolean NOT NULL,
	"deductible" integer NOT NULL,
	"monthly_premium_minor" integer NOT NULL,
	"currency" text DEFAULT 'CHF' NOT NULL,
	"raw" jsonb NOT NULL,
	CONSTRAINT "health_premium_money" CHECK ("health_premiums"."monthly_premium_minor" >= 0 and "health_premiums"."deductible" >= 0 and "health_premiums"."currency" = 'CHF')
);
--> statement-breakpoint
CREATE TABLE "health_regions" (
	"id" text PRIMARY KEY NOT NULL,
	"dataset_id" text NOT NULL,
	"region_id" text NOT NULL,
	"canton" text NOT NULL,
	"number" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "health_benefits" ADD CONSTRAINT "health_benefits_insurer_id_health_insurers_id_fk" FOREIGN KEY ("insurer_id") REFERENCES "public"."health_insurers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_eligibility" ADD CONSTRAINT "health_eligibility_model_id_health_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."health_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_eligibility" ADD CONSTRAINT "health_eligibility_region_key_health_regions_id_fk" FOREIGN KEY ("region_key") REFERENCES "public"."health_regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_localities" ADD CONSTRAINT "health_localities_dataset_id_health_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."health_datasets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_localities" ADD CONSTRAINT "health_localities_region_key_health_regions_id_fk" FOREIGN KEY ("region_key") REFERENCES "public"."health_regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_models" ADD CONSTRAINT "health_models_dataset_id_health_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."health_datasets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_models" ADD CONSTRAINT "health_models_insurer_id_health_insurers_id_fk" FOREIGN KEY ("insurer_id") REFERENCES "public"."health_insurers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_premiums" ADD CONSTRAINT "health_premiums_dataset_id_health_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."health_datasets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_premiums" ADD CONSTRAINT "health_premiums_model_id_health_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."health_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_premiums" ADD CONSTRAINT "health_premiums_region_key_health_regions_id_fk" FOREIGN KEY ("region_key") REFERENCES "public"."health_regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_regions" ADD CONSTRAINT "health_regions_dataset_id_health_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."health_datasets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "health_benefit_model" ON "health_benefits" USING btree ("insurer_id","tariff_code");--> statement-breakpoint
CREATE UNIQUE INDEX "health_one_active_year" ON "health_datasets" USING btree ("year") WHERE "health_datasets"."active" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "health_eligibility_key" ON "health_eligibility" USING btree ("model_id","region_key");--> statement-breakpoint
CREATE INDEX "health_locality_postal" ON "health_localities" USING btree ("dataset_id","postal_code");--> statement-breakpoint
CREATE INDEX "health_locality_municipality" ON "health_localities" USING btree ("dataset_id","municipality_id");--> statement-breakpoint
CREATE UNIQUE INDEX "health_model_tariff" ON "health_models" USING btree ("dataset_id","insurer_id","tariff_code");--> statement-breakpoint
CREATE UNIQUE INDEX "health_premium_grain" ON "health_premiums" USING btree ("dataset_id","model_id","region_key","age_group","age_subgroup","accident","deductible");--> statement-breakpoint
CREATE INDEX "health_premium_compare" ON "health_premiums" USING btree ("dataset_id","age_group","age_subgroup","accident","deductible","region_key","monthly_premium_minor");--> statement-breakpoint
CREATE UNIQUE INDEX "health_region_key" ON "health_regions" USING btree ("dataset_id","region_id");
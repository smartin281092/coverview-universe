CREATE TABLE "partner_shared_modes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"revision" integer NOT NULL,
	"professional_revision" integer NOT NULL,
	"declared_name" text NOT NULL,
	"declared_organization" text NOT NULL,
	"categories" text[] NOT NULL,
	"action" text NOT NULL,
	"modes" text[] NOT NULL,
	"audience" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_shared_modes_scope" CHECK ("partner_shared_modes"."revision">0 and "partner_shared_modes"."professional_revision">0 and length(trim("partner_shared_modes"."declared_name")) between 2 and 160 and length(trim("partner_shared_modes"."declared_organization")) between 2 and 160),
	CONSTRAINT "partner_shared_modes_values" CHECK (cardinality("partner_shared_modes"."modes")<=4 and array_position("partner_shared_modes"."modes",null) is null and "partner_shared_modes"."modes"<@array['phone','video','office','home']::text[] and (("partner_shared_modes"."action"='publish' and cardinality("partner_shared_modes"."modes")>0) or ("partner_shared_modes"."action"='withdraw' and cardinality("partner_shared_modes"."modes")=0))),
	CONSTRAINT "partner_shared_modes_audience" CHECK ("partner_shared_modes"."audience"='confirmed-referent-leads-v1'),
	CONSTRAINT "partner_shared_modes_categories" CHECK (cardinality("partner_shared_modes"."categories") between 1 and 7 and array_position("partner_shared_modes"."categories",null) is null and "partner_shared_modes"."categories"<@array['health', 'vehicle', 'pension', 'household', 'legal', 'business', 'other']::text[])
);
--> statement-breakpoint
ALTER TABLE "partner_shared_modes" ADD CONSTRAINT "partner_shared_modes_user_id_partner_members_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."partner_members"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_shared_modes" ADD CONSTRAINT "partner_shared_modes_organization_id_partner_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."partner_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "partner_shared_modes_revision" ON "partner_shared_modes" USING btree ("user_id","revision");
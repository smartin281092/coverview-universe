CREATE TABLE "partner_capacity_declarations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"revision" integer NOT NULL,
	"professional_revision" integer NOT NULL,
	"declared_name" text NOT NULL,
	"declared_organization" text NOT NULL,
	"categories" text[] NOT NULL,
	"action" text NOT NULL,
	"position" text,
	"valid_until" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_capacity_declarations_scope" CHECK ("partner_capacity_declarations"."revision">0 and "partner_capacity_declarations"."professional_revision">0 and length(trim("partner_capacity_declarations"."declared_name")) between 2 and 160 and length(trim("partner_capacity_declarations"."declared_organization")) between 2 and 160),
	CONSTRAINT "partner_capacity_declarations_values" CHECK (coalesce(("partner_capacity_declarations"."action"='declare' and "partner_capacity_declarations"."position" in ('open','case_by_case','unavailable') and "partner_capacity_declarations"."valid_until">"partner_capacity_declarations"."created_at") or ("partner_capacity_declarations"."action"='withdraw' and "partner_capacity_declarations"."position" is null and "partner_capacity_declarations"."valid_until" is null),false)),
	CONSTRAINT "partner_capacity_declarations_categories" CHECK (cardinality("partner_capacity_declarations"."categories") between 1 and 7 and array_position("partner_capacity_declarations"."categories",null) is null and "partner_capacity_declarations"."categories"<@array['health', 'vehicle', 'pension', 'household', 'legal', 'business', 'other']::text[])
);
--> statement-breakpoint
ALTER TABLE "partner_capacity_declarations" ADD CONSTRAINT "partner_capacity_declarations_user_id_partner_members_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."partner_members"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_capacity_declarations" ADD CONSTRAINT "partner_capacity_declarations_organization_id_partner_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."partner_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "partner_capacity_declarations_revision" ON "partner_capacity_declarations" USING btree ("user_id","revision");
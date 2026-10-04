CREATE TABLE "partner_availability_declarations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"revision" integer NOT NULL,
	"professional_revision" integer NOT NULL,
	"declared_name" text NOT NULL,
	"declared_organization" text NOT NULL,
	"modes" text[] NOT NULL,
	"timezone" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_availability_scope" CHECK ("partner_availability_declarations"."revision">0 and "partner_availability_declarations"."professional_revision">0 and length(trim("partner_availability_declarations"."declared_name")) between 2 and 160 and length(trim("partner_availability_declarations"."declared_organization")) between 2 and 160),
	CONSTRAINT "partner_availability_modes" CHECK (cardinality("partner_availability_declarations"."modes")<=4 and array_position("partner_availability_declarations"."modes",null) is null and "partner_availability_declarations"."modes"<@array['phone','video','office','home']::text[]),
	CONSTRAINT "partner_availability_timezone" CHECK ("partner_availability_declarations"."timezone"='Europe/Zurich')
);
--> statement-breakpoint
CREATE TABLE "partner_availability_periods" (
	"declaration_id" text NOT NULL,
	"position" integer NOT NULL,
	"kind" text NOT NULL,
	"starts_at" timestamp (3) with time zone NOT NULL,
	"ends_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "partner_availability_period_bounds" CHECK ("partner_availability_periods"."position">=0 and "partner_availability_periods"."position"<60 and "partner_availability_periods"."ends_at">"partner_availability_periods"."starts_at" and "partner_availability_periods"."ends_at"-"partner_availability_periods"."starts_at"<=interval '366 days'),
	CONSTRAINT "partner_availability_period_kind" CHECK ("partner_availability_periods"."kind" in ('available','absent'))
);
--> statement-breakpoint
ALTER TABLE "partner_availability_declarations" ADD CONSTRAINT "partner_availability_declarations_user_id_partner_members_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."partner_members"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_availability_declarations" ADD CONSTRAINT "partner_availability_declarations_organization_id_partner_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."partner_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_availability_periods" ADD CONSTRAINT "partner_availability_periods_declaration_id_partner_availability_declarations_id_fk" FOREIGN KEY ("declaration_id") REFERENCES "public"."partner_availability_declarations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "partner_availability_revision" ON "partner_availability_declarations" USING btree ("user_id","revision");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_availability_period_position" ON "partner_availability_periods" USING btree ("declaration_id","position");
CREATE TABLE "partner_distribution_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"offer_id" text NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"company_id" text NOT NULL,
	"subject_key" text NOT NULL,
	"revision" integer NOT NULL,
	"scope_fingerprint" text NOT NULL,
	"scope" jsonb NOT NULL,
	"clauses_revision" integer NOT NULL,
	"binding_revision" integer NOT NULL,
	"convention_reference" jsonb,
	"action" text NOT NULL,
	"review" jsonb,
	"reason" text NOT NULL,
	"valid_until" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_distribution_reviews_revision_positive" CHECK ("partner_distribution_reviews"."revision">0 and "partner_distribution_reviews"."binding_revision">=0 and "partner_distribution_reviews"."clauses_revision">=0),
	CONSTRAINT "partner_distribution_reviews_fingerprint" CHECK ("partner_distribution_reviews"."scope_fingerprint" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "partner_distribution_reviews_reason" CHECK (length(trim("partner_distribution_reviews"."reason")) between 10 and 1000),
	CONSTRAINT "partner_distribution_reviews_scope" CHECK (jsonb_typeof("partner_distribution_reviews"."scope")='object'),
	CONSTRAINT "partner_distribution_reviews_company" CHECK ("partner_distribution_reviews"."company_id" in ('allianz','assura','automate','axa','baloise','css','generali','groupe-mutuel','helsana','liechtenstein-life','tsm')),
	CONSTRAINT "partner_distribution_reviews_values" CHECK (coalesce(
      ("partner_distribution_reviews"."action"='record' and "partner_distribution_reviews"."valid_until">"partner_distribution_reviews"."created_at" and "partner_distribution_reviews"."binding_revision">0 and "partner_distribution_reviews"."clauses_revision">0
       and jsonb_typeof("partner_distribution_reviews"."convention_reference")='object' and jsonb_typeof("partner_distribution_reviews"."review")='object'
       and "partner_distribution_reviews"."review"->>'position' in ('undetermined','needs_information','cannot_proceed')
       and jsonb_typeof("partner_distribution_reviews"."review"->'aspects')='array' and jsonb_array_length("partner_distribution_reviews"."review"->'aspects') between 1 and 6
       and ("partner_distribution_reviews"."review"->'aspects') <@ '["parties","distribution","product","limitations","exclusions","dates"]'::jsonb
       and length(trim("partner_distribution_reviews"."review"->>'examinedScope')) between 10 and 500
       and length(trim("partner_distribution_reviews"."review"->>'limitations')) between 10 and 1000
       and length(trim("partner_distribution_reviews"."review"->>'nextStep')) between 10 and 1000)
      or ("partner_distribution_reviews"."action"='withdraw' and "partner_distribution_reviews"."review" is null and "partner_distribution_reviews"."valid_until" is null),false))
);
--> statement-breakpoint
ALTER TABLE "partner_distribution_reviews" ADD CONSTRAINT "partner_distribution_reviews_user_id_identity_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_distribution_reviews" ADD CONSTRAINT "partner_distribution_reviews_organization_id_partner_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."partner_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_distribution_reviews" ADD CONSTRAINT "partner_distribution_reviews_lead_id_offer_id_partner_offers_lead_id_id_fk" FOREIGN KEY ("lead_id","offer_id") REFERENCES "public"."partner_offers"("lead_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "partner_distribution_reviews_revision" ON "partner_distribution_reviews" USING btree ("user_id","offer_id","company_id","revision");--> statement-breakpoint
CREATE INDEX "partner_distribution_reviews_subject" ON "partner_distribution_reviews" USING btree ("user_id","offer_id","company_id","subject_key","revision");
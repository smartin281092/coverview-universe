CREATE TABLE "partner_solution_clauses" (
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
	"binding_revision" integer NOT NULL,
	"convention_reference" jsonb,
	"action" text NOT NULL,
	"clauses" jsonb,
	"reason" text NOT NULL,
	"valid_until" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_solution_clauses_revision_positive" CHECK ("partner_solution_clauses"."revision">0 and "partner_solution_clauses"."binding_revision">=0),
	CONSTRAINT "partner_solution_clauses_fingerprint" CHECK ("partner_solution_clauses"."scope_fingerprint" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "partner_solution_clauses_reason" CHECK (length(trim("partner_solution_clauses"."reason")) between 10 and 1000),
	CONSTRAINT "partner_solution_clauses_scope" CHECK (jsonb_typeof("partner_solution_clauses"."scope")='object'),
	CONSTRAINT "partner_solution_clauses_company" CHECK ("partner_solution_clauses"."company_id" in ('allianz','assura','automate','axa','baloise','css','generali','groupe-mutuel','helsana','liechtenstein-life','tsm')),
	CONSTRAINT "partner_solution_clauses_values" CHECK (coalesce(
      ("partner_solution_clauses"."action"='record' and "partner_solution_clauses"."valid_until">"partner_solution_clauses"."created_at" and "partner_solution_clauses"."binding_revision">0
       and jsonb_typeof("partner_solution_clauses"."convention_reference")='object' and jsonb_typeof("partner_solution_clauses"."clauses")='object'
       and "partner_solution_clauses"."clauses" ?& array['parties','distribution','product','limitations','exclusions','dates']
       and jsonb_strip_nulls("partner_solution_clauses"."clauses") <> '{}'::jsonb)
      or ("partner_solution_clauses"."action"='withdraw' and "partner_solution_clauses"."clauses" is null and "partner_solution_clauses"."valid_until" is null),false))
);
--> statement-breakpoint
ALTER TABLE "partner_solution_clauses" ADD CONSTRAINT "partner_solution_clauses_user_id_identity_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_solution_clauses" ADD CONSTRAINT "partner_solution_clauses_organization_id_partner_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."partner_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_solution_clauses" ADD CONSTRAINT "partner_solution_clauses_lead_id_offer_id_partner_offers_lead_id_id_fk" FOREIGN KEY ("lead_id","offer_id") REFERENCES "public"."partner_offers"("lead_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "partner_solution_clauses_revision" ON "partner_solution_clauses" USING btree ("user_id","offer_id","company_id","revision");--> statement-breakpoint
CREATE INDEX "partner_solution_clauses_subject" ON "partner_solution_clauses" USING btree ("user_id","offer_id","company_id","subject_key","revision");
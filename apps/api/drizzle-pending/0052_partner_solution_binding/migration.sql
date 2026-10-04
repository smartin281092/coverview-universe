CREATE TABLE "partner_solution_bindings" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"offer_id" text NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"subject_key" text NOT NULL,
	"revision" integer NOT NULL,
	"scope_fingerprint" text NOT NULL,
	"scope" jsonb NOT NULL,
	"source_reference" jsonb,
	"action" text NOT NULL,
	"company_id" text,
	"mentions" jsonb,
	"reason" text NOT NULL,
	"valid_until" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_solution_binding_revision_positive" CHECK ("partner_solution_bindings"."revision">0),
	CONSTRAINT "partner_solution_binding_fingerprint" CHECK ("partner_solution_bindings"."scope_fingerprint" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "partner_solution_binding_reason" CHECK (length(trim("partner_solution_bindings"."reason")) between 10 and 1000),
	CONSTRAINT "partner_solution_binding_scope" CHECK (jsonb_typeof("partner_solution_bindings"."scope")='object'),
	CONSTRAINT "partner_solution_binding_company" CHECK ("partner_solution_bindings"."company_id" is null or "partner_solution_bindings"."company_id" in ('allianz','assura','automate','axa','baloise','css','generali','groupe-mutuel','helsana','liechtenstein-life','tsm')),
	CONSTRAINT "partner_solution_binding_values" CHECK (coalesce(
      ("partner_solution_bindings"."action"='record' and "partner_solution_bindings"."valid_until">"partner_solution_bindings"."created_at"
       and jsonb_typeof("partner_solution_bindings"."source_reference")='object' and jsonb_typeof("partner_solution_bindings"."mentions")='object'
       and "partner_solution_bindings"."mentions" ?& array['company','legalParty','product','variant','productVersion']
       and ("partner_solution_bindings"."company_id" is null or jsonb_typeof("partner_solution_bindings"."mentions"->'company')='object'))
      or ("partner_solution_bindings"."action"='withdraw' and "partner_solution_bindings"."company_id" is null and "partner_solution_bindings"."mentions" is null and "partner_solution_bindings"."valid_until" is null),false))
);
--> statement-breakpoint
ALTER TABLE "partner_solution_bindings" ADD CONSTRAINT "partner_solution_bindings_user_id_identity_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_solution_bindings" ADD CONSTRAINT "partner_solution_bindings_organization_id_partner_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."partner_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_solution_bindings" ADD CONSTRAINT "partner_solution_bindings_lead_id_offer_id_partner_offers_lead_id_id_fk" FOREIGN KEY ("lead_id","offer_id") REFERENCES "public"."partner_offers"("lead_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "partner_solution_binding_revision" ON "partner_solution_bindings" USING btree ("user_id","offer_id","revision");--> statement-breakpoint
CREATE INDEX "partner_solution_binding_subject" ON "partner_solution_bindings" USING btree ("user_id","offer_id","subject_key","revision");
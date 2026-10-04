CREATE TABLE "partner_insurance_sources" (
	"lead_id" text PRIMARY KEY NOT NULL,
	"request_id" text NOT NULL,
	"person_id" text NOT NULL,
	"profile_id" text NOT NULL,
	"consent_user_id" text NOT NULL,
	"consent_version" text NOT NULL,
	"request_revision" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_insurance_source_consent" CHECK ("partner_insurance_sources"."consent_version" = 'insurance-partner-v1' and "partner_insurance_sources"."request_revision" >= 0),
	CONSTRAINT "partner_insurance_source_snapshot" CHECK (coalesce("partner_insurance_sources"."snapshot"->>'id'="partner_insurance_sources"."person_id" and "partner_insurance_sources"."snapshot"->>'profileId'="partner_insurance_sources"."profile_id", false))
);
--> statement-breakpoint
ALTER TABLE "partner_insurance_sources" ADD CONSTRAINT "partner_insurance_sources_lead_id_partner_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."partner_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_insurance_sources" ADD CONSTRAINT "partner_insurance_sources_request_id_insurance_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."insurance_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_insurance_sources" ADD CONSTRAINT "partner_insurance_sources_profile_id_managed_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."managed_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_insurance_sources" ADD CONSTRAINT "partner_insurance_sources_consent_user_id_identity_users_id_fk" FOREIGN KEY ("consent_user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "partner_insurance_source_person" ON "partner_insurance_sources" USING btree ("request_id","person_id");
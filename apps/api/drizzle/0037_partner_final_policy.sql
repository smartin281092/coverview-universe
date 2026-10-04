CREATE TABLE "partner_final_policies" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"offer_id" text NOT NULL,
	"document_id" text NOT NULL,
	"fingerprint" text NOT NULL,
	"source_snapshot" jsonb NOT NULL,
	"confirmed_by" text NOT NULL,
	"consent_version" text DEFAULT 'final-policy-v1' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"withdrawn_at" timestamp (3) with time zone,
	CONSTRAINT "partner_final_policy_fingerprint" CHECK ("partner_final_policies"."fingerprint" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "partner_final_policy_withdrawal" CHECK (("partner_final_policies"."active" and "partner_final_policies"."withdrawn_at" is null) or (not "partner_final_policies"."active" and "partner_final_policies"."withdrawn_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "partner_final_policy_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"policy_id" text NOT NULL,
	"version" integer NOT NULL,
	"checks" jsonb NOT NULL,
	"reviewed_by" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_final_policy_review_positive" CHECK ("partner_final_policy_reviews"."version">0)
);
--> statement-breakpoint
ALTER TABLE "partner_final_policies" ADD CONSTRAINT "partner_final_policies_lead_id_partner_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."partner_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_final_policies" ADD CONSTRAINT "partner_final_policies_document_id_files_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_final_policies" ADD CONSTRAINT "partner_final_policies_confirmed_by_identity_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "partner_offer_lead_id" ON "partner_offers" USING btree ("lead_id","id");--> statement-breakpoint
ALTER TABLE "partner_final_policies" ADD CONSTRAINT "partner_final_policies_lead_id_offer_id_partner_offers_lead_id_id_fk" FOREIGN KEY ("lead_id","offer_id") REFERENCES "public"."partner_offers"("lead_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_final_policy_reviews" ADD CONSTRAINT "partner_final_policy_reviews_policy_id_partner_final_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."partner_final_policies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_final_policy_reviews" ADD CONSTRAINT "partner_final_policy_reviews_reviewed_by_identity_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "partner_final_policy_offer_active" ON "partner_final_policies" USING btree ("offer_id") WHERE "partner_final_policies"."active";--> statement-breakpoint
CREATE UNIQUE INDEX "partner_final_policy_document_active" ON "partner_final_policies" USING btree ("document_id") WHERE "partner_final_policies"."active";--> statement-breakpoint
CREATE INDEX "partner_final_policy_history" ON "partner_final_policies" USING btree ("lead_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_final_policy_review_version" ON "partner_final_policy_reviews" USING btree ("policy_id","version");

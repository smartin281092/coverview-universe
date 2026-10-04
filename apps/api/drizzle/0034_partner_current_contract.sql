CREATE TABLE "partner_contract_references" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"document_id" text NOT NULL,
	"fingerprint" text NOT NULL,
	"confirmed_by" text NOT NULL,
	"consent_version" integer DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_contract_fingerprint" CHECK ("partner_contract_references"."fingerprint" ~ '^[a-f0-9]{64}$' and "partner_contract_references"."consent_version"=1)
);
--> statement-breakpoint
CREATE TABLE "partner_contract_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"reference_id" text NOT NULL,
	"version" integer NOT NULL,
	"premium_verified" boolean NOT NULL,
	"features" jsonb NOT NULL,
	"reviewed_by" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_contract_review_bounds" CHECK ("partner_contract_reviews"."version">0 and jsonb_typeof("partner_contract_reviews"."features")='array' and jsonb_array_length("partner_contract_reviews"."features")<=80)
);
--> statement-breakpoint
ALTER TABLE "partner_contract_references" ADD CONSTRAINT "partner_contract_references_lead_id_partner_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."partner_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_contract_references" ADD CONSTRAINT "partner_contract_references_document_id_files_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_contract_references" ADD CONSTRAINT "partner_contract_references_confirmed_by_identity_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_contract_reviews" ADD CONSTRAINT "partner_contract_reviews_reference_id_partner_contract_references_id_fk" FOREIGN KEY ("reference_id") REFERENCES "public"."partner_contract_references"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_contract_reviews" ADD CONSTRAINT "partner_contract_reviews_reviewed_by_identity_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "partner_contract_active" ON "partner_contract_references" USING btree ("lead_id") WHERE "partner_contract_references"."active";--> statement-breakpoint
CREATE UNIQUE INDEX "partner_contract_review_version" ON "partner_contract_reviews" USING btree ("reference_id","version");
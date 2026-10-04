CREATE TABLE "partner_need_expertise_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"subject_key" text NOT NULL,
	"revision" integer NOT NULL,
	"scope_fingerprint" text NOT NULL,
	"scope" jsonb NOT NULL,
	"basis" jsonb NOT NULL,
	"action" text NOT NULL,
	"position" text,
	"reviewed_scope" text,
	"limitations" text,
	"next_step" text,
	"reason" text NOT NULL,
	"valid_until" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_need_expertise_revision_positive" CHECK ("partner_need_expertise_reviews"."revision">0),
	CONSTRAINT "partner_need_expertise_fingerprint" CHECK ("partner_need_expertise_reviews"."scope_fingerprint" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "partner_need_expertise_reason" CHECK (length(trim("partner_need_expertise_reviews"."reason")) between 10 and 1000),
	CONSTRAINT "partner_need_expertise_json" CHECK (jsonb_typeof("partner_need_expertise_reviews"."scope")='object' and jsonb_typeof("partner_need_expertise_reviews"."basis")='object'),
	CONSTRAINT "partner_need_expertise_values" CHECK (coalesce(("partner_need_expertise_reviews"."action"='decide' and "partner_need_expertise_reviews"."position" in ('expertise_confirmed_within_scope','specialist_required','clarification_needed') and length(trim("partner_need_expertise_reviews"."reviewed_scope")) between 10 and 500 and length(trim("partner_need_expertise_reviews"."limitations")) between 10 and 1000 and length(trim("partner_need_expertise_reviews"."next_step")) between 10 and 1000 and "partner_need_expertise_reviews"."valid_until">"partner_need_expertise_reviews"."created_at") or ("partner_need_expertise_reviews"."action"='withdraw' and "partner_need_expertise_reviews"."position" is null and "partner_need_expertise_reviews"."valid_until" is null and "partner_need_expertise_reviews"."reviewed_scope" is null and "partner_need_expertise_reviews"."limitations" is null and "partner_need_expertise_reviews"."next_step" is null),false))
);
--> statement-breakpoint
ALTER TABLE "partner_need_expertise_reviews" ADD CONSTRAINT "partner_need_expertise_reviews_lead_id_partner_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."partner_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_need_expertise_reviews" ADD CONSTRAINT "partner_need_expertise_reviews_user_id_identity_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_need_expertise_reviews" ADD CONSTRAINT "partner_need_expertise_reviews_organization_id_partner_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."partner_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "partner_need_expertise_revision" ON "partner_need_expertise_reviews" USING btree ("user_id","lead_id","revision");--> statement-breakpoint
CREATE INDEX "partner_need_expertise_subject" ON "partner_need_expertise_reviews" USING btree ("user_id","lead_id","subject_key","revision");
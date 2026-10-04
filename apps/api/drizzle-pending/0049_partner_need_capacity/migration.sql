CREATE TABLE "partner_need_capacity_decisions" (
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
	"reason" text NOT NULL,
	"valid_until" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_need_capacity_revision_positive" CHECK ("partner_need_capacity_decisions"."revision">0),
	CONSTRAINT "partner_need_capacity_fingerprint" CHECK ("partner_need_capacity_decisions"."scope_fingerprint" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "partner_need_capacity_reason" CHECK (length(trim("partner_need_capacity_decisions"."reason")) between 10 and 1000),
	CONSTRAINT "partner_need_capacity_json" CHECK (jsonb_typeof("partner_need_capacity_decisions"."scope")='object' and jsonb_typeof("partner_need_capacity_decisions"."basis")='object'),
	CONSTRAINT "partner_need_capacity_values" CHECK (coalesce(("partner_need_capacity_decisions"."action"='decide' and "partner_need_capacity_decisions"."position" in ('capacity_confirmed','capacity_insufficient','clarification_needed') and "partner_need_capacity_decisions"."valid_until">"partner_need_capacity_decisions"."created_at") or ("partner_need_capacity_decisions"."action"='withdraw' and "partner_need_capacity_decisions"."position" is null and "partner_need_capacity_decisions"."valid_until" is null),false))
);
--> statement-breakpoint
ALTER TABLE "partner_need_capacity_decisions" ADD CONSTRAINT "partner_need_capacity_decisions_lead_id_partner_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."partner_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_need_capacity_decisions" ADD CONSTRAINT "partner_need_capacity_decisions_user_id_identity_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_need_capacity_decisions" ADD CONSTRAINT "partner_need_capacity_decisions_organization_id_partner_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."partner_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "partner_need_capacity_revision" ON "partner_need_capacity_decisions" USING btree ("user_id","lead_id","revision");--> statement-breakpoint
CREATE INDEX "partner_need_capacity_subject" ON "partner_need_capacity_decisions" USING btree ("user_id","lead_id","subject_key","revision");
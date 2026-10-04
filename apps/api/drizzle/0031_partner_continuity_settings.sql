CREATE TABLE "partner_continuity_policies" (
	"revision" integer PRIMARY KEY NOT NULL,
	"policy" jsonb NOT NULL,
	"changed_by" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_continuity_policy_revision" CHECK ("partner_continuity_policies"."revision" > 0),
	CONSTRAINT "partner_continuity_policy_shape" CHECK (coalesce(jsonb_typeof("partner_continuity_policies"."policy") = 'object' and jsonb_typeof("partner_continuity_policies"."policy"->'acceptanceHours') = 'number' and ("partner_continuity_policies"."policy"->>'acceptanceHours')::int between 1 and 24 and jsonb_typeof("partner_continuity_policies"."policy"->'calendar') = 'object', false))
);
--> statement-breakpoint
ALTER TABLE "partner_leads" ADD COLUMN "first_action_due_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "partner_leads" ADD COLUMN "acceptance_due_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "partner_leads" ADD COLUMN "continuity_policy_revision" integer;--> statement-breakpoint
ALTER TABLE "partner_continuity_policies" ADD CONSTRAINT "partner_continuity_policies_changed_by_identity_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_leads" ADD CONSTRAINT "partner_leads_continuity_policy_revision_partner_continuity_policies_revision_fk" FOREIGN KEY ("continuity_policy_revision") REFERENCES "public"."partner_continuity_policies"("revision") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_leads" ADD CONSTRAINT "partner_lead_deadlines" CHECK (("partner_leads"."acceptance_due_at" is null and "partner_leads"."first_action_due_at" is null) or ("partner_leads"."acceptance_due_at" is not null and "partner_leads"."first_action_due_at" is not null and "partner_leads"."acceptance_due_at" <= "partner_leads"."first_action_due_at"));
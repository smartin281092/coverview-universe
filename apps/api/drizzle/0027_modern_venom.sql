CREATE TABLE "partner_appointments" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"advisor_id" text NOT NULL,
	"starts_at" timestamp (3) with time zone NOT NULL,
	"duration_minutes" integer NOT NULL,
	"mode" text NOT NULL,
	"location" text NOT NULL,
	"timezone" text NOT NULL,
	"state" text DEFAULT 'scheduled' NOT NULL,
	CONSTRAINT "partner_appointment_duration" CHECK ("partner_appointments"."duration_minutes" between 15 and 240),
	CONSTRAINT "partner_appointment_state" CHECK ("partner_appointments"."state" in ('scheduled','completed','cancelled','client_absent','advisor_absent'))
);
--> statement-breakpoint
CREATE TABLE "partner_commands" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"key" text NOT NULL,
	"operation" text NOT NULL,
	"hash" text NOT NULL,
	"target_id" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partner_contributors" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"user_id" text NOT NULL,
	"can_edit" boolean DEFAULT false NOT NULL,
	"revoked_at" timestamp (3) with time zone
);
--> statement-breakpoint
CREATE TABLE "partner_events" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text,
	"actor_id" text NOT NULL,
	"subject_id" text,
	"kind" text NOT NULL,
	"audience" text NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_event_audience" CHECK ("partner_events"."audience" in ('private','assigned','client','coverview'))
);
--> statement-breakpoint
CREATE TABLE "partner_leads" (
	"id" text PRIMARY KEY NOT NULL,
	"creator_id" text NOT NULL,
	"responsible_id" text,
	"client_user_id" text,
	"client_profile_id" text,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"object" text NOT NULL,
	"client_name" text NOT NULL,
	"details" jsonb NOT NULL,
	"stage" text DEFAULT 'new' NOT NULL,
	"assignment" text DEFAULT 'unassigned' NOT NULL,
	"priority" text NOT NULL,
	"next_action" text NOT NULL,
	"due_at" timestamp (3) with time zone,
	"waiting" jsonb,
	"result" text,
	"reason" text,
	"estimated_commission_minor" integer,
	"revision" integer DEFAULT 0 NOT NULL,
	"notified_at" timestamp (3) with time zone,
	"first_useful_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"stage_changed_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_lead_bounds" CHECK ("partner_leads"."revision" >= 0 and ("partner_leads"."estimated_commission_minor" is null or "partner_leads"."estimated_commission_minor" >= 0)),
	CONSTRAINT "partner_lead_stage" CHECK ("partner_leads"."stage" in ('draft','new','qualifying','ready_to_assign','to_contact','contacted','appointment_needed','appointment_scheduled','appointment_completed','analysis','offer_requested','offer_received','offer_presented','client_decision','signing','signed','awaiting_insurer','contract_issued','completed')),
	CONSTRAINT "partner_lead_assignment" CHECK ("partner_leads"."assignment" in ('unassigned','proposed','accepted','marketplace','reassign','coverview')),
	CONSTRAINT "partner_lead_priority" CHECK ("partner_leads"."priority" in ('normal','high','urgent')),
	CONSTRAINT "partner_lead_closure" CHECK (("partner_leads"."stage" = 'completed') = ("partner_leads"."result" is not null and "partner_leads"."reason" is not null)),
	CONSTRAINT "partner_lead_profile" CHECK ("partner_leads"."client_profile_id" is null or "partner_leads"."client_user_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "partner_members" (
	"user_id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"state" text DEFAULT 'submitted' NOT NULL,
	"application" jsonb NOT NULL,
	"roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"reviewed_by" text,
	"review_reason" text,
	"reviewed_at" timestamp (3) with time zone,
	"review_due_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_member_state" CHECK ("partner_members"."state" in ('draft','submitted','needs_information','approved','rejected','suspended','closed')),
	CONSTRAINT "partner_member_revision" CHECK ("partner_members"."revision" >= 0)
);
--> statement-breakpoint
CREATE TABLE "partner_offers" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"document_id" text NOT NULL,
	"data" jsonb NOT NULL,
	"version" integer NOT NULL,
	"family_id" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"state" text DEFAULT 'to_verify' NOT NULL,
	"reviewed_at" timestamp (3) with time zone,
	"published_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_offer_state" CHECK ("partner_offers"."state" in ('received','to_verify','ready','published','viewed','selected','refused','expired','replaced','to_sign','signed','cancelled'))
);
--> statement-breakpoint
CREATE TABLE "partner_organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"state" text DEFAULT 'submitted' NOT NULL,
	"reviewed_by" text,
	"review_reason" text,
	"reviewed_at" timestamp (3) with time zone,
	CONSTRAINT "partner_org_state" CHECK ("partner_organizations"."state" in ('draft','submitted','needs_information','approved','rejected','suspended','closed'))
);
--> statement-breakpoint
CREATE TABLE "partner_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"responsible_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"due_at" timestamp (3) with time zone NOT NULL,
	"priority" text NOT NULL,
	"reminder_at" timestamp (3) with time zone,
	"state" text DEFAULT 'open' NOT NULL,
	"completed_at" timestamp (3) with time zone,
	CONSTRAINT "partner_task_state" CHECK ("partner_tasks"."state" in ('open','done','cancelled'))
);
--> statement-breakpoint
ALTER TABLE "identity_logins" DROP CONSTRAINT "identity_logins_surface";--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "purpose" text;--> statement-breakpoint
ALTER TABLE "partner_appointments" ADD CONSTRAINT "partner_appointments_lead_id_partner_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."partner_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_appointments" ADD CONSTRAINT "partner_appointments_advisor_id_identity_users_id_fk" FOREIGN KEY ("advisor_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_commands" ADD CONSTRAINT "partner_commands_user_id_identity_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_contributors" ADD CONSTRAINT "partner_contributors_lead_id_partner_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."partner_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_contributors" ADD CONSTRAINT "partner_contributors_user_id_identity_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_events" ADD CONSTRAINT "partner_events_lead_id_partner_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."partner_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_events" ADD CONSTRAINT "partner_events_actor_id_identity_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_leads" ADD CONSTRAINT "partner_leads_creator_id_identity_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_leads" ADD CONSTRAINT "partner_leads_responsible_id_identity_users_id_fk" FOREIGN KEY ("responsible_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_leads" ADD CONSTRAINT "partner_leads_client_user_id_identity_users_id_fk" FOREIGN KEY ("client_user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_leads" ADD CONSTRAINT "partner_leads_client_profile_id_managed_profiles_id_fk" FOREIGN KEY ("client_profile_id") REFERENCES "public"."managed_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_members" ADD CONSTRAINT "partner_members_user_id_identity_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_members" ADD CONSTRAINT "partner_members_organization_id_partner_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."partner_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_members" ADD CONSTRAINT "partner_members_reviewed_by_identity_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_offers" ADD CONSTRAINT "partner_offers_lead_id_partner_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."partner_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_organizations" ADD CONSTRAINT "partner_organizations_reviewed_by_identity_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_tasks" ADD CONSTRAINT "partner_tasks_lead_id_partner_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."partner_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_tasks" ADD CONSTRAINT "partner_tasks_responsible_id_identity_users_id_fk" FOREIGN KEY ("responsible_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "partner_appointment_lead" ON "partner_appointments" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "partner_appointment_advisor" ON "partner_appointments" USING btree ("advisor_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_command_key" ON "partner_commands" USING btree ("user_id","key");--> statement-breakpoint
CREATE INDEX "partner_command_expiry" ON "partner_commands" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_contributor_active" ON "partner_contributors" USING btree ("lead_id","user_id") WHERE "partner_contributors"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "partner_event_lead" ON "partner_events" USING btree ("lead_id","created_at","id");--> statement-breakpoint
CREATE INDEX "partner_leads_assignee" ON "partner_leads" USING btree ("responsible_id","created_at","id");--> statement-breakpoint
CREATE INDEX "partner_leads_creator" ON "partner_leads" USING btree ("creator_id","created_at","id");--> statement-breakpoint
CREATE INDEX "partner_leads_client" ON "partner_leads" USING btree ("client_user_id","client_profile_id");--> statement-breakpoint
CREATE INDEX "partner_leads_profile" ON "partner_leads" USING btree ("client_profile_id");--> statement-breakpoint
CREATE INDEX "partner_members_org" ON "partner_members" USING btree ("organization_id","state");--> statement-breakpoint
CREATE INDEX "partner_offer_lead" ON "partner_offers" USING btree ("lead_id");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_offer_version" ON "partner_offers" USING btree ("family_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_offer_active" ON "partner_offers" USING btree ("family_id") WHERE "partner_offers"."active";--> statement-breakpoint
CREATE INDEX "partner_tasks_lead" ON "partner_tasks" USING btree ("lead_id","state");--> statement-breakpoint
CREATE INDEX "partner_tasks_assignee" ON "partner_tasks" USING btree ("responsible_id","due_at");--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_purpose" CHECK ("files"."purpose" is null or "files"."purpose" in ('identity_card','lead_offer'));--> statement-breakpoint
ALTER TABLE "identity_logins" ADD CONSTRAINT "identity_logins_surface" CHECK ("identity_logins"."surface" in ('client', 'admin', 'www', 'partners'));
CREATE TABLE "admin_profile_transfers" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"source_user_id" text NOT NULL,
	"destination_user_id" text NOT NULL,
	"administrator_user_id" text NOT NULL,
	"session_id" text NOT NULL,
	"command_key" text NOT NULL,
	"request_hash" text NOT NULL,
	"revision" integer NOT NULL,
	"authorization_policy" text DEFAULT 'revoke_previous_signatures' NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_profile_transfers_bounds" CHECK ("admin_profile_transfers"."source_user_id" <> "admin_profile_transfers"."destination_user_id" and "admin_profile_transfers"."revision" > 0 and "admin_profile_transfers"."request_hash" ~ '^[0-9a-f]{64}$' and "admin_profile_transfers"."authorization_policy" = 'revoke_previous_signatures')
);
--> statement-breakpoint
CREATE TABLE "client_activities" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"managed_profile_id" text,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"state" text NOT NULL,
	"starts_at" timestamp (3) with time zone,
	"ends_at" timestamp (3) with time zone,
	"timezone" text NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_activities_kind" CHECK ("client_activities"."kind" in ('task','note','event','appointment')),
	CONSTRAINT "client_activities_state" CHECK ("client_activities"."state" in ('open','completed','cancelled')),
	CONSTRAINT "client_activities_bounds" CHECK ("client_activities"."revision" >= 0 and length("client_activities"."title") between 1 and 200 and length("client_activities"."description") <= 8000 and length("client_activities"."timezone") between 1 and 100),
	CONSTRAINT "client_activities_schedule" CHECK (("client_activities"."kind" not in ('event','appointment') or "client_activities"."starts_at" is not null) and ("client_activities"."ends_at" is null or ("client_activities"."starts_at" is not null and "client_activities"."ends_at" >= "client_activities"."starts_at")))
);
--> statement-breakpoint
CREATE TABLE "client_activity_audit" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"profile_id" text NOT NULL,
	"activity_id" text NOT NULL,
	"administrator_user_id" text NOT NULL,
	"session_id" text NOT NULL,
	"action" text NOT NULL,
	"revision" integer NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_activity_commands" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"profile_id" text NOT NULL,
	"key" text NOT NULL,
	"request_hash" text NOT NULL,
	"activity_id" text NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_profile_transfers" ADD CONSTRAINT "admin_profile_transfers_source_user_id_identity_users_id_fk" FOREIGN KEY ("source_user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_profile_transfers" ADD CONSTRAINT "admin_profile_transfers_destination_user_id_identity_users_id_fk" FOREIGN KEY ("destination_user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_profile_transfers" ADD CONSTRAINT "admin_profile_transfers_administrator_user_id_identity_users_id_fk" FOREIGN KEY ("administrator_user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_activities" ADD CONSTRAINT "client_activities_user_id_identity_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_activities" ADD CONSTRAINT "client_activities_user_id_managed_profile_id_managed_profiles_user_id_id_fk" FOREIGN KEY ("user_id","managed_profile_id") REFERENCES "public"."managed_profiles"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_activity_audit" ADD CONSTRAINT "client_activity_audit_user_id_identity_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_activity_commands" ADD CONSTRAINT "client_activity_commands_user_id_identity_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "admin_profile_transfers_command" ON "admin_profile_transfers" USING btree ("administrator_user_id","command_key");--> statement-breakpoint
CREATE INDEX "client_activities_profile_list" ON "client_activities" USING btree ("user_id","managed_profile_id","id");--> statement-breakpoint
CREATE INDEX "client_activity_audit_owner" ON "client_activity_audit" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "client_activity_commands_key" ON "client_activity_commands" USING btree ("user_id","key");--> statement-breakpoint
CREATE INDEX "client_activity_commands_expiry" ON "client_activity_commands" USING btree ("expires_at");
--> statement-breakpoint
-- Ownership changes only inside the administrative transfer transaction. Existing writers
-- still check these FKs immediately; the transfer explicitly defers them until commit.
DO $$
DECLARE dossier_fk record;
BEGIN
  FOR dossier_fk IN
    SELECT conrelid::regclass AS relation, conname
    FROM pg_constraint
    WHERE contype = 'f' AND cardinality(conkey) > 1
      AND conrelid IN (
        'managed_profile_sections'::regclass, 'files'::regclass,
        'managed_document_identity_attachments'::regclass,
        'document_change_requests'::regclass, 'document_field_corrections'::regclass,
        'authorization_signatures'::regclass, 'company_service_requests'::regclass,
        'company_action_evidence'::regclass, 'company_action_audit'::regclass,
        'action_center_resolutions'::regclass, 'action_center_manual_reviews'::regclass,
        'client_activities'::regclass
      )
  LOOP
    EXECUTE format('ALTER TABLE %s ALTER CONSTRAINT %I DEFERRABLE INITIALLY IMMEDIATE', dossier_fk.relation, dossier_fk.conname);
  END LOOP;
END $$;

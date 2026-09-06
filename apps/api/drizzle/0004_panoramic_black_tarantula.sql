CREATE TABLE "profile_audit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"session_id" text,
	"profile_id" text,
	"draft_id" text,
	"command_id" text NOT NULL,
	"action" text NOT NULL,
	"revision" integer NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "profile_audit_events_command_id_unique" UNIQUE("command_id"),
	CONSTRAINT "profile_audit_actor" CHECK ("profile_audit_events"."user_id" is not null or "profile_audit_events"."draft_id" is not null),
	CONSTRAINT "profile_audit_session" CHECK ("profile_audit_events"."session_id" is null or "profile_audit_events"."user_id" is not null),
	CONSTRAINT "profile_audit_action" CHECK ("profile_audit_events"."action" in ('profile.saved.v1', 'profile.confirmed.v1', 'profile.draft_saved.v1', 'profile.draft_attached.v1')),
	CONSTRAINT "profile_audit_revision" CHECK ("profile_audit_events"."revision" >= 0)
);
--> statement-breakpoint
CREATE TABLE "profile_choices" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"profile_id" text NOT NULL,
	"session_id" text NOT NULL,
	"purpose" text NOT NULL,
	"version" text NOT NULL,
	"enabled" boolean NOT NULL,
	"decided_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "profile_choices_purpose" CHECK ("profile_choices"."purpose" = 'profile.prefill'),
	CONSTRAINT "profile_choices_version" CHECK ("profile_choices"."version" = '1')
);
--> statement-breakpoint
CREATE TABLE "profile_commands" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"draft_id" text,
	"endpoint" text NOT NULL,
	"key" text NOT NULL,
	"request_hash" text NOT NULL,
	"response_status" integer DEFAULT 200 NOT NULL,
	"response" jsonb NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "profile_commands_owner" CHECK (("profile_commands"."user_id" is null) <> ("profile_commands"."draft_id" is null)),
	CONSTRAINT "profile_commands_scope" CHECK (("profile_commands"."draft_id" is not null and "profile_commands"."endpoint" = 'save_draft') or ("profile_commands"."user_id" is not null and "profile_commands"."endpoint" in ('save', 'confirm', 'attach'))),
	CONSTRAINT "profile_commands_hash" CHECK ("profile_commands"."request_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "profile_commands_key" CHECK ("profile_commands"."key" ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'),
	CONSTRAINT "profile_commands_response" CHECK ("profile_commands"."response_status" = 200 and jsonb_typeof("profile_commands"."response") = 'object'),
	CONSTRAINT "profile_commands_expiration" CHECK ("profile_commands"."expires_at" > "profile_commands"."created_at")
);
--> statement-breakpoint
CREATE TABLE "profile_drafts" (
	"id" text PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"step" text DEFAULT 'information' NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL,
	"claimed_by" text,
	"claimed_at" timestamp (3) with time zone,
	CONSTRAINT "profile_drafts_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "profile_drafts_hash" CHECK ("profile_drafts"."token_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "profile_drafts_fields" CHECK (jsonb_typeof("profile_drafts"."fields") = 'object'),
	CONSTRAINT "profile_drafts_revision" CHECK ("profile_drafts"."revision" >= 0),
	CONSTRAINT "profile_drafts_step" CHECK ("profile_drafts"."step" in ('information', 'address', 'review')),
	CONSTRAINT "profile_drafts_expiration" CHECK ("profile_drafts"."expires_at" > "profile_drafts"."created_at"),
	CONSTRAINT "profile_drafts_claim" CHECK (("profile_drafts"."claimed_by" is null) = ("profile_drafts"."claimed_at" is null))
);
--> statement-breakpoint
ALTER TABLE "identity_logins" ADD COLUMN "continuation" text;--> statement-breakpoint
ALTER TABLE "identity_profiles" ADD COLUMN "fields" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "identity_profiles" ADD COLUMN "revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "identity_profiles" ADD COLUMN "step" text DEFAULT 'information' NOT NULL;--> statement-breakpoint
ALTER TABLE "identity_profiles" ADD COLUMN "prefill" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "identity_profiles" ADD COLUMN "prefill_decided_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "profile_audit_events" ADD CONSTRAINT "profile_audit_events_user_id_identity_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_audit_events" ADD CONSTRAINT "profile_audit_events_session_id_identity_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."identity_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_audit_events" ADD CONSTRAINT "profile_audit_events_profile_id_identity_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."identity_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_audit_events" ADD CONSTRAINT "profile_audit_events_draft_id_profile_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."profile_drafts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_choices" ADD CONSTRAINT "profile_choices_user_id_identity_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_choices" ADD CONSTRAINT "profile_choices_profile_id_identity_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."identity_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_choices" ADD CONSTRAINT "profile_choices_session_id_identity_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."identity_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_commands" ADD CONSTRAINT "profile_commands_user_id_identity_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_commands" ADD CONSTRAINT "profile_commands_draft_id_profile_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."profile_drafts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_drafts" ADD CONSTRAINT "profile_drafts_claimed_by_identity_users_id_fk" FOREIGN KEY ("claimed_by") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "profile_audit_owner_list" ON "profile_audit_events" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "profile_audit_draft_list" ON "profile_audit_events" USING btree ("draft_id","created_at","id");--> statement-breakpoint
CREATE INDEX "profile_choices_owner_list" ON "profile_choices" USING btree ("user_id","decided_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "profile_commands_user_key" ON "profile_commands" USING btree ("user_id","endpoint","key") WHERE "profile_commands"."user_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "profile_commands_draft_key" ON "profile_commands" USING btree ("draft_id","endpoint","key") WHERE "profile_commands"."draft_id" is not null;--> statement-breakpoint
CREATE INDEX "profile_commands_user_expiry" ON "profile_commands" USING btree ("user_id","expires_at","id");--> statement-breakpoint
CREATE INDEX "profile_commands_draft_expiry" ON "profile_commands" USING btree ("draft_id","expires_at","id");--> statement-breakpoint
CREATE INDEX "profile_drafts_expiry" ON "profile_drafts" USING btree ("expires_at","id");--> statement-breakpoint
CREATE INDEX "profile_drafts_claimant" ON "profile_drafts" USING btree ("claimed_by","id");--> statement-breakpoint
ALTER TABLE "identity_profiles" ADD CONSTRAINT "identity_profiles_revision" CHECK ("identity_profiles"."revision" >= 0);--> statement-breakpoint
ALTER TABLE "identity_profiles" ADD CONSTRAINT "identity_profiles_step" CHECK ("identity_profiles"."step" in ('information', 'address', 'review'));--> statement-breakpoint
ALTER TABLE "identity_profiles" ADD CONSTRAINT "identity_profiles_fields_object" CHECK (jsonb_typeof("identity_profiles"."fields") = 'object');
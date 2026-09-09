CREATE TABLE "authorization_signatures" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"managed_profile_id" text,
	"profile_id" text NOT NULL,
	"kind" text NOT NULL,
	"version" text NOT NULL,
	"session_id" text NOT NULL,
	"command_key" text NOT NULL,
	"request_hash" text NOT NULL,
	"receipt" jsonb NOT NULL,
	"signed_at" timestamp (3) with time zone NOT NULL,
	"revoked_at" timestamp (3) with time zone,
	CONSTRAINT "authorization_signatures_kind" CHECK ("authorization_signatures"."kind" in ('procuration','mandate')),
	CONSTRAINT "authorization_signatures_target" CHECK (("authorization_signatures"."profile_id" = 'self' and "authorization_signatures"."managed_profile_id" is null) or ("authorization_signatures"."profile_id" = "authorization_signatures"."managed_profile_id" and "authorization_signatures"."managed_profile_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "action_center_commands" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"operation" text NOT NULL,
	"key" text NOT NULL,
	"request_hash" text NOT NULL,
	"response" jsonb NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "action_center_commands_operation" CHECK ("action_center_commands"."operation" in ('resolve','manual_transition') and "action_center_commands"."request_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "action_center_manual_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"resolution_id" text NOT NULL,
	"action_id" text NOT NULL,
	"profile_id" text NOT NULL,
	"profile_name" text NOT NULL,
	"topic" text NOT NULL,
	"response" text NOT NULL,
	"state" text DEFAULT 'requested' NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"resolution" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "action_center_manual_bounds" CHECK ("action_center_manual_reviews"."revision" >= 0 and "action_center_manual_reviews"."state" in ('requested','in_progress','resolved') and length("action_center_manual_reviews"."response") between 1 and 2000 and ("action_center_manual_reviews"."state"<>'resolved' or length("action_center_manual_reviews"."resolution") between 1 and 2000))
);
--> statement-breakpoint
CREATE TABLE "action_center_resolutions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"managed_profile_id" text,
	"profile_id" text NOT NULL,
	"action_id" text NOT NULL,
	"topic" text NOT NULL,
	"observed_hash" text NOT NULL,
	"profile_hash" text NOT NULL,
	"fingerprint" text NOT NULL,
	"history" jsonb NOT NULL,
	"actor_user_id" text NOT NULL,
	"session_id" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "action_center_resolution_target" CHECK (("action_center_resolutions"."profile_id"='self' and "action_center_resolutions"."managed_profile_id" is null) or ("action_center_resolutions"."profile_id"="action_center_resolutions"."managed_profile_id" and "action_center_resolutions"."managed_profile_id" is not null)),
	CONSTRAINT "action_center_resolution_bounds" CHECK ("action_center_resolutions"."action_id" ~ '^act_[0-9a-f]{32}$' and "action_center_resolutions"."observed_hash" ~ '^[0-9a-f]{64}$' and "action_center_resolutions"."profile_hash" ~ '^[0-9a-f]{64}$' and "action_center_resolutions"."fingerprint" ~ '^[0-9a-f]{64}$' and length("action_center_resolutions"."topic") between 1 and 100 and jsonb_typeof("action_center_resolutions"."history")='object')
);
--> statement-breakpoint
ALTER TABLE "authorization_signatures" ADD CONSTRAINT "authorization_signatures_user_id_identity_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authorization_signatures" ADD CONSTRAINT "authorization_signatures_user_id_managed_profile_id_managed_profiles_user_id_id_fk" FOREIGN KEY ("user_id","managed_profile_id") REFERENCES "public"."managed_profiles"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_center_commands" ADD CONSTRAINT "action_center_commands_user_id_identity_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_center_commands" ADD CONSTRAINT "action_center_commands_actor_user_id_identity_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_center_manual_reviews" ADD CONSTRAINT "action_center_manual_reviews_user_id_identity_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "action_center_resolutions_owner_id" ON "action_center_resolutions" USING btree ("user_id","id");--> statement-breakpoint
ALTER TABLE "action_center_manual_reviews" ADD CONSTRAINT "action_center_manual_reviews_user_id_resolution_id_action_center_resolutions_user_id_id_fk" FOREIGN KEY ("user_id","resolution_id") REFERENCES "public"."action_center_resolutions"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_center_resolutions" ADD CONSTRAINT "action_center_resolutions_user_id_identity_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_center_resolutions" ADD CONSTRAINT "action_center_resolutions_actor_user_id_identity_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_center_resolutions" ADD CONSTRAINT "action_center_resolutions_user_id_managed_profile_id_managed_profiles_user_id_id_fk" FOREIGN KEY ("user_id","managed_profile_id") REFERENCES "public"."managed_profiles"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "authorization_signatures_command" ON "authorization_signatures" USING btree ("user_id","command_key");--> statement-breakpoint
CREATE UNIQUE INDEX "authorization_signatures_active" ON "authorization_signatures" USING btree ("user_id","profile_id","kind","version") WHERE "authorization_signatures"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "authorization_signatures_owner" ON "authorization_signatures" USING btree ("user_id","profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "action_center_commands_idempotency" ON "action_center_commands" USING btree ("user_id","actor_user_id","operation","key");--> statement-breakpoint
CREATE INDEX "action_center_commands_expiry" ON "action_center_commands" USING btree ("expires_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "action_center_manual_resolution" ON "action_center_manual_reviews" USING btree ("user_id","resolution_id");--> statement-breakpoint
CREATE INDEX "action_center_manual_owner_action" ON "action_center_manual_reviews" USING btree ("user_id","action_id");--> statement-breakpoint
CREATE INDEX "action_center_manual_admin_list" ON "action_center_manual_reviews" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "action_center_resolutions_owner_action" ON "action_center_resolutions" USING btree ("user_id","action_id","created_at","id");--> statement-breakpoint
CREATE INDEX "action_center_resolutions_owner_history" ON "action_center_resolutions" USING btree ("user_id","created_at","id");

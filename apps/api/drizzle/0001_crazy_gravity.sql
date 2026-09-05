CREATE TABLE "identity_admin_permissions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"permission" text NOT NULL,
	"evidence" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp (3) with time zone,
	CONSTRAINT "identity_admin_permission_name" CHECK ("identity_admin_permissions"."permission" = 'administration.access'),
	CONSTRAINT "identity_admin_permission_evidence" CHECK (length(trim("identity_admin_permissions"."evidence")) > 0)
);
--> statement-breakpoint
CREATE TABLE "identity_audit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"session_id" text,
	"action" text NOT NULL,
	"request_id" text NOT NULL,
	"deduplication_key" text NOT NULL,
	"revocation_id" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "identity_audit_events_deduplication_key_unique" UNIQUE("deduplication_key")
);
--> statement-breakpoint
CREATE TABLE "identity_logins" (
	"state_hash" text PRIMARY KEY NOT NULL,
	"browser_hash" text NOT NULL,
	"encrypted_verifier" text NOT NULL,
	"surface" text NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "identity_logins_state_hash" CHECK ("identity_logins"."state_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "identity_logins_browser_hash" CHECK ("identity_logins"."browser_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "identity_logins_surface" CHECK ("identity_logins"."surface" in ('client', 'admin', 'www')),
	CONSTRAINT "identity_logins_expiration" CHECK ("identity_logins"."expires_at" > "identity_logins"."created_at")
);
--> statement-breakpoint
CREATE TABLE "identity_mfa_challenges" (
	"session_id" text PRIMARY KEY NOT NULL,
	"challenge_id" text NOT NULL,
	"factor_id" text NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identity_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "identity_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "identity_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"workos_session_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"device" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL,
	"revoked_at" timestamp (3) with time zone,
	"mfa_verified_at" timestamp (3) with time zone,
	"remote_revocation_pending" boolean DEFAULT false NOT NULL,
	CONSTRAINT "identity_sessions_workos_session_id_unique" UNIQUE("workos_session_id"),
	CONSTRAINT "identity_sessions_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "identity_sessions_hash" CHECK ("identity_sessions"."token_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "identity_sessions_device_length" CHECK (length("identity_sessions"."device") <= 256),
	CONSTRAINT "identity_sessions_expiration" CHECK ("identity_sessions"."expires_at" > "identity_sessions"."created_at")
);
--> statement-breakpoint
CREATE TABLE "identity_users" (
	"id" text PRIMARY KEY NOT NULL,
	"workos_user_id" text NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"last_global_logout_at" timestamp (3) with time zone,
	"global_revocation_pending" boolean DEFAULT false NOT NULL,
	"global_revocation_id" text,
	CONSTRAINT "identity_users_workos_user_id_unique" UNIQUE("workos_user_id")
);
--> statement-breakpoint
ALTER TABLE "identity_admin_permissions" ADD CONSTRAINT "identity_admin_permissions_user_id_identity_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_audit_events" ADD CONSTRAINT "identity_audit_events_user_id_identity_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_audit_events" ADD CONSTRAINT "identity_audit_events_session_id_identity_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."identity_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_mfa_challenges" ADD CONSTRAINT "identity_mfa_challenges_session_id_identity_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."identity_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_profiles" ADD CONSTRAINT "identity_profiles_user_id_identity_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_sessions" ADD CONSTRAINT "identity_sessions_user_id_identity_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "identity_admin_active_permission" ON "identity_admin_permissions" USING btree ("user_id","permission") WHERE "identity_admin_permissions"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "identity_audit_owner_date" ON "identity_audit_events" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "identity_logins_expiration_index" ON "identity_logins" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "identity_sessions_owner_list" ON "identity_sessions" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "identity_sessions_owner_pending" ON "identity_sessions" USING btree ("user_id","remote_revocation_pending");
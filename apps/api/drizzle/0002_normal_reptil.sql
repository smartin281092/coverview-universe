CREATE TABLE "identity_mfa_enrollments" (
	"user_id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"operation_id" text NOT NULL,
	"status" text NOT NULL,
	"factor_id" text,
	"challenge_id" text,
	"challenge_expires_at" timestamp (3) with time zone,
	"claim_id" text NOT NULL,
	"verification_uncertain" boolean DEFAULT false NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "identity_mfa_enrollments_operation_id_unique" UNIQUE("operation_id"),
	CONSTRAINT "identity_mfa_enrollment_status" CHECK ("identity_mfa_enrollments"."status" in ('creating', 'pending', 'challenging', 'verifying', 'cancelling', 'confirmed', 'cancelled', 'recovery')),
	CONSTRAINT "identity_mfa_enrollment_factor" CHECK ("identity_mfa_enrollments"."status" in ('creating', 'recovery', 'cancelled') or "identity_mfa_enrollments"."factor_id" is not null),
	CONSTRAINT "identity_mfa_enrollment_challenge" CHECK (("identity_mfa_enrollments"."challenge_id" is null) = ("identity_mfa_enrollments"."challenge_expires_at" is null))
);
--> statement-breakpoint
ALTER TABLE "identity_mfa_enrollments" ADD CONSTRAINT "identity_mfa_enrollments_user_id_identity_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_mfa_enrollments" ADD CONSTRAINT "identity_mfa_enrollments_session_id_identity_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."identity_sessions"("id") ON DELETE no action ON UPDATE no action;
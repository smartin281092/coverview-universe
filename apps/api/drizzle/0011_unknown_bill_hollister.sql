CREATE TABLE "identity_notice_openings" (
	"user_id" text NOT NULL,
	"version" text NOT NULL,
	"first_opened_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"session_id" text NOT NULL,
	CONSTRAINT "identity_notice_openings_user_id_version_pk" PRIMARY KEY("user_id","version")
);
--> statement-breakpoint
ALTER TABLE "identity_notice_openings" ADD CONSTRAINT "identity_notice_openings_user_id_identity_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_notice_openings" ADD CONSTRAINT "identity_notice_openings_session_id_identity_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."identity_sessions"("id") ON DELETE no action ON UPDATE no action;
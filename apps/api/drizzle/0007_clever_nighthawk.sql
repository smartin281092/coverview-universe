CREATE TABLE "document_change_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"user_id" text NOT NULL,
	"extraction_id" text NOT NULL,
	"field" text NOT NULL,
	"previous_value" text NOT NULL,
	"requested_value" text NOT NULL,
	"insurer" text NOT NULL,
	"state" text DEFAULT 'prepared' NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_change_requests_state" CHECK ("document_change_requests"."state" in ('prepared','cancelled')),
	CONSTRAINT "document_change_requests_field" CHECK ("document_change_requests"."field" in ('firstName','lastName','birthDate','nationality','street','postalCode','city','country')),
	CONSTRAINT "document_change_requests_bounds" CHECK (length("document_change_requests"."previous_value") between 1 and 240 and length("document_change_requests"."requested_value") between 1 and 240 and length("document_change_requests"."insurer") between 1 and 160)
);
--> statement-breakpoint
ALTER TABLE "profile_audit_events" DROP CONSTRAINT "profile_audit_action";--> statement-breakpoint
CREATE UNIQUE INDEX "files_owner_id" ON "files" USING btree ("user_id","id");--> statement-breakpoint
ALTER TABLE "document_change_requests" ADD CONSTRAINT "document_change_requests_user_id_identity_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_change_requests" ADD CONSTRAINT "document_change_requests_user_id_document_id_files_user_id_id_fk" FOREIGN KEY ("user_id","document_id") REFERENCES "public"."files"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "document_change_requests_pending" ON "document_change_requests" USING btree ("user_id","document_id","extraction_id") WHERE "document_change_requests"."state" = 'prepared';--> statement-breakpoint
CREATE INDEX "document_change_requests_owner_list" ON "document_change_requests" USING btree ("user_id","created_at","id");--> statement-breakpoint
ALTER TABLE "profile_audit_events" ADD CONSTRAINT "profile_audit_action" CHECK ("profile_audit_events"."action" in ('profile.saved.v1', 'profile.confirmed.v1', 'profile.draft_saved.v1', 'profile.draft_attached.v1', 'profile.document_enriched.v1'));

CREATE TABLE "partner_client_invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"email" text NOT NULL,
	"state" text DEFAULT 'queued' NOT NULL,
	"token_hash" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL,
	"claimed_at" timestamp (3) with time zone,
	"sent_at" timestamp (3) with time zone,
	"responded_at" timestamp (3) with time zone,
	"responded_by" text,
	"notice_version" text,
	"cancelled_by" text,
	"cancel_reason" text,
	"failure" text,
	CONSTRAINT "partner_invitation_shape" CHECK ("partner_client_invitations"."state" in ('queued','sending','sent','accepted','declined','expired','cancelled','failed','superseded') and "partner_client_invitations"."email"=lower("partner_client_invitations"."email") and "partner_client_invitations"."email" ~ '^[^@\s]+@[^@\s]+$' and length("partner_client_invitations"."email")<=254 and "partner_client_invitations"."expires_at">"partner_client_invitations"."created_at" and "partner_client_invitations"."attempts" between 0 and 10 and ("partner_client_invitations"."token_hash" is null or "partner_client_invitations"."token_hash" ~ '^[a-f0-9]{64}$')),
	CONSTRAINT "partner_invitation_states" CHECK (("partner_client_invitations"."state"<>'sent' or ("partner_client_invitations"."token_hash" is not null and "partner_client_invitations"."sent_at" is not null)) and (("partner_client_invitations"."state" in ('accepted','declined')) = ("partner_client_invitations"."responded_at" is not null and "partner_client_invitations"."responded_by" is not null and "partner_client_invitations"."notice_version" is not null)) and (("partner_client_invitations"."state"='cancelled') = ("partner_client_invitations"."cancelled_by" is not null and coalesce(length(trim("partner_client_invitations"."cancel_reason")),0)>=5)) and ("partner_client_invitations"."failure" is null or "partner_client_invitations"."failure" in ('send_failed','delivery_unknown','recipient_changed','request_changed')) and (("partner_client_invitations"."state" in ('failed','superseded')) = ("partner_client_invitations"."failure" is not null)))
);
--> statement-breakpoint
ALTER TABLE "partner_client_invitations" ADD CONSTRAINT "partner_client_invitations_lead_id_partner_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."partner_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_client_invitations" ADD CONSTRAINT "partner_client_invitations_created_by_identity_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_client_invitations" ADD CONSTRAINT "partner_client_invitations_responded_by_identity_users_id_fk" FOREIGN KEY ("responded_by") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_client_invitations" ADD CONSTRAINT "partner_client_invitations_cancelled_by_identity_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "partner_invitation_token" ON "partner_client_invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_invitation_active" ON "partner_client_invitations" USING btree ("lead_id") WHERE "partner_client_invitations"."state" in ('queued','sending','sent');--> statement-breakpoint
CREATE INDEX "partner_invitation_queue" ON "partner_client_invitations" USING btree ("created_at","id") WHERE "partner_client_invitations"."state"='queued';--> statement-breakpoint
CREATE INDEX "partner_invitation_lead" ON "partner_client_invitations" USING btree ("lead_id","created_at","id");--> statement-breakpoint
CREATE INDEX "partner_invitation_recipient" ON "partner_client_invitations" USING btree ("email","created_at");--> statement-breakpoint
-- An invitation keeps its recipient, request and validity; it moves forward only, ends once, and
-- is never deleted: it is the trace of an indirect collection of personal data.
CREATE FUNCTION partner_client_invitation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  RAISE EXCEPTION 'client invitation cannot be deleted' USING ERRCODE='23514';
 END IF;
 IF (NEW.id, NEW.lead_id, NEW.email, NEW.created_by, NEW.created_at, NEW.expires_at)
  IS DISTINCT FROM (OLD.id, OLD.lead_id, OLD.email, OLD.created_by, OLD.created_at, OLD.expires_at)
  OR OLD.state IN ('accepted','declined','expired','cancelled','failed','superseded')
  OR (NEW.state<>OLD.state AND NOT (
   (OLD.state='queued' AND NEW.state IN ('sending','cancelled','expired','superseded'))
   OR (OLD.state='sending' AND NEW.state IN ('sent','queued','failed'))
   OR (OLD.state='sent' AND NEW.state IN ('accepted','declined','cancelled','expired','superseded')))) THEN
  RAISE EXCEPTION 'invalid client invitation change' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_client_invitation_guard BEFORE UPDATE OR DELETE ON partner_client_invitations FOR EACH ROW EXECUTE FUNCTION partner_client_invitation_guard();

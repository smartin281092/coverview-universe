CREATE TABLE "partner_team_invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"invited_by" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL,
	"accepted_by" text,
	"accepted_at" timestamp (3) with time zone,
	"declined_at" timestamp (3) with time zone,
	"cancelled_by" text,
	"cancelled_at" timestamp (3) with time zone,
	CONSTRAINT "partner_team_invitation_email" CHECK ("partner_team_invitations"."email"=lower(trim("partner_team_invitations"."email")) and length("partner_team_invitations"."email") between 3 and 254 and position('@' in "partner_team_invitations"."email")>1),
	CONSTRAINT "partner_team_invitation_expiry" CHECK ("partner_team_invitations"."expires_at">"partner_team_invitations"."created_at"),
	CONSTRAINT "partner_team_invitation_outcome" CHECK (num_nonnulls("partner_team_invitations"."accepted_at","partner_team_invitations"."declined_at","partner_team_invitations"."cancelled_at")<=1 and ("partner_team_invitations"."accepted_at" is null)=("partner_team_invitations"."accepted_by" is null) and ("partner_team_invitations"."cancelled_at" is null)=("partner_team_invitations"."cancelled_by" is null))
);
--> statement-breakpoint
ALTER TABLE "partner_team_invitations" ADD CONSTRAINT "partner_team_invitations_organization_id_partner_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."partner_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_team_invitations" ADD CONSTRAINT "partner_team_invitations_invited_by_identity_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_team_invitations" ADD CONSTRAINT "partner_team_invitations_accepted_by_identity_users_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_team_invitations" ADD CONSTRAINT "partner_team_invitations_cancelled_by_identity_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "partner_team_invitations_email" ON "partner_team_invitations" USING btree ("email","created_at");--> statement-breakpoint
CREATE INDEX "partner_team_invitations_organization" ON "partner_team_invitations" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_team_invitation_open" ON "partner_team_invitations" USING btree ("organization_id","email") WHERE "partner_team_invitations"."accepted_at" is null and "partner_team_invitations"."declined_at" is null and "partner_team_invitations"."cancelled_at" is null;--> statement-breakpoint
-- Handwritten guard (C8b). An invitation is kept, and its outcome is written once.
CREATE FUNCTION partner_team_invitation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'partner team invitation is kept' USING ERRCODE='23514'; END IF;
 IF OLD.accepted_at IS NOT NULL OR OLD.declined_at IS NOT NULL OR OLD.cancelled_at IS NOT NULL
 OR (to_jsonb(NEW)-'accepted_by'-'accepted_at'-'declined_at'-'cancelled_by'-'cancelled_at')
  IS DISTINCT FROM (to_jsonb(OLD)-'accepted_by'-'accepted_at'-'declined_at'-'cancelled_by'-'cancelled_at') THEN
  RAISE EXCEPTION 'partner team invitation outcome is written once' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_team_invitation_guard BEFORE UPDATE OR DELETE ON partner_team_invitations FOR EACH ROW EXECUTE FUNCTION partner_team_invitation_guard();

CREATE TABLE "partner_booking_proposals" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"advisor_id" text NOT NULL,
	"advisor_name" text NOT NULL,
	"subject_key" text NOT NULL,
	"owner_id" text NOT NULL,
	"fingerprint" text NOT NULL,
	"input" jsonb NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL,
	"state" text DEFAULT 'offered' NOT NULL,
	"invalidated_at" timestamp (3) with time zone,
	"appointment_id" text,
	"selected_slot" integer,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_booking_state" CHECK ("partner_booking_proposals"."state" in ('offered','booked','withdrawn')),
	CONSTRAINT "partner_booking_selection" CHECK (("partner_booking_proposals"."state"='booked' and "partner_booking_proposals"."appointment_id" is not null and "partner_booking_proposals"."selected_slot" is not null and "partner_booking_proposals"."selected_slot" between 0 and 4) or ("partner_booking_proposals"."state"<>'booked' and "partner_booking_proposals"."appointment_id" is null and "partner_booking_proposals"."selected_slot" is null)),
	CONSTRAINT "partner_booking_fingerprint" CHECK ("partner_booking_proposals"."fingerprint" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "partner_booking_proposals" ADD CONSTRAINT "partner_booking_proposals_lead_id_partner_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."partner_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_booking_proposals" ADD CONSTRAINT "partner_booking_proposals_advisor_id_identity_users_id_fk" FOREIGN KEY ("advisor_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_booking_proposals" ADD CONSTRAINT "partner_booking_proposals_owner_id_identity_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_booking_proposals" ADD CONSTRAINT "partner_booking_proposals_appointment_id_partner_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."partner_appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "partner_booking_history" ON "partner_booking_proposals" USING btree ("lead_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_booking_active" ON "partner_booking_proposals" USING btree ("lead_id") WHERE "partner_booking_proposals"."state"='offered' and "partner_booking_proposals"."invalidated_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "partner_booking_appointment" ON "partner_booking_proposals" USING btree ("appointment_id");
--> statement-breakpoint
CREATE FUNCTION partner_booking_evidence_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.state='offered' AND OLD.invalidated_at IS NULL THEN
  IF NEW.invalidated_at IS NOT NULL AND (to_jsonb(NEW)-'invalidated_at')=(to_jsonb(OLD)-'invalidated_at') THEN RETURN NEW; END IF;
  IF NEW.invalidated_at IS NULL AND NEW.state IN ('booked','withdrawn')
   AND (to_jsonb(NEW)-ARRAY['state','appointment_id','selected_slot'])=(to_jsonb(OLD)-ARRAY['state','appointment_id','selected_slot']) THEN RETURN NEW; END IF;
 END IF;
 RAISE EXCEPTION 'Booking proposal and receipt are immutable' USING ERRCODE='23514';
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_booking_evidence_guard BEFORE UPDATE OR DELETE ON partner_booking_proposals
FOR EACH ROW EXECUTE FUNCTION partner_booking_evidence_guard();

--> statement-breakpoint
CREATE FUNCTION partner_booking_proposals_invalidate_lead() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.advice_scope_revision,NEW.client_user_id,NEW.client_profile_id,NEW.responsible_id,NEW.assignment,NEW.notification_cycle)
     IS DISTINCT FROM ROW(OLD.advice_scope_revision,OLD.client_user_id,OLD.client_profile_id,OLD.responsible_id,OLD.assignment,OLD.notification_cycle)
     OR (NEW.stage IN ('draft','completed') AND NEW.stage<>OLD.stage) THEN
    UPDATE partner_booking_proposals SET invalidated_at=clock_timestamp()
    WHERE lead_id=NEW.id AND state='offered' AND invalidated_at IS NULL;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_booking_proposals_invalidate_lead AFTER UPDATE ON partner_leads
FOR EACH ROW EXECUTE FUNCTION partner_booking_proposals_invalidate_lead();
--> statement-breakpoint
CREATE FUNCTION partner_booking_proposals_invalidate_contribution() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP<>'INSERT' THEN
    UPDATE partner_booking_proposals SET invalidated_at=clock_timestamp()
    WHERE lead_id=OLD.lead_id AND advisor_id=OLD.user_id
      AND state='offered' AND invalidated_at IS NULL;
  END IF;
  IF TG_OP<>'DELETE' THEN
    UPDATE partner_booking_proposals SET invalidated_at=clock_timestamp()
    WHERE lead_id=NEW.lead_id AND advisor_id=NEW.user_id
      AND state='offered' AND invalidated_at IS NULL;
  END IF;
  RETURN COALESCE(NEW,OLD);
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_booking_proposals_invalidate_contribution AFTER INSERT OR UPDATE OR DELETE ON partner_contributors
FOR EACH ROW EXECUTE FUNCTION partner_booking_proposals_invalidate_contribution();
--> statement-breakpoint
CREATE FUNCTION partner_booking_proposals_invalidate_member() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.state,NEW.roles,NEW.organization_id,NEW.professional_revision,NEW.revision,NEW.review_due_at)
    IS DISTINCT FROM ROW(OLD.state,OLD.roles,OLD.organization_id,OLD.professional_revision,OLD.revision,OLD.review_due_at) THEN
    UPDATE partner_booking_proposals SET invalidated_at=clock_timestamp()
    WHERE advisor_id=NEW.user_id AND state='offered' AND invalidated_at IS NULL;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_booking_proposals_invalidate_member AFTER UPDATE ON partner_members
FOR EACH ROW EXECUTE FUNCTION partner_booking_proposals_invalidate_member();
--> statement-breakpoint
CREATE FUNCTION partner_booking_proposals_invalidate_organization() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.state IS DISTINCT FROM OLD.state THEN
    UPDATE partner_booking_proposals SET invalidated_at=clock_timestamp()
    WHERE advisor_id IN (SELECT user_id FROM partner_members WHERE organization_id=NEW.id)
      AND state='offered' AND invalidated_at IS NULL;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_booking_proposals_invalidate_organization AFTER UPDATE ON partner_organizations
FOR EACH ROW EXECUTE FUNCTION partner_booking_proposals_invalidate_organization();

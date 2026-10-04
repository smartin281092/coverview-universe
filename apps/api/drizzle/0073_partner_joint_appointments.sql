CREATE TABLE "partner_appointment_participants" (
	"id" text PRIMARY KEY NOT NULL,
	"appointment_id" text NOT NULL,
	"lead_id" text NOT NULL,
	"user_id" text NOT NULL,
	"invited_by" text NOT NULL,
	"state" text DEFAULT 'invited' NOT NULL,
	"terms_revision" integer NOT NULL,
	"preparation_minutes" integer DEFAULT 0 NOT NULL,
	"travel_before_minutes" integer DEFAULT 0 NOT NULL,
	"travel_after_minutes" integer DEFAULT 0 NOT NULL,
	"outcome" text,
	"revision" integer DEFAULT 1 NOT NULL,
	"evidence" jsonb NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp (3) with time zone,
	CONSTRAINT "partner_participant_state" CHECK ("partner_appointment_participants"."state" in ('invited','confirmed','declined','withdrawn','ended')),
	CONSTRAINT "partner_participant_outcome" CHECK ("partner_appointment_participants"."outcome" is null or ("partner_appointment_participants"."state"='confirmed' and "partner_appointment_participants"."outcome" in ('completed','client_absent','advisor_absent'))),
	CONSTRAINT "partner_participant_bounds" CHECK ("partner_appointment_participants"."revision">0 and "partner_appointment_participants"."terms_revision">0 and "partner_appointment_participants"."preparation_minutes" between 0 and 240 and "partner_appointment_participants"."travel_before_minutes" between 0 and 240 and "partner_appointment_participants"."travel_after_minutes" between 0 and 240)
);
--> statement-breakpoint
ALTER TABLE "partner_appointment_participants" ADD CONSTRAINT "partner_appointment_participants_appointment_id_partner_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."partner_appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_appointment_participants" ADD CONSTRAINT "partner_appointment_participants_lead_id_partner_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."partner_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_appointment_participants" ADD CONSTRAINT "partner_appointment_participants_user_id_identity_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_appointment_participants" ADD CONSTRAINT "partner_appointment_participants_invited_by_identity_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "partner_participant_active_user" ON "partner_appointment_participants" USING btree ("appointment_id","user_id") WHERE "partner_appointment_participants"."state" in ('invited','confirmed');--> statement-breakpoint
CREATE UNIQUE INDEX "partner_participant_active_lead" ON "partner_appointment_participants" USING btree ("appointment_id","lead_id") WHERE "partner_appointment_participants"."state" in ('invited','confirmed');--> statement-breakpoint
CREATE INDEX "partner_participant_user" ON "partner_appointment_participants" USING btree ("user_id","state");--> statement-breakpoint
CREATE INDEX "partner_participant_lead" ON "partner_appointment_participants" USING btree ("lead_id");
--> statement-breakpoint
-- Handwritten guards (C6b): drizzle snapshots do not represent triggers. A confirmed participation
-- counts as protected time only while it matches the current terms of a scheduled appointment.
-- The host's guard now also respects its own participations in other appointments.
CREATE OR REPLACE FUNCTION partner_guard_protected_time() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.advisor_id,1));
  IF NEW.state='scheduled' AND (EXISTS (
    SELECT 1 FROM partner_appointments other
    WHERE other.advisor_id=NEW.advisor_id AND other.id<>NEW.id AND other.state='scheduled'
      AND (NEW.occupied_before_minutes>0 OR NEW.occupied_after_minutes>0
        OR other.occupied_before_minutes>0 OR other.occupied_after_minutes>0)
      AND other.starts_at - other.occupied_before_minutes * interval '1 minute'
        < NEW.starts_at + (NEW.duration_minutes + NEW.occupied_after_minutes) * interval '1 minute'
      AND other.starts_at + (other.duration_minutes + other.occupied_after_minutes) * interval '1 minute'
        > NEW.starts_at - NEW.occupied_before_minutes * interval '1 minute'
  ) OR EXISTS (
    SELECT 1 FROM partner_appointment_participants p
    JOIN partner_appointments joint ON joint.id=p.appointment_id
    WHERE p.user_id=NEW.advisor_id AND p.state='confirmed' AND p.terms_revision=joint.link_terms_revision
      AND joint.state='scheduled' AND joint.id<>NEW.id
      AND joint.starts_at - (p.preparation_minutes + p.travel_before_minutes) * interval '1 minute'
        < NEW.starts_at + (NEW.duration_minutes + NEW.occupied_after_minutes) * interval '1 minute'
      AND joint.starts_at + (joint.duration_minutes + p.travel_after_minutes) * interval '1 minute'
        > NEW.starts_at - NEW.occupied_before_minutes * interval '1 minute'
  )) THEN
    RAISE EXCEPTION 'Protected appointment time conflict' USING ERRCODE='23P01', CONSTRAINT='partner_protected_time_conflict';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION partner_guard_participation_time() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE joint partner_appointments%ROWTYPE;
BEGIN
  -- Recording an outcome keeps the confirmed terms: only a new or changed occupation is checked.
  IF NEW.state<>'confirmed' OR (TG_OP='UPDATE' AND OLD.state='confirmed'
    AND ROW(OLD.terms_revision,OLD.preparation_minutes,OLD.travel_before_minutes,OLD.travel_after_minutes)
      IS NOT DISTINCT FROM ROW(NEW.terms_revision,NEW.preparation_minutes,NEW.travel_before_minutes,NEW.travel_after_minutes)) THEN
    RETURN NEW;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id,1));
  SELECT * INTO joint FROM partner_appointments WHERE id=NEW.appointment_id;
  IF joint.state<>'scheduled' OR joint.link_terms_revision<>NEW.terms_revision OR joint.advisor_id=NEW.user_id THEN
    RAISE EXCEPTION 'Participation outside the current appointment terms' USING ERRCODE='23514', CONSTRAINT='partner_participant_terms';
  END IF;
  IF EXISTS (
    SELECT 1 FROM partner_appointments own
    WHERE own.advisor_id=NEW.user_id AND own.id<>NEW.appointment_id AND own.state='scheduled'
      AND own.starts_at - own.occupied_before_minutes * interval '1 minute'
        < joint.starts_at + (joint.duration_minutes + NEW.travel_after_minutes) * interval '1 minute'
      AND own.starts_at + (own.duration_minutes + own.occupied_after_minutes) * interval '1 minute'
        > joint.starts_at - (NEW.preparation_minutes + NEW.travel_before_minutes) * interval '1 minute'
  ) OR EXISTS (
    SELECT 1 FROM partner_appointment_participants other
    JOIN partner_appointments elsewhere ON elsewhere.id=other.appointment_id
    WHERE other.user_id=NEW.user_id AND other.id<>NEW.id AND other.state='confirmed'
      AND other.terms_revision=elsewhere.link_terms_revision AND elsewhere.state='scheduled'
      AND elsewhere.starts_at - (other.preparation_minutes + other.travel_before_minutes) * interval '1 minute'
        < joint.starts_at + (joint.duration_minutes + NEW.travel_after_minutes) * interval '1 minute'
      AND elsewhere.starts_at + (elsewhere.duration_minutes + other.travel_after_minutes) * interval '1 minute'
        > joint.starts_at - (NEW.preparation_minutes + NEW.travel_before_minutes) * interval '1 minute'
  ) THEN
    RAISE EXCEPTION 'Protected appointment time conflict' USING ERRCODE='23P01', CONSTRAINT='partner_protected_time_conflict';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER partner_participation_time_guard BEFORE INSERT OR UPDATE ON partner_appointment_participants
FOR EACH ROW EXECUTE FUNCTION partner_guard_participation_time();
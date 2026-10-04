CREATE TABLE "partner_appointment_time_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"appointment_id" text NOT NULL,
	"advisor_id" text NOT NULL,
	"revision" integer NOT NULL,
	"basis" text NOT NULL,
	"preparation_minutes" integer NOT NULL,
	"travel_before_minutes" integer NOT NULL,
	"travel_after_minutes" integer NOT NULL,
	"starts_at" timestamp (3) with time zone NOT NULL,
	"ends_at" timestamp (3) with time zone NOT NULL,
	"evidence" jsonb NOT NULL,
	"recorded_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_appointment_time_bounds" CHECK ("partner_appointment_time_plans"."revision">0 and "partner_appointment_time_plans"."preparation_minutes" between 0 and 240 and "partner_appointment_time_plans"."travel_before_minutes" between 0 and 240 and "partner_appointment_time_plans"."travel_after_minutes" between 0 and 240 and "partner_appointment_time_plans"."ends_at">"partner_appointment_time_plans"."starts_at")
);
--> statement-breakpoint
ALTER TABLE "partner_appointments" ADD COLUMN "occupied_before_minutes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "partner_appointments" ADD COLUMN "occupied_after_minutes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "partner_appointment_time_plans" ADD CONSTRAINT "partner_appointment_time_plans_appointment_id_partner_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."partner_appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_appointment_time_plans" ADD CONSTRAINT "partner_appointment_time_plans_advisor_id_identity_users_id_fk" FOREIGN KEY ("advisor_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "partner_appointment_time_revision" ON "partner_appointment_time_plans" USING btree ("appointment_id","revision");--> statement-breakpoint
ALTER TABLE "partner_appointments" ADD CONSTRAINT "partner_appointment_buffers" CHECK ("partner_appointments"."occupied_before_minutes" between 0 and 480 and "partner_appointments"."occupied_after_minutes" between 0 and 240);
--> statement-breakpoint
-- Preserve old unassessed commitments. Every writer, including N-1, must respect
-- a protected interval; old unprotected overlap diagnostics remain possible.
CREATE FUNCTION partner_guard_protected_time() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.advisor_id,1));
  IF NEW.state='scheduled' AND EXISTS (
    SELECT 1 FROM partner_appointments other
    WHERE other.advisor_id=NEW.advisor_id AND other.id<>NEW.id AND other.state='scheduled'
      AND (NEW.occupied_before_minutes>0 OR NEW.occupied_after_minutes>0
        OR other.occupied_before_minutes>0 OR other.occupied_after_minutes>0)
      AND other.starts_at - other.occupied_before_minutes * interval '1 minute'
        < NEW.starts_at + (NEW.duration_minutes + NEW.occupied_after_minutes) * interval '1 minute'
      AND other.starts_at + (other.duration_minutes + other.occupied_after_minutes) * interval '1 minute'
        > NEW.starts_at - NEW.occupied_before_minutes * interval '1 minute'
  ) THEN
    RAISE EXCEPTION 'Protected appointment time conflict' USING ERRCODE='23P01', CONSTRAINT='partner_protected_time_conflict';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER partner_protected_time_guard BEFORE INSERT OR UPDATE OF advisor_id,starts_at,duration_minutes,state,occupied_before_minutes,occupied_after_minutes
ON partner_appointments FOR EACH ROW EXECUTE FUNCTION partner_guard_protected_time();
--> statement-breakpoint
CREATE FUNCTION partner_keep_time_plan_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Appointment time versions are immutable' USING ERRCODE='23514', CONSTRAINT='partner_time_plan_immutable';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER partner_time_plan_immutable BEFORE UPDATE OR DELETE ON partner_appointment_time_plans
FOR EACH ROW EXECUTE FUNCTION partner_keep_time_plan_version();

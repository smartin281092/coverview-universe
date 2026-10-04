CREATE TABLE "partner_appointment_links" (
	"id" text PRIMARY KEY NOT NULL,
	"appointment_id" text NOT NULL,
	"source_lead_id" text NOT NULL,
	"lead_id" text NOT NULL,
	"user_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"subject_key" text NOT NULL,
	"profile_revision" integer NOT NULL,
	"revision" integer NOT NULL,
	"terms_revision" integer NOT NULL,
	"action" text NOT NULL,
	"terms" jsonb NOT NULL,
	"source_basis" text NOT NULL,
	"target_basis" text NOT NULL,
	"evidence" jsonb NOT NULL,
	"invalidated_at" timestamp (3) with time zone,
	"recorded_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_appointment_link_bounds" CHECK ("partner_appointment_links"."revision">0 and "partner_appointment_links"."terms_revision">0 and "partner_appointment_links"."profile_revision">=0 and "partner_appointment_links"."source_lead_id"<>"partner_appointment_links"."lead_id"),
	CONSTRAINT "partner_appointment_link_action" CHECK ("partner_appointment_links"."action" in ('linked','unlinked'))
);
--> statement-breakpoint
ALTER TABLE "partner_appointments" ADD COLUMN "link_terms_revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "partner_appointment_links" ADD CONSTRAINT "partner_appointment_links_appointment_id_partner_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."partner_appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_appointment_links" ADD CONSTRAINT "partner_appointment_links_source_lead_id_partner_leads_id_fk" FOREIGN KEY ("source_lead_id") REFERENCES "public"."partner_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_appointment_links" ADD CONSTRAINT "partner_appointment_links_lead_id_partner_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."partner_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_appointment_links" ADD CONSTRAINT "partner_appointment_links_user_id_identity_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_appointment_links" ADD CONSTRAINT "partner_appointment_links_owner_id_identity_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "partner_appointment_link_revision" ON "partner_appointment_links" USING btree ("appointment_id","lead_id","revision");--> statement-breakpoint
CREATE INDEX "partner_appointment_link_target" ON "partner_appointment_links" USING btree ("lead_id","subject_key","recorded_at");--> statement-breakpoint
CREATE INDEX "partner_appointment_link_source" ON "partner_appointment_links" USING btree ("source_lead_id");--> statement-breakpoint
CREATE INDEX "partner_appointment_link_user" ON "partner_appointment_links" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "partner_appointments" ADD CONSTRAINT "partner_appointment_link_terms_revision" CHECK ("partner_appointments"."link_terms_revision">0);
--> statement-breakpoint
-- Handwritten integrity guards: drizzle snapshots do not represent triggers.
CREATE FUNCTION partner_appointment_link_terms_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.starts_at,NEW.duration_minutes,NEW.mode,NEW.location,NEW.timezone,NEW.lead_id,NEW.advisor_id)
     IS DISTINCT FROM ROW(OLD.starts_at,OLD.duration_minutes,OLD.mode,OLD.location,OLD.timezone,OLD.lead_id,OLD.advisor_id)
     OR (NEW.state='scheduled' AND OLD.state<>'scheduled') THEN
    NEW.link_terms_revision := OLD.link_terms_revision+1;
  ELSE NEW.link_terms_revision := OLD.link_terms_revision;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_appointment_link_terms_guard BEFORE UPDATE ON partner_appointments
FOR EACH ROW EXECUTE FUNCTION partner_appointment_link_terms_guard();
--> statement-breakpoint
CREATE FUNCTION partner_appointment_link_evidence_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='UPDATE' AND OLD.invalidated_at IS NULL AND NEW.invalidated_at IS NOT NULL
    AND (to_jsonb(NEW)-'invalidated_at')=(to_jsonb(OLD)-'invalidated_at') THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Appointment link versions are immutable' USING ERRCODE='23514';
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_appointment_link_evidence_guard BEFORE UPDATE OR DELETE ON partner_appointment_links
FOR EACH ROW EXECUTE FUNCTION partner_appointment_link_evidence_guard();
--> statement-breakpoint
CREATE FUNCTION partner_appointment_links_invalidate_lead() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.advice_scope_revision,NEW.client_user_id,NEW.client_profile_id,NEW.responsible_id,NEW.assignment,NEW.notification_cycle)
     IS DISTINCT FROM ROW(OLD.advice_scope_revision,OLD.client_user_id,OLD.client_profile_id,OLD.responsible_id,OLD.assignment,OLD.notification_cycle)
     OR (NEW.stage IN ('draft','completed') AND NEW.stage<>OLD.stage) THEN
    UPDATE partner_appointment_links SET invalidated_at=clock_timestamp()
    WHERE (source_lead_id=NEW.id OR lead_id=NEW.id) AND action='linked' AND invalidated_at IS NULL;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_appointment_links_invalidate_lead AFTER UPDATE ON partner_leads
FOR EACH ROW EXECUTE FUNCTION partner_appointment_links_invalidate_lead();
--> statement-breakpoint
CREATE FUNCTION partner_appointment_links_invalidate_contribution() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP<>'INSERT' THEN
    UPDATE partner_appointment_links SET invalidated_at=clock_timestamp()
    WHERE (source_lead_id=OLD.lead_id OR lead_id=OLD.lead_id) AND user_id=OLD.user_id
      AND action='linked' AND invalidated_at IS NULL;
  END IF;
  IF TG_OP<>'DELETE' THEN
    UPDATE partner_appointment_links SET invalidated_at=clock_timestamp()
    WHERE (source_lead_id=NEW.lead_id OR lead_id=NEW.lead_id) AND user_id=NEW.user_id
      AND action='linked' AND invalidated_at IS NULL;
  END IF;
  RETURN COALESCE(NEW,OLD);
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_appointment_links_invalidate_contribution AFTER INSERT OR UPDATE OR DELETE ON partner_contributors
FOR EACH ROW EXECUTE FUNCTION partner_appointment_links_invalidate_contribution();
--> statement-breakpoint
CREATE FUNCTION partner_appointment_links_invalidate_member() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.state,NEW.roles,NEW.organization_id,NEW.professional_revision,NEW.revision,NEW.review_due_at)
    IS DISTINCT FROM ROW(OLD.state,OLD.roles,OLD.organization_id,OLD.professional_revision,OLD.revision,OLD.review_due_at) THEN
    UPDATE partner_appointment_links SET invalidated_at=clock_timestamp()
    WHERE user_id=NEW.user_id AND action='linked' AND invalidated_at IS NULL;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_appointment_links_invalidate_member AFTER UPDATE ON partner_members
FOR EACH ROW EXECUTE FUNCTION partner_appointment_links_invalidate_member();
--> statement-breakpoint
CREATE FUNCTION partner_appointment_links_invalidate_organization() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.state IS DISTINCT FROM OLD.state THEN
    UPDATE partner_appointment_links SET invalidated_at=clock_timestamp()
    WHERE user_id IN (SELECT user_id FROM partner_members WHERE organization_id=NEW.id)
      AND action='linked' AND invalidated_at IS NULL;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_appointment_links_invalidate_organization AFTER UPDATE ON partner_organizations
FOR EACH ROW EXECUTE FUNCTION partner_appointment_links_invalidate_organization();

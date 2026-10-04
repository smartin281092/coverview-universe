CREATE TABLE "partner_lead_reopenings" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"owner_id" text,
	"subject_key" text NOT NULL,
	"lead_revision" integer NOT NULL,
	"closed_result" text NOT NULL,
	"closed_reason" text NOT NULL,
	"closed_at" timestamp (3) with time zone NOT NULL,
	"reopened_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"reason" text NOT NULL,
	"next_action" text NOT NULL,
	"due_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "partner_reopening_revision" CHECK ("partner_lead_reopenings"."lead_revision">=0),
	CONSTRAINT "partner_reopening_dates" CHECK ("partner_lead_reopenings"."closed_at"<="partner_lead_reopenings"."reopened_at" and "partner_lead_reopenings"."reopened_at"<"partner_lead_reopenings"."due_at"),
	CONSTRAINT "partner_reopening_reason" CHECK (length(trim("partner_lead_reopenings"."reason")) between 5 and 2000 and length(trim("partner_lead_reopenings"."next_action")) between 2 and 240)
);
--> statement-breakpoint
ALTER TABLE "partner_lead_reopenings" ADD CONSTRAINT "partner_lead_reopenings_lead_id_partner_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."partner_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_lead_reopenings" ADD CONSTRAINT "partner_lead_reopenings_actor_id_identity_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_lead_reopenings" ADD CONSTRAINT "partner_lead_reopenings_owner_id_identity_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "partner_reopenings_lead" ON "partner_lead_reopenings" USING btree ("lead_id","reopened_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_reopening_once" ON "partner_lead_reopenings" USING btree ("lead_id","lead_revision");
--> statement-breakpoint
CREATE FUNCTION partner_reopening_create_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE l partner_leads%ROWTYPE; current_owner text; current_subject text;
BEGIN
 SELECT * INTO l FROM partner_leads WHERE id=NEW.lead_id FOR UPDATE;
 current_owner=coalesce((select user_id from managed_profiles where id=l.client_profile_id),l.client_user_id);
 current_subject=case when l.client_profile_id is not null then 'profile:'||l.client_profile_id
   when current_owner is not null then 'self:'||current_owner else 'lead:'||l.id end;
 IF NOT FOUND OR l.stage<>'completed' OR NEW.lead_revision<>l.revision
 OR ROW(NEW.closed_result,NEW.closed_reason,NEW.closed_at) IS DISTINCT FROM ROW(l.result,l.reason,l.stage_changed_at)
 OR NEW.owner_id IS DISTINCT FROM current_owner OR NEW.subject_key<>current_subject THEN
  RAISE EXCEPTION 'reopening must preserve the exact completed result' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_reopening_create_guard BEFORE INSERT ON partner_lead_reopenings FOR EACH ROW EXECUTE FUNCTION partner_reopening_create_guard();
--> statement-breakpoint
CREATE TRIGGER partner_reopening_immutable BEFORE UPDATE OR DELETE ON partner_lead_reopenings FOR EACH ROW EXECUTE FUNCTION partner_conclusion_immutable();
--> statement-breakpoint
CREATE FUNCTION partner_reopening_lead_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.stage='completed' AND NEW.stage<>'completed' THEN
  IF NEW.stage<>'qualifying' OR ROW(NEW.responsible_id,NEW.assignment,NEW.notification_cycle,NEW.notified_at,NEW.first_action_due_at,NEW.first_useful_at)
    IS DISTINCT FROM ROW(OLD.responsible_id,OLD.assignment,OLD.notification_cycle,OLD.notified_at,OLD.first_action_due_at,OLD.first_useful_at)
  OR NOT EXISTS(SELECT 1 FROM partner_lead_reopenings r WHERE r.lead_id=OLD.id AND r.lead_revision=OLD.revision
    AND ROW(r.closed_result,r.closed_reason,r.closed_at,r.next_action,r.due_at)
      IS NOT DISTINCT FROM ROW(OLD.result,OLD.reason,OLD.stage_changed_at,NEW.next_action,NEW.due_at)) THEN
   RAISE EXCEPTION 'reopening requires its immutable archive and a new action' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_reopening_lead_guard BEFORE UPDATE ON partner_leads FOR EACH ROW EXECUTE FUNCTION partner_reopening_lead_guard();

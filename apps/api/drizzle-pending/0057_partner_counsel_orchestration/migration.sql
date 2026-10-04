CREATE TABLE "partner_counsel_actions" (
	"id" text PRIMARY KEY NOT NULL,
	"request_id" text NOT NULL,
	"revision" integer NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"reason" text NOT NULL,
	"next_action" text,
	"due_at" timestamp (3) with time zone,
	"collaboration_id" text,
	"evidence" jsonb,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_counsel_action_kind" CHECK ("partner_counsel_actions"."action" in ('withdraw','follow_up','propose','resolve')),
	CONSTRAINT "partner_counsel_action_due" CHECK (("partner_counsel_actions"."action" in ('follow_up','propose') and "partner_counsel_actions"."next_action" is not null and "partner_counsel_actions"."due_at" is not null) or ("partner_counsel_actions"."action" in ('withdraw','resolve') and "partner_counsel_actions"."next_action" is null and "partner_counsel_actions"."due_at" is null)),
	CONSTRAINT "partner_counsel_action_collaboration" CHECK (("partner_counsel_actions"."action"='propose')=("partner_counsel_actions"."collaboration_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "partner_counsel_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"author_id" text NOT NULL,
	"subject_key" text NOT NULL,
	"owner_id" text NOT NULL,
	"context" text NOT NULL,
	"source_basis" text NOT NULL,
	"invalidated_at" timestamp (3) with time zone,
	"input" jsonb NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_counsel_hashes" CHECK ("partner_counsel_requests"."context" ~ '^[a-f0-9]{64}$' and "partner_counsel_requests"."source_basis" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "partner_counsel_actions" ADD CONSTRAINT "partner_counsel_actions_request_id_partner_counsel_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."partner_counsel_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_counsel_actions" ADD CONSTRAINT "partner_counsel_actions_actor_id_identity_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_counsel_actions" ADD CONSTRAINT "partner_counsel_actions_collaboration_id_partner_collaborations_id_fk" FOREIGN KEY ("collaboration_id") REFERENCES "public"."partner_collaborations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_counsel_requests" ADD CONSTRAINT "partner_counsel_requests_lead_id_partner_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."partner_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_counsel_requests" ADD CONSTRAINT "partner_counsel_requests_author_id_identity_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_counsel_requests" ADD CONSTRAINT "partner_counsel_requests_owner_id_identity_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "partner_counsel_action_revision" ON "partner_counsel_actions" USING btree ("request_id","revision");--> statement-breakpoint
CREATE INDEX "partner_counsel_author" ON "partner_counsel_requests" USING btree ("author_id","lead_id","created_at","id");--> statement-breakpoint
CREATE INDEX "partner_counsel_queue" ON "partner_counsel_requests" USING btree ("created_at","id");
--> statement-breakpoint
CREATE FUNCTION partner_counsel_evidence_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='partner_counsel_requests' AND TG_OP='UPDATE' THEN
  IF OLD.invalidated_at IS NULL AND NEW.invalidated_at IS NOT NULL
    AND (to_jsonb(NEW)-'invalidated_at')=(to_jsonb(OLD)-'invalidated_at') THEN RETURN NEW; END IF;
 END IF;
 RAISE EXCEPTION 'Counsel requests and actions are immutable' USING ERRCODE='23514';
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_counsel_request_guard BEFORE UPDATE OR DELETE ON partner_counsel_requests
FOR EACH ROW EXECUTE FUNCTION partner_counsel_evidence_guard();
--> statement-breakpoint
CREATE TRIGGER partner_counsel_action_guard BEFORE UPDATE OR DELETE ON partner_counsel_actions
FOR EACH ROW EXECUTE FUNCTION partner_counsel_evidence_guard();
--> statement-breakpoint
CREATE FUNCTION partner_counsel_invalidate_lead() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW.advice_scope_revision,NEW.client_user_id,NEW.client_profile_id,NEW.responsible_id,NEW.assignment,NEW.notification_cycle)
   IS DISTINCT FROM ROW(OLD.advice_scope_revision,OLD.client_user_id,OLD.client_profile_id,OLD.responsible_id,OLD.assignment,OLD.notification_cycle)
   OR (NEW.stage IN ('draft','completed') AND NEW.stage<>OLD.stage) THEN
  UPDATE partner_counsel_requests SET invalidated_at=clock_timestamp() WHERE lead_id=NEW.id AND invalidated_at IS NULL;
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_counsel_invalidate_lead AFTER UPDATE ON partner_leads
FOR EACH ROW EXECUTE FUNCTION partner_counsel_invalidate_lead();
--> statement-breakpoint
CREATE FUNCTION partner_counsel_invalidate_profile() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN
  IF TG_TABLE_NAME='managed_profiles' THEN
   UPDATE partner_counsel_requests SET invalidated_at=clock_timestamp() WHERE subject_key='profile:'||NEW.id AND invalidated_at IS NULL;
  ELSE
   UPDATE partner_counsel_requests SET invalidated_at=clock_timestamp() WHERE subject_key='self:'||NEW.user_id AND invalidated_at IS NULL;
  END IF;
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_counsel_invalidate_managed AFTER UPDATE ON managed_profiles
FOR EACH ROW EXECUTE FUNCTION partner_counsel_invalidate_profile();
--> statement-breakpoint
CREATE TRIGGER partner_counsel_invalidate_self AFTER UPDATE ON identity_profiles
FOR EACH ROW EXECUTE FUNCTION partner_counsel_invalidate_profile();

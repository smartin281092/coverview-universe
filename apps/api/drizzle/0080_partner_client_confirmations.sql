CREATE TABLE "partner_client_confirmations" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"subject_key" text NOT NULL,
	"owner_id" text,
	"channel" text NOT NULL,
	"recorded_by" text NOT NULL,
	"facts" jsonb NOT NULL,
	"declared" jsonb NOT NULL,
	"discrepancies" jsonb NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"case_id" text,
	"occurred_at" timestamp (3) with time zone,
	"invalidated_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_client_confirmation_shape" CHECK ("partner_client_confirmations"."channel" in ('survey','wallet','call','email') and jsonb_typeof("partner_client_confirmations"."facts")='object' and jsonb_typeof("partner_client_confirmations"."declared")='object' and jsonb_typeof("partner_client_confirmations"."discrepancies")='array' and length("partner_client_confirmations"."comment")<=2000 and ("partner_client_confirmations"."channel" in ('call','email'))=("partner_client_confirmations"."occurred_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "partner_client_confirmations" ADD CONSTRAINT "partner_client_confirmations_lead_id_partner_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."partner_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_client_confirmations" ADD CONSTRAINT "partner_client_confirmations_owner_id_identity_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_client_confirmations" ADD CONSTRAINT "partner_client_confirmations_recorded_by_identity_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_client_confirmations" ADD CONSTRAINT "partner_client_confirmations_case_id_partner_quality_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."partner_quality_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "partner_client_confirmations_lead" ON "partner_client_confirmations" USING btree ("lead_id","created_at","id");--> statement-breakpoint
CREATE INDEX "partner_client_confirmations_case" ON "partner_client_confirmations" USING btree ("case_id");--> statement-breakpoint
-- Handwritten guards (C8d). A client confirmation is evidence: written once, only invalidated.
CREATE TRIGGER quality_context_immutable BEFORE UPDATE OR DELETE ON partner_client_confirmations FOR EACH ROW EXECUTE FUNCTION partner_quality_invalidation_only();
--> statement-breakpoint
-- The client states their own facts; CoverView records a call or an email; a case is a verification.
CREATE FUNCTION partner_client_confirmation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE kase partner_quality_cases%ROWTYPE;
BEGIN
 IF NEW.invalidated_at IS NOT NULL OR NOT partner_quality_context(NEW.lead_id,NEW.subject_key,NEW.owner_id) THEN
  RAISE EXCEPTION 'client confirmation subject changed' USING ERRCODE='23514'; END IF;
 IF NEW.channel IN ('survey','wallet') AND NEW.recorded_by IS DISTINCT FROM NEW.owner_id THEN
  RAISE EXCEPTION 'client confirmation must come from the client' USING ERRCODE='23514'; END IF;
 IF NEW.channel IN ('call','email') AND NOT EXISTS(SELECT 1 FROM identity_admin_permissions
  WHERE user_id=NEW.recorded_by AND permission='administration.access' AND revoked_at IS NULL) THEN
  RAISE EXCEPTION 'quality contact must be recorded by CoverView' USING ERRCODE='23514'; END IF;
 IF NEW.case_id IS NOT NULL THEN
  SELECT * INTO kase FROM partner_quality_cases WHERE id=NEW.case_id;
  IF NOT FOUND OR kase.lead_id<>NEW.lead_id OR kase.kind<>'verification' THEN
   RAISE EXCEPTION 'client confirmation case mismatch' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_client_confirmation_guard BEFORE INSERT ON partner_client_confirmations FOR EACH ROW EXECUTE FUNCTION partner_client_confirmation_guard();
--> statement-breakpoint
-- A change of subject also invalidates the client's confirmations, like the other quality evidence.
CREATE OR REPLACE FUNCTION partner_quality_invalidate(lead_key text,all_evidence boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 UPDATE partner_recording_requests SET invalidated_at=clock_timestamp() WHERE lead_id=lead_key AND invalidated_at IS NULL;
 UPDATE partner_notifications SET resolved_at=coalesce(resolved_at,clock_timestamp()) WHERE lead_id=lead_key AND kind='communication.consent';
 IF all_evidence THEN
  UPDATE partner_surveys SET invalidated_at=clock_timestamp() WHERE lead_id=lead_key AND invalidated_at IS NULL;
  UPDATE partner_quality_cases SET invalidated_at=clock_timestamp() WHERE lead_id=lead_key AND invalidated_at IS NULL;
  UPDATE partner_communication_preferences SET invalidated_at=clock_timestamp() WHERE lead_id=lead_key AND invalidated_at IS NULL;
  UPDATE partner_communication_records SET invalidated_at=clock_timestamp() WHERE lead_id=lead_key AND invalidated_at IS NULL;
  UPDATE partner_client_confirmations SET invalidated_at=clock_timestamp() WHERE lead_id=lead_key AND invalidated_at IS NULL;
  UPDATE partner_notifications SET resolved_at=coalesce(resolved_at,clock_timestamp()) WHERE lead_id=lead_key AND kind='quality.survey';
 END IF;
END $$;
--> statement-breakpoint
-- Quality actions (C8d): CoverView may ask the professional concerned to reconcile a verification;
-- that professional then replies, never to the client; a verification of a client statement
-- closes with an outcome.
CREATE OR REPLACE FUNCTION partner_quality_action_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c partner_quality_cases%ROWTYPE; previous_revision int; last_action text; action text; reconciler text;
BEGIN
 SELECT * INTO c FROM partner_quality_cases WHERE id=NEW.case_id FOR UPDATE;
 SELECT coalesce(max(revision),0) INTO previous_revision FROM partner_quality_actions WHERE case_id=NEW.case_id;
 SELECT input->>'action' INTO last_action FROM partner_quality_actions WHERE case_id=NEW.case_id AND input->>'action'<>'reply' ORDER BY revision DESC LIMIT 1;
 SELECT input->>'professionalId' INTO reconciler FROM partner_quality_actions WHERE case_id=NEW.case_id AND input->>'action'='request_reconciliation' ORDER BY revision DESC LIMIT 1;
 action=NEW.input->>'action';
 IF NEW.revision<>previous_revision+1 OR (NEW.input->>'expectedRevision')::int IS DISTINCT FROM previous_revision
 OR length(trim(NEW.input->>'note')) NOT BETWEEN 10 AND 2000
 OR action IS NULL OR action NOT IN ('reply','take_charge','follow_up','request_explanation','request_reconciliation','verify','close','reopen')
 OR coalesce(last_action='close',false) IS DISTINCT FROM (action='reopen') THEN
  RAISE EXCEPTION 'quality action revision or transition invalid' USING ERRCODE='23514'; END IF;
 IF NEW.input->'sharedWithClient'='true'::jsonb AND (c.audience<>'client' OR c.invalidated_at IS NOT NULL OR NOT partner_quality_context(c.lead_id,c.subject_key,c.owner_id)) THEN
  RAISE EXCEPTION 'quality client sharing context invalid' USING ERRCODE='23514'; END IF;
 IF action='reply' THEN
  IF c.invalidated_at IS NOT NULL OR NOT partner_quality_context(c.lead_id,c.subject_key,c.owner_id)
  OR NOT (NEW.actor_id=c.author_id OR NEW.actor_id=c.owner_id AND c.audience='client' OR NEW.actor_id=reconciler) THEN
   RAISE EXCEPTION 'quality reply author invalid' USING ERRCODE='23514'; END IF;
  IF NEW.actor_id=reconciler AND NEW.actor_id IS DISTINCT FROM c.author_id AND NEW.input->'sharedWithClient'='true'::jsonb THEN
   RAISE EXCEPTION 'reconciliation reply stays with CoverView' USING ERRCODE='23514'; END IF;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM identity_admin_permissions WHERE user_id=NEW.actor_id AND permission='administration.access' AND revoked_at IS NULL) THEN
   RAISE EXCEPTION 'quality management permission required' USING ERRCODE='23514'; END IF;
  IF action='close' THEN
   IF NEW.input->'verified' IS DISTINCT FROM 'true'::jsonb OR NEW.input->'dueAt' IS DISTINCT FROM 'null'::jsonb OR NEW.input->>'nextAction' IS DISTINCT FROM '' THEN
    RAISE EXCEPTION 'quality closure requires verified resolution' USING ERRCODE='23514'; END IF;
   IF EXISTS(SELECT 1 FROM partner_client_confirmations WHERE case_id=NEW.case_id)
   AND coalesce(NEW.input->>'outcome','') NOT IN ('confirmed','unfounded','inconclusive') THEN
    RAISE EXCEPTION 'verification closure requires an outcome' USING ERRCODE='23514'; END IF;
  ELSIF (NEW.input->>'dueAt')::timestamptz IS NULL OR (NEW.input->>'dueAt')::timestamptz<=clock_timestamp() OR length(trim(NEW.input->>'nextAction'))<5 THEN
   RAISE EXCEPTION 'quality follow-up requires future action' USING ERRCODE='23514';
  END IF;
  IF action='request_reconciliation' AND (NEW.input->>'professionalId' IS NULL OR c.kind<>'verification') THEN
   RAISE EXCEPTION 'reconciliation requires a verification and a professional' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;

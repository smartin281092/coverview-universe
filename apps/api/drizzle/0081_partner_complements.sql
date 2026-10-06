CREATE TABLE "partner_complement_answers" (
	"request_id" text PRIMARY KEY NOT NULL,
	"answered_by" text NOT NULL,
	"text" text NOT NULL,
	"documents" jsonb NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_complement_answer_shape" CHECK (length("partner_complement_answers"."text")<=2000 and jsonb_typeof("partner_complement_answers"."documents")='array' and jsonb_array_length("partner_complement_answers"."documents")<=5 and (length(trim("partner_complement_answers"."text"))>=10 or jsonb_array_length("partner_complement_answers"."documents")>0))
);
--> statement-breakpoint
CREATE TABLE "partner_complement_closures" (
	"request_id" text PRIMARY KEY NOT NULL,
	"closed_by" text NOT NULL,
	"outcome" text NOT NULL,
	"note" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_complement_closure_shape" CHECK ("partner_complement_closures"."outcome" in ('completed','unanswered','withdrawn') and length("partner_complement_closures"."note")<=2000)
);
--> statement-breakpoint
CREATE TABLE "partner_complement_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"subject_key" text NOT NULL,
	"owner_id" text NOT NULL,
	"requested_by" text NOT NULL,
	"items" jsonb NOT NULL,
	"message" text NOT NULL,
	"due_at" timestamp (3) with time zone NOT NULL,
	"pause_follow_up" boolean NOT NULL,
	"invalidated_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_complement_request_shape" CHECK (jsonb_typeof("partner_complement_requests"."items")='array' and jsonb_array_length("partner_complement_requests"."items") between 1 and 3 and length(trim("partner_complement_requests"."message")) between 10 and 2000)
);
--> statement-breakpoint
ALTER TABLE "partner_complement_answers" ADD CONSTRAINT "partner_complement_answers_request_id_partner_complement_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."partner_complement_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_complement_answers" ADD CONSTRAINT "partner_complement_answers_answered_by_identity_users_id_fk" FOREIGN KEY ("answered_by") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_complement_closures" ADD CONSTRAINT "partner_complement_closures_request_id_partner_complement_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."partner_complement_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_complement_closures" ADD CONSTRAINT "partner_complement_closures_closed_by_identity_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_complement_requests" ADD CONSTRAINT "partner_complement_requests_lead_id_partner_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."partner_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_complement_requests" ADD CONSTRAINT "partner_complement_requests_owner_id_identity_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_complement_requests" ADD CONSTRAINT "partner_complement_requests_requested_by_identity_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "partner_complement_requests_lead" ON "partner_complement_requests" USING btree ("lead_id","created_at","id");--> statement-breakpoint
-- Handwritten guards (C8e). A request is written once and only invalidated; its single answer and
-- its single closure are immutable evidence.
CREATE TRIGGER quality_context_immutable BEFORE UPDATE OR DELETE ON partner_complement_requests FOR EACH ROW EXECUTE FUNCTION partner_quality_invalidation_only();
--> statement-breakpoint
CREATE TRIGGER quality_evidence_immutable BEFORE UPDATE OR DELETE ON partner_complement_answers FOR EACH ROW EXECUTE FUNCTION partner_quality_immutable();
--> statement-breakpoint
CREATE TRIGGER quality_evidence_immutable BEFORE UPDATE OR DELETE ON partner_complement_closures FOR EACH ROW EXECUTE FUNCTION partner_quality_immutable();
--> statement-breakpoint
-- A request concerns the current client of an open request, waits for a future date, and stays
-- alone until it is closed. The lead lock taken by partner_quality_context serializes requests.
CREATE FUNCTION partner_complement_request_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE l partner_leads%ROWTYPE;
BEGIN
 IF NEW.invalidated_at IS NOT NULL OR NOT partner_quality_context(NEW.lead_id,NEW.subject_key,NEW.owner_id) THEN
  RAISE EXCEPTION 'complement request subject changed' USING ERRCODE='23514'; END IF;
 SELECT * INTO l FROM partner_leads WHERE id=NEW.lead_id;
 IF l.stage IN ('draft','completed') OR NEW.due_at<=clock_timestamp() OR NEW.requested_by=NEW.owner_id
 OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(NEW.items) AS e(item) WHERE e.item NOT IN ('reference_contract','documents','information')) THEN
  RAISE EXCEPTION 'complement request requires an open request, a professional and a future date' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM partner_complement_requests r WHERE r.lead_id=NEW.lead_id AND r.invalidated_at IS NULL
  AND NOT EXISTS(SELECT 1 FROM partner_complement_closures c WHERE c.request_id=r.id)) THEN
  RAISE EXCEPTION 'one complement request at a time' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_complement_request_guard BEFORE INSERT ON partner_complement_requests FOR EACH ROW EXECUTE FUNCTION partner_complement_request_guard();
--> statement-breakpoint
-- Only the client who owns the request answers, once, before its closure and while it is open.
CREATE FUNCTION partner_complement_answer_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r partner_complement_requests%ROWTYPE; l partner_leads%ROWTYPE;
BEGIN
 SELECT * INTO r FROM partner_complement_requests WHERE id=NEW.request_id FOR UPDATE;
 IF NOT FOUND OR r.invalidated_at IS NOT NULL OR NEW.answered_by IS DISTINCT FROM r.owner_id
 OR NOT partner_quality_context(r.lead_id,r.subject_key,r.owner_id)
 OR EXISTS(SELECT 1 FROM partner_complement_closures WHERE request_id=r.id) THEN
  RAISE EXCEPTION 'complement answer requires the client and an open request' USING ERRCODE='23514'; END IF;
 SELECT * INTO l FROM partner_leads WHERE id=r.lead_id;
 IF l.stage IN ('draft','completed') THEN
  RAISE EXCEPTION 'complement answer requires an open request' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_complement_answer_guard BEFORE INSERT ON partner_complement_answers FOR EACH ROW EXECUTE FUNCTION partner_complement_answer_guard();
--> statement-breakpoint
-- A closure follows the answer ("completed"), or replaces it: "unanswered" after the due date,
-- "withdrawn" at any time. Never by the client.
CREATE FUNCTION partner_complement_closure_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r partner_complement_requests%ROWTYPE; answered boolean;
BEGIN
 SELECT * INTO r FROM partner_complement_requests WHERE id=NEW.request_id FOR UPDATE;
 IF NOT FOUND OR r.invalidated_at IS NOT NULL OR NEW.closed_by=r.owner_id THEN
  RAISE EXCEPTION 'complement closure requires a valid request' USING ERRCODE='23514'; END IF;
 answered=EXISTS(SELECT 1 FROM partner_complement_answers WHERE request_id=r.id);
 IF (NEW.outcome='completed') IS DISTINCT FROM answered OR (NEW.outcome='unanswered' AND r.due_at>clock_timestamp()) THEN
  RAISE EXCEPTION 'complement closure outcome invalid' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_complement_closure_guard BEFORE INSERT ON partner_complement_closures FOR EACH ROW EXECUTE FUNCTION partner_complement_closure_guard();
--> statement-breakpoint
-- A change of subject also invalidates the complement requests and settles their notices.
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
  UPDATE partner_complement_requests SET invalidated_at=clock_timestamp() WHERE lead_id=lead_key AND invalidated_at IS NULL;
  UPDATE partner_notifications SET resolved_at=coalesce(resolved_at,clock_timestamp()) WHERE lead_id=lead_key AND kind IN ('quality.survey','complement.requested','complement.answered');
 END IF;
END $$;

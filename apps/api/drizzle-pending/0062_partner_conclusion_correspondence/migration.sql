CREATE TABLE "partner_conclusion_correspondences" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"document_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"subject_key" text NOT NULL,
	"fingerprint" text NOT NULL,
	"shared_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"withdrawn_at" timestamp (3) with time zone,
	"invalidated_at" timestamp (3) with time zone,
	CONSTRAINT "partner_correspondence_fingerprint" CHECK ("partner_conclusion_correspondences"."fingerprint" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "partner_conclusion_correspondences" ADD CONSTRAINT "partner_conclusion_correspondences_lead_id_partner_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."partner_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_conclusion_correspondences" ADD CONSTRAINT "partner_conclusion_correspondences_document_id_files_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_conclusion_correspondences" ADD CONSTRAINT "partner_conclusion_correspondences_owner_id_identity_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "partner_correspondence_lead" ON "partner_conclusion_correspondences" USING btree ("lead_id","shared_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_correspondence_current" ON "partner_conclusion_correspondences" USING btree ("lead_id","document_id") WHERE "partner_conclusion_correspondences"."withdrawn_at" is null and "partner_conclusion_correspondences"."invalidated_at" is null;
--> statement-breakpoint
CREATE FUNCTION partner_correspondence_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE l partner_leads%ROWTYPE;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'correspondence evidence is retained' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' THEN
  IF (to_jsonb(NEW)-'withdrawn_at'-'invalidated_at') IS DISTINCT FROM (to_jsonb(OLD)-'withdrawn_at'-'invalidated_at')
  OR (OLD.withdrawn_at IS NOT NULL AND NEW.withdrawn_at IS DISTINCT FROM OLD.withdrawn_at)
  OR (OLD.invalidated_at IS NOT NULL AND NEW.invalidated_at IS DISTINCT FROM OLD.invalidated_at) THEN
   RAISE EXCEPTION 'correspondence cannot be rewritten or restored' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
 END IF;
 SELECT * INTO l FROM partner_leads WHERE id=NEW.lead_id FOR UPDATE;
 IF NOT FOUND OR NOT partner_quality_context(NEW.lead_id,NEW.subject_key,NEW.owner_id)
 OR NEW.withdrawn_at IS NOT NULL OR NEW.invalidated_at IS NOT NULL
 OR NOT EXISTS(SELECT 1 FROM files WHERE id=NEW.document_id AND user_id=NEW.owner_id
  AND managed_profile_id IS NOT DISTINCT FROM l.client_profile_id AND purpose IS NULL
  AND state='ready' AND deleted_at IS NULL AND scan_version IS NOT NULL
  AND (profile_assignment IS NULL OR profile_assignment IN ('matched','created','manual'))) THEN
  RAISE EXCEPTION 'invalid correspondence subject or source' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_correspondence_guard BEFORE INSERT OR UPDATE OR DELETE ON partner_conclusion_correspondences
 FOR EACH ROW EXECUTE FUNCTION partner_correspondence_guard();
--> statement-breakpoint
CREATE FUNCTION partner_correspondence_invalidate() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE document_key text;
BEGIN
 IF TG_TABLE_NAME='managed_profiles' THEN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
   UPDATE partner_conclusion_correspondences SET invalidated_at=clock_timestamp()
    WHERE subject_key='profile:'||NEW.id AND invalidated_at IS NULL;
  END IF;
  RETURN NEW;
 ELSIF TG_TABLE_NAME='partner_leads' THEN
  IF ROW(NEW.client_user_id,NEW.client_profile_id) IS DISTINCT FROM ROW(OLD.client_user_id,OLD.client_profile_id) THEN
   UPDATE partner_conclusion_correspondences SET invalidated_at=clock_timestamp() WHERE lead_id=NEW.id AND invalidated_at IS NULL;
  END IF;
  RETURN NEW;
 ELSIF TG_TABLE_NAME='files' THEN
  IF ROW(NEW.user_id,NEW.managed_profile_id,NEW.checksum,NEW.generation,NEW.analysis,NEW.category,NEW.category_corrected,
    NEW.deleted_at,NEW.scan_version,NEW.state,NEW.purpose,NEW.profile_assignment)
   IS NOT DISTINCT FROM ROW(OLD.user_id,OLD.managed_profile_id,OLD.checksum,OLD.generation,OLD.analysis,OLD.category,OLD.category_corrected,
    OLD.deleted_at,OLD.scan_version,OLD.state,OLD.purpose,OLD.profile_assignment) THEN RETURN NEW; END IF;
  document_key=NEW.id;
 ELSE document_key=NEW.document_id;
 END IF;
 UPDATE partner_conclusion_correspondences SET invalidated_at=clock_timestamp() WHERE document_id=document_key AND invalidated_at IS NULL;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_correspondence_source_context AFTER UPDATE ON files FOR EACH ROW EXECUTE FUNCTION partner_correspondence_invalidate();
--> statement-breakpoint
CREATE TRIGGER partner_correspondence_lead_context AFTER UPDATE ON partner_leads FOR EACH ROW EXECUTE FUNCTION partner_correspondence_invalidate();
--> statement-breakpoint
CREATE TRIGGER partner_correspondence_profile_context AFTER UPDATE ON managed_profiles FOR EACH ROW EXECUTE FUNCTION partner_correspondence_invalidate();
--> statement-breakpoint
CREATE TRIGGER partner_correspondence_correction_context AFTER INSERT ON document_field_corrections FOR EACH ROW EXECUTE FUNCTION partner_correspondence_invalidate();
--> statement-breakpoint
CREATE TRIGGER partner_correspondence_decision_context AFTER INSERT ON document_decisions FOR EACH ROW EXECUTE FUNCTION partner_correspondence_invalidate();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION partner_conclusion_action_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c partner_conclusions%ROWTYPE; previous_revision integer; previous_input jsonb; action text;
 history record; active_ids text[]='{}'; target_index integer; signed_at timestamptz;
BEGIN
 SELECT * INTO c FROM partner_conclusions WHERE id=NEW.conclusion_id FOR UPDATE;
 IF NOT FOUND OR NOT partner_quality_context(c.lead_id,c.subject_key,c.owner_id) THEN
  RAISE EXCEPTION 'conclusion subject changed' USING ERRCODE='23514';
 END IF;
 FOR history IN SELECT id,revision,input FROM partner_conclusion_actions WHERE conclusion_id=c.id ORDER BY revision LOOP
  previous_revision=history.revision;
  IF history.input->>'action'='correct' THEN
   target_index=array_position(active_ids,history.input->>'targetActionId');
   IF target_index IS NOT NULL THEN active_ids=active_ids[1:target_index-1]; END IF;
  ELSE active_ids=array_append(active_ids,history.id);
  END IF;
 END LOOP;
 SELECT input INTO previous_input FROM partner_conclusion_actions WHERE id=active_ids[cardinality(active_ids)];
 action=NEW.input->>'action';
 IF NEW.revision<>coalesce(previous_revision,0)+1 OR NEW.revision>100 OR (NEW.input->>'revision')::integer IS DISTINCT FROM NEW.revision-1
 OR action IS NULL OR action NOT IN ('withdraw','transmitted','accepted','declined','issued','correct')
 OR length(btrim(coalesce(NEW.input->>'reason','')))<5 THEN
  RAISE EXCEPTION 'invalid conclusion action revision' USING ERRCODE='23514';
 END IF;
 IF action='withdraw' THEN
  IF EXISTS(SELECT 1 FROM partner_offer_signatures WHERE conclusion_id=c.id) OR previous_revision IS NOT NULL THEN
   RAISE EXCEPTION 'signature cannot be withdrawn' USING ERRCODE='23514';
  END IF;
 ELSE
  SELECT created_at INTO signed_at FROM partner_offer_signatures WHERE conclusion_id=c.id;
  IF c.invalidated_at IS NOT NULL OR c.withdrawn_at IS NOT NULL OR signed_at IS NULL
  OR NEW.input->'verified' IS DISTINCT FROM 'true'::jsonb THEN
   RAISE EXCEPTION 'invalid conclusion transition' USING ERRCODE='23514';
  END IF;
  IF action='correct' THEN
   IF array_position(active_ids,NEW.input->>'targetActionId') IS NULL THEN
    RAISE EXCEPTION 'correction requires a current action' USING ERRCODE='23514';
   END IF;
  ELSE
   IF (action='transmitted' AND previous_input IS NOT NULL)
   OR (action IN ('accepted','declined') AND previous_input->>'action' IS DISTINCT FROM 'transmitted')
   OR (action='issued' AND previous_input->>'action' IS DISTINCT FROM 'accepted')
   OR (NEW.input->>'occurredAt')::timestamptz IS NULL
   OR (NEW.input->>'occurredAt')::timestamptz>clock_timestamp()
   OR (NEW.input->>'occurredAt')::timestamptz<greatest(signed_at,(previous_input->>'occurredAt')::timestamptz)
   OR (action IN ('accepted','declined','issued') AND num_nonnulls(NEW.input->>'policyId',NEW.input->>'correspondenceId')<>1)
   OR (action='issued' AND NEW.input->>'policyId' IS NULL) THEN
    RAISE EXCEPTION 'invalid conclusion fact sequence' USING ERRCODE='23514';
   END IF;
  END IF;
 END IF;
 RETURN NEW;
END $$;

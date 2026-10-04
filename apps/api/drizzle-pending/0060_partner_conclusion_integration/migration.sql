CREATE TABLE "partner_conclusion_actions" (
	"id" text PRIMARY KEY NOT NULL,
	"conclusion_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"revision" integer NOT NULL,
	"input" jsonb NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_conclusion_revision" CHECK ("partner_conclusion_actions"."revision">0)
);
--> statement-breakpoint
CREATE TABLE "partner_conclusions" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"offer_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"subject_key" text NOT NULL,
	"author_id" text NOT NULL,
	"context" text NOT NULL,
	"archive" jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"valid_until" timestamp (3) with time zone NOT NULL,
	"withdrawn_at" timestamp (3) with time zone,
	"invalidated_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_conclusion_hashes" CHECK ("partner_conclusions"."context" ~ '^[a-f0-9]{64}$' and "partner_conclusions"."content_hash" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
CREATE TABLE "partner_offer_signatures" (
	"id" text PRIMARY KEY NOT NULL,
	"conclusion_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"input" jsonb NOT NULL,
	"integrity_hash" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_offer_signature_hash" CHECK ("partner_offer_signatures"."integrity_hash" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "partner_conclusion_actions" ADD CONSTRAINT "partner_conclusion_actions_conclusion_id_partner_conclusions_id_fk" FOREIGN KEY ("conclusion_id") REFERENCES "public"."partner_conclusions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_conclusion_actions" ADD CONSTRAINT "partner_conclusion_actions_actor_id_identity_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_conclusions" ADD CONSTRAINT "partner_conclusions_lead_id_partner_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."partner_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_conclusions" ADD CONSTRAINT "partner_conclusions_offer_id_partner_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."partner_offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_conclusions" ADD CONSTRAINT "partner_conclusions_owner_id_identity_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_conclusions" ADD CONSTRAINT "partner_conclusions_author_id_identity_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_conclusions" ADD CONSTRAINT "partner_conclusion_exact_offer" FOREIGN KEY ("lead_id","offer_id") REFERENCES "public"."partner_offers"("lead_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_offer_signatures" ADD CONSTRAINT "partner_offer_signatures_conclusion_id_partner_conclusions_id_fk" FOREIGN KEY ("conclusion_id") REFERENCES "public"."partner_conclusions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_offer_signatures" ADD CONSTRAINT "partner_offer_signatures_actor_id_identity_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "partner_conclusion_action_revision" ON "partner_conclusion_actions" USING btree ("conclusion_id","revision");--> statement-breakpoint
CREATE INDEX "partner_conclusion_lead" ON "partner_conclusions" USING btree ("lead_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_conclusion_offer_open" ON "partner_conclusions" USING btree ("offer_id") WHERE "partner_conclusions"."withdrawn_at" is null and "partner_conclusions"."invalidated_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "partner_offer_signature_once" ON "partner_offer_signatures" USING btree ("conclusion_id");
--> statement-breakpoint
-- Append-only evidence. Revocation closes an invitation; it never erases a signature.
CREATE FUNCTION partner_conclusion_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'conclusion evidence is immutable' USING ERRCODE='23514'; END $$;
--> statement-breakpoint
CREATE TRIGGER partner_signature_immutable BEFORE UPDATE OR DELETE ON partner_offer_signatures FOR EACH ROW EXECUTE FUNCTION partner_conclusion_immutable();
--> statement-breakpoint
CREATE TRIGGER partner_conclusion_action_immutable BEFORE UPDATE OR DELETE ON partner_conclusion_actions FOR EACH ROW EXECUTE FUNCTION partner_conclusion_immutable();
--> statement-breakpoint
CREATE FUNCTION partner_conclusion_archive_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND (to_jsonb(OLD)-'invalidated_at'-'withdrawn_at')=(to_jsonb(NEW)-'invalidated_at'-'withdrawn_at')
 AND (OLD.invalidated_at IS NULL OR NEW.invalidated_at IS NOT DISTINCT FROM OLD.invalidated_at)
 AND (OLD.withdrawn_at IS NULL OR NEW.withdrawn_at IS NOT DISTINCT FROM OLD.withdrawn_at)
 AND (NEW.withdrawn_at IS NOT DISTINCT FROM OLD.withdrawn_at OR NOT EXISTS(SELECT 1 FROM partner_offer_signatures WHERE conclusion_id=OLD.id)) THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'conclusion archive cannot be rewritten or restored' USING ERRCODE='23514';
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_conclusion_archive_guard BEFORE UPDATE OR DELETE ON partner_conclusions FOR EACH ROW EXECUTE FUNCTION partner_conclusion_archive_guard();
--> statement-breakpoint
CREATE FUNCTION partner_conclusion_create_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE o partner_offers%ROWTYPE;
BEGIN
 IF NEW.invalidated_at IS NOT NULL OR NEW.withdrawn_at IS NOT NULL OR NEW.valid_until<=clock_timestamp()
 OR NOT partner_quality_context(NEW.lead_id,NEW.subject_key,NEW.owner_id)
 OR NEW.archive->>'leadId' IS DISTINCT FROM NEW.lead_id OR NEW.archive->>'ownerId' IS DISTINCT FROM NEW.owner_id
 OR NEW.archive->>'subjectKey' IS DISTINCT FROM NEW.subject_key OR NEW.archive->'offer'->>'id' IS DISTINCT FROM NEW.offer_id
 OR NEW.archive->>'preparedBy' IS DISTINCT FROM NEW.author_id THEN
  RAISE EXCEPTION 'invalid conclusion context' USING ERRCODE='23514';
 END IF;
 SELECT * INTO o FROM partner_offers WHERE id=NEW.offer_id AND lead_id=NEW.lead_id FOR SHARE;
 IF NOT FOUND OR NOT o.active OR o.state<>'selected' OR o.published_at IS NULL OR o.reviewed_at IS NULL
 OR (o.data->>'validUntil')::timestamptz<NEW.valid_until THEN
  RAISE EXCEPTION 'offer not ready for signature' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_conclusion_create_guard BEFORE INSERT ON partner_conclusions FOR EACH ROW EXECUTE FUNCTION partner_conclusion_create_guard();
--> statement-breakpoint
CREATE FUNCTION partner_offer_signature_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c partner_conclusions%ROWTYPE; o partner_offers%ROWTYPE;
BEGIN
 SELECT * INTO c FROM partner_conclusions WHERE id=NEW.conclusion_id FOR UPDATE;
 IF NOT FOUND OR c.invalidated_at IS NOT NULL OR c.withdrawn_at IS NOT NULL OR c.valid_until<=clock_timestamp()
 OR NEW.actor_id<>c.owner_id OR NOT partner_quality_context(c.lead_id,c.subject_key,c.owner_id)
 OR NEW.input->>'contentHash' IS DISTINCT FROM c.content_hash
 OR NEW.input->'accepted' IS DISTINCT FROM 'true'::jsonb OR NEW.input->'originalRead' IS DISTINCT FROM 'true'::jsonb
 OR jsonb_typeof(NEW.input->'drawing') IS DISTINCT FROM 'array' OR octet_length(NEW.input::text)>200000
 OR (c.subject_key LIKE 'profile:%' AND NEW.input->'representative' IS DISTINCT FROM 'true'::jsonb) THEN
  RAISE EXCEPTION 'signature context changed' USING ERRCODE='23514';
 END IF;
 SELECT * INTO o FROM partner_offers WHERE id=c.offer_id FOR SHARE;
 IF NOT o.active OR o.state<>'selected' OR o.published_at IS NULL OR o.reviewed_at IS NULL
 OR (o.data->>'validUntil')::timestamptz<=clock_timestamp() THEN
  RAISE EXCEPTION 'offer no longer signable' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_offer_signature_guard BEFORE INSERT ON partner_offer_signatures FOR EACH ROW EXECUTE FUNCTION partner_offer_signature_guard();
--> statement-breakpoint
CREATE FUNCTION partner_conclusion_action_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c partner_conclusions%ROWTYPE; previous_revision integer; previous_action text; action text;
BEGIN
 SELECT * INTO c FROM partner_conclusions WHERE id=NEW.conclusion_id FOR UPDATE;
 IF NOT FOUND OR NOT partner_quality_context(c.lead_id,c.subject_key,c.owner_id) THEN
  RAISE EXCEPTION 'conclusion subject changed' USING ERRCODE='23514';
 END IF;
 SELECT revision,input->>'action' INTO previous_revision,previous_action FROM partner_conclusion_actions WHERE conclusion_id=c.id ORDER BY revision DESC LIMIT 1;
 action=NEW.input->>'action';
 IF NEW.revision<>coalesce(previous_revision,0)+1 OR NEW.revision>20 OR (NEW.input->>'revision')::integer<>NEW.revision-1
 OR action IS NULL OR action NOT IN ('withdraw','transmitted','accepted','declined','issued') THEN
  RAISE EXCEPTION 'invalid conclusion action revision' USING ERRCODE='23514';
 END IF;
 IF action='withdraw' THEN
  IF EXISTS(SELECT 1 FROM partner_offer_signatures WHERE conclusion_id=c.id) OR previous_revision IS NOT NULL THEN
   RAISE EXCEPTION 'signature cannot be withdrawn' USING ERRCODE='23514';
  END IF;
 ELSE
  IF c.invalidated_at IS NOT NULL OR c.withdrawn_at IS NOT NULL
  OR NOT EXISTS(SELECT 1 FROM partner_offer_signatures WHERE conclusion_id=c.id)
  OR NEW.input->'verified' IS DISTINCT FROM 'true'::jsonb
  OR (action='transmitted' AND previous_action IS NOT NULL)
  OR (action IN ('accepted','declined') AND previous_action IS DISTINCT FROM 'transmitted')
  OR (action='issued' AND previous_action IS DISTINCT FROM 'accepted') THEN
   RAISE EXCEPTION 'invalid conclusion transition' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_conclusion_action_guard BEFORE INSERT ON partner_conclusion_actions FOR EACH ROW EXECUTE FUNCTION partner_conclusion_action_guard();
--> statement-breakpoint
CREATE FUNCTION partner_conclusion_invalidate(lead_key text,all_signed boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 UPDATE partner_conclusions c SET invalidated_at=clock_timestamp() WHERE c.lead_id=lead_key AND c.invalidated_at IS NULL
 AND (all_signed OR NOT EXISTS(SELECT 1 FROM partner_offer_signatures s WHERE s.conclusion_id=c.id));
 UPDATE partner_notifications n SET resolved_at=clock_timestamp() WHERE n.lead_id=lead_key AND n.kind='conclusion.prepared.v1' AND n.resolved_at IS NULL;
END $$;
--> statement-breakpoint
CREATE FUNCTION partner_conclusion_lead_context() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW.client_user_id,NEW.client_profile_id) IS DISTINCT FROM ROW(OLD.client_user_id,OLD.client_profile_id) THEN
  PERFORM partner_conclusion_invalidate(NEW.id,true);
 ELSIF ROW(NEW.responsible_id,NEW.assignment,NEW.notification_cycle,NEW.advice_scope_revision,NEW.market_valid_until)
 IS DISTINCT FROM ROW(OLD.responsible_id,OLD.assignment,OLD.notification_cycle,OLD.advice_scope_revision,OLD.market_valid_until) THEN
  PERFORM partner_conclusion_invalidate(NEW.id,false);
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_conclusion_lead_context BEFORE UPDATE ON partner_leads FOR EACH ROW EXECUTE FUNCTION partner_conclusion_lead_context();
--> statement-breakpoint
CREATE FUNCTION partner_conclusion_profile_context() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE lead_key text;
BEGIN
 IF to_jsonb(NEW)=to_jsonb(OLD) THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='managed_profiles' THEN
  FOR lead_key IN SELECT id FROM partner_leads WHERE client_profile_id=NEW.id ORDER BY id FOR UPDATE LOOP
   PERFORM partner_conclusion_invalidate(lead_key,NEW.user_id IS DISTINCT FROM OLD.user_id);
  END LOOP;
 ELSE
  FOR lead_key IN SELECT id FROM partner_leads WHERE client_profile_id IS NULL AND client_user_id=NEW.user_id ORDER BY id FOR UPDATE LOOP
   PERFORM partner_conclusion_invalidate(lead_key,false);
  END LOOP;
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_conclusion_profile_context AFTER UPDATE ON managed_profiles FOR EACH ROW EXECUTE FUNCTION partner_conclusion_profile_context();
--> statement-breakpoint
CREATE TRIGGER partner_conclusion_identity_context AFTER UPDATE ON identity_profiles FOR EACH ROW EXECUTE FUNCTION partner_conclusion_profile_context();
--> statement-breakpoint
CREATE FUNCTION partner_conclusion_choice_context() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.kind IN ('client.select','client.refuse','client.keep_current','client.modification') THEN
  PERFORM partner_conclusion_invalidate(NEW.lead_id,false);
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_conclusion_choice_context AFTER INSERT ON partner_events FOR EACH ROW EXECUTE FUNCTION partner_conclusion_choice_context();
--> statement-breakpoint
CREATE FUNCTION partner_conclusion_source_context() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE document_key text; lead_key text;
BEGIN
 IF TG_TABLE_NAME='files' THEN
  IF ROW(NEW.checksum,NEW.generation,NEW.analysis,NEW.category,NEW.category_corrected,NEW.deleted_at,NEW.scan_version,NEW.state)
  IS NOT DISTINCT FROM ROW(OLD.checksum,OLD.generation,OLD.analysis,OLD.category,OLD.category_corrected,OLD.deleted_at,OLD.scan_version,OLD.state) THEN RETURN NEW; END IF;
  document_key=NEW.id;
 ELSE document_key=NEW.document_id;
 END IF;
 FOR lead_key IN SELECT DISTINCT c.lead_id FROM partner_conclusions c JOIN partner_offers o ON o.id=c.offer_id WHERE o.document_id=document_key ORDER BY c.lead_id LOOP
  PERFORM partner_conclusion_invalidate(lead_key,true);
 END LOOP;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_conclusion_source_context AFTER UPDATE ON files FOR EACH ROW EXECUTE FUNCTION partner_conclusion_source_context();
--> statement-breakpoint
CREATE TRIGGER partner_conclusion_correction_context AFTER INSERT ON document_field_corrections FOR EACH ROW EXECUTE FUNCTION partner_conclusion_source_context();
--> statement-breakpoint
CREATE TRIGGER partner_conclusion_decision_context AFTER INSERT ON document_decisions FOR EACH ROW EXECUTE FUNCTION partner_conclusion_source_context();

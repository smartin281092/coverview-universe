CREATE TABLE "partner_lead_relationships" (
	"id" text PRIMARY KEY NOT NULL,
	"source_lead_id" text NOT NULL,
	"target_lead_id" text NOT NULL,
	"source_revision" integer NOT NULL,
	"target_revision" integer NOT NULL,
	"owner_id" text NOT NULL,
	"subject_key" text NOT NULL,
	"actor_id" text NOT NULL,
	"kind" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"invalidated_at" timestamp (3) with time zone,
	"withdrawn_at" timestamp (3) with time zone,
	"withdrawn_by" text,
	"withdrawal_reason" text,
	CONSTRAINT "partner_relationship_shape" CHECK ("partner_lead_relationships"."source_lead_id"<>"partner_lead_relationships"."target_lead_id" and "partner_lead_relationships"."source_revision">=0 and "partner_lead_relationships"."target_revision">=0 and "partner_lead_relationships"."kind" in ('related','duplicate') and length(trim("partner_lead_relationships"."reason")) between 5 and 2000),
	CONSTRAINT "partner_relationship_withdrawal" CHECK (("partner_lead_relationships"."withdrawn_at" is null and "partner_lead_relationships"."withdrawn_by" is null and "partner_lead_relationships"."withdrawal_reason" is null)
    or ("partner_lead_relationships"."withdrawn_at" is not null and "partner_lead_relationships"."withdrawn_by" is not null and length(trim("partner_lead_relationships"."withdrawal_reason")) between 5 and 2000))
);
--> statement-breakpoint
ALTER TABLE "partner_lead_relationships" ADD CONSTRAINT "partner_lead_relationships_source_lead_id_partner_leads_id_fk" FOREIGN KEY ("source_lead_id") REFERENCES "public"."partner_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_lead_relationships" ADD CONSTRAINT "partner_lead_relationships_target_lead_id_partner_leads_id_fk" FOREIGN KEY ("target_lead_id") REFERENCES "public"."partner_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_lead_relationships" ADD CONSTRAINT "partner_lead_relationships_owner_id_identity_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_lead_relationships" ADD CONSTRAINT "partner_lead_relationships_actor_id_identity_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_lead_relationships" ADD CONSTRAINT "partner_lead_relationships_withdrawn_by_identity_users_id_fk" FOREIGN KEY ("withdrawn_by") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "partner_relationship_source_history" ON "partner_lead_relationships" USING btree ("source_lead_id","created_at","id");--> statement-breakpoint
CREATE INDEX "partner_relationship_target_history" ON "partner_lead_relationships" USING btree ("target_lead_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_relationship_one_parent" ON "partner_lead_relationships" USING btree ("source_lead_id") WHERE "partner_lead_relationships"."withdrawn_at" is null and "partner_lead_relationships"."invalidated_at" is null;
--> statement-breakpoint
CREATE FUNCTION partner_relationship_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s partner_leads%ROWTYPE; t partner_leads%ROWTYPE; source_owner text; target_owner text; subject text;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'relationship history is retained' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' THEN
  IF (to_jsonb(NEW)-'withdrawn_at'-'withdrawn_by'-'withdrawal_reason'-'invalidated_at')
    IS DISTINCT FROM (to_jsonb(OLD)-'withdrawn_at'-'withdrawn_by'-'withdrawal_reason'-'invalidated_at')
  OR (OLD.withdrawn_at IS NOT NULL AND ROW(NEW.withdrawn_at,NEW.withdrawn_by,NEW.withdrawal_reason) IS DISTINCT FROM ROW(OLD.withdrawn_at,OLD.withdrawn_by,OLD.withdrawal_reason))
  OR (OLD.invalidated_at IS NOT NULL AND NEW.invalidated_at IS DISTINCT FROM OLD.invalidated_at) THEN
   RAISE EXCEPTION 'relationship cannot be rewritten or revived' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
 END IF;
 PERFORM id FROM partner_leads WHERE id IN (NEW.source_lead_id,NEW.target_lead_id) ORDER BY id FOR UPDATE;
 SELECT * INTO s FROM partner_leads WHERE id=NEW.source_lead_id;
 SELECT * INTO t FROM partner_leads WHERE id=NEW.target_lead_id;
 source_owner=coalesce((select user_id from managed_profiles where id=s.client_profile_id),s.client_user_id);
 target_owner=coalesce((select user_id from managed_profiles where id=t.client_profile_id),t.client_user_id);
 subject=case when s.client_profile_id is not null then 'profile:'||s.client_profile_id else 'self:'||source_owner end;
 IF s.id IS NULL OR t.id IS NULL OR s.id=t.id OR source_owner IS NULL OR source_owner IS DISTINCT FROM target_owner
 OR s.client_profile_id IS DISTINCT FROM t.client_profile_id OR NEW.owner_id<>source_owner OR NEW.subject_key<>subject
 OR NEW.source_revision<>s.revision OR NEW.target_revision<>t.revision
 OR s.stage IN ('draft','completed') OR t.stage IN ('draft','completed') OR NEW.withdrawn_at IS NOT NULL OR NEW.invalidated_at IS NOT NULL
 OR EXISTS(SELECT 1 FROM partner_lead_relationships WHERE withdrawn_at IS NULL AND invalidated_at IS NULL
   AND (source_lead_id=NEW.source_lead_id OR target_lead_id=NEW.source_lead_id OR source_lead_id=NEW.target_lead_id)) THEN
  RAISE EXCEPTION 'relationship requires current flat canonical subjects' USING ERRCODE='23514';
 END IF;
 IF NEW.kind='duplicate' AND (s.category<>t.category
  OR EXISTS(SELECT 1 FROM partner_conclusions c WHERE c.lead_id=s.id AND c.invalidated_at IS NULL AND
   (EXISTS(SELECT 1 FROM partner_offer_signatures WHERE conclusion_id=c.id) OR c.withdrawn_at IS NULL AND c.valid_until>clock_timestamp()))
  OR EXISTS(SELECT 1 FROM partner_market_reservations WHERE lead_id=s.id AND (state='accepted' OR state='reserved' AND expires_at>clock_timestamp()))
  OR EXISTS(SELECT 1 FROM partner_quality_cases q WHERE lead_id=s.id AND invalidated_at IS NULL
   AND coalesce((SELECT input->>'action' FROM partner_quality_actions WHERE case_id=q.id ORDER BY revision DESC LIMIT 1),'')<>'close')
  OR EXISTS(SELECT 1 FROM partner_collaborations WHERE lead_id=s.id AND state='proposed')) THEN
  RAISE EXCEPTION 'duplicate has protected work to resolve' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_relationship_guard BEFORE INSERT OR UPDATE OR DELETE ON partner_lead_relationships FOR EACH ROW EXECUTE FUNCTION partner_relationship_guard();
--> statement-breakpoint
CREATE FUNCTION partner_relationship_completion() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r partner_lead_relationships%ROWTYPE; l partner_leads%ROWTYPE;
BEGIN
 SELECT * INTO r FROM partner_lead_relationships WHERE id=NEW.id;
 IF r.kind<>'duplicate' OR r.invalidated_at IS NOT NULL THEN RETURN NEW; END IF;
 SELECT * INTO l FROM partner_leads WHERE id=r.source_lead_id;
 IF (r.withdrawn_at IS NULL AND (l.stage<>'completed' OR l.result IS DISTINCT FROM 'duplicate' OR l.reason IS DISTINCT FROM 'duplicate'))
 OR (TG_OP='UPDATE' AND OLD.withdrawn_at IS NULL AND r.withdrawn_at IS NOT NULL AND l.stage='completed' AND l.result='duplicate') THEN
  RAISE EXCEPTION 'duplicate link and archived reopening must commit together' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER partner_relationship_completion AFTER INSERT OR UPDATE ON partner_lead_relationships DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION partner_relationship_completion();
--> statement-breakpoint
CREATE FUNCTION partner_relationship_context() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='managed_profiles' THEN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
   UPDATE partner_lead_relationships SET invalidated_at=clock_timestamp() WHERE subject_key='profile:'||NEW.id AND invalidated_at IS NULL;
  END IF;
 ELSE
  IF ROW(NEW.client_user_id,NEW.client_profile_id) IS DISTINCT FROM ROW(OLD.client_user_id,OLD.client_profile_id) THEN
   UPDATE partner_lead_relationships SET invalidated_at=clock_timestamp() WHERE (source_lead_id=NEW.id OR target_lead_id=NEW.id) AND invalidated_at IS NULL;
  END IF;
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_relationship_profile_context AFTER UPDATE ON managed_profiles FOR EACH ROW EXECUTE FUNCTION partner_relationship_context();
--> statement-breakpoint
CREATE TRIGGER partner_relationship_lead_context AFTER UPDATE ON partner_leads FOR EACH ROW EXECUTE FUNCTION partner_relationship_context();
--> statement-breakpoint
CREATE FUNCTION partner_relationship_reopening_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.stage='completed' AND NEW.stage<>'completed' AND EXISTS(SELECT 1 FROM partner_lead_relationships
  WHERE source_lead_id=OLD.id AND kind='duplicate' AND withdrawn_at IS NULL AND invalidated_at IS NULL) THEN
  RAISE EXCEPTION 'withdraw duplicate relationship before reopening' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_relationship_reopening_guard BEFORE UPDATE ON partner_leads FOR EACH ROW EXECUTE FUNCTION partner_relationship_reopening_guard();

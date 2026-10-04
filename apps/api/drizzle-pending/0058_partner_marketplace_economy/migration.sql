CREATE TABLE "partner_commercial_conditions" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"professional_revision" integer NOT NULL,
	"declared_name" text NOT NULL,
	"declared_organization" text NOT NULL,
	"terms" jsonb NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "partner_commercial_revision" CHECK ("partner_commercial_conditions"."professional_revision">0)
);
--> statement-breakpoint
CREATE TABLE "partner_commercial_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"condition_id" text NOT NULL,
	"author_id" text NOT NULL,
	"decision" text NOT NULL,
	"reason" text NOT NULL,
	"validation_reference" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "partner_commercial_decision" CHECK ("partner_commercial_reviews"."decision" in ('approve','reject','withdraw'))
);
--> statement-breakpoint
CREATE TABLE "partner_economy_cases" (
	"id" text PRIMARY KEY NOT NULL,
	"agreement_id" text NOT NULL,
	"stream" text NOT NULL,
	"final_policy_id" text,
	"company_id" text,
	"reference" text NOT NULL,
	"scope_reference" text NOT NULL,
	"author_id" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "partner_economy_case_stream" CHECK (("partner_economy_cases"."stream"='lead_price' and "partner_economy_cases"."final_policy_id" is null and "partner_economy_cases"."company_id" is null) or ("partner_economy_cases"."stream"='contract_commission' and "partner_economy_cases"."final_policy_id" is not null and "partner_economy_cases"."company_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "partner_economy_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"revision" integer NOT NULL,
	"author_id" text NOT NULL,
	"entry" jsonb NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "partner_economy_entry_positive" CHECK ("partner_economy_entries"."revision">0)
);
--> statement-breakpoint
CREATE TABLE "partner_market_applications" (
	"id" text PRIMARY KEY NOT NULL,
	"listing_id" text NOT NULL,
	"user_id" text NOT NULL,
	"reason" text NOT NULL,
	"withdrawn_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT clock_timestamp() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partner_market_listings" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"publisher_id" text NOT NULL,
	"condition_id" text NOT NULL,
	"subject_key" text NOT NULL,
	"owner_id" text NOT NULL,
	"profile_revision" integer NOT NULL,
	"advice_scope_revision" integer NOT NULL,
	"responsible_id" text NOT NULL,
	"category" text NOT NULL,
	"publication" jsonb NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL,
	"closed_at" timestamp (3) with time zone,
	"invalidated_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "partner_market_expiry" CHECK ("partner_market_listings"."expires_at">"partner_market_listings"."created_at")
);
--> statement-breakpoint
CREATE TABLE "partner_market_mandates" (
	"id" text PRIMARY KEY NOT NULL,
	"reservation_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"profile_revision" integer NOT NULL,
	"decision" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "partner_market_mandate_decision" CHECK ("partner_market_mandates"."decision" in ('accept','decline','withdraw'))
);
--> statement-breakpoint
CREATE TABLE "partner_market_reservations" (
	"id" text PRIMARY KEY NOT NULL,
	"listing_id" text NOT NULL,
	"lead_id" text NOT NULL,
	"publisher_id" text NOT NULL,
	"target_id" text NOT NULL,
	"condition_id" text NOT NULL,
	"target_organization_id" text NOT NULL,
	"target_revision" integer NOT NULL,
	"target_name" text NOT NULL,
	"target_organization" text NOT NULL,
	"mission" jsonb NOT NULL,
	"reason" text NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL,
	"state" text DEFAULT 'reserved' NOT NULL,
	"response" text,
	"decided_at" timestamp (3) with time zone,
	"collaboration_id" text,
	"created_at" timestamp (3) with time zone DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "partner_market_reservation_state" CHECK ("partner_market_reservations"."state" in ('reserved','accepted','declined','cancelled','expired','context_changed')),
	CONSTRAINT "partner_market_parties" CHECK ("partner_market_reservations"."publisher_id"<>"partner_market_reservations"."target_id"),
	CONSTRAINT "partner_market_reservation_expiry" CHECK ("partner_market_reservations"."expires_at">"partner_market_reservations"."created_at" and "partner_market_reservations"."expires_at"<="partner_market_reservations"."created_at"+interval '24 hours')
);
--> statement-breakpoint
ALTER TABLE "partner_contributors" ADD COLUMN "market_mandate_id" text;--> statement-breakpoint
ALTER TABLE "partner_contributors" ADD COLUMN "market_valid_until" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "partner_leads" ADD COLUMN "market_mandate_id" text;--> statement-breakpoint
ALTER TABLE "partner_leads" ADD COLUMN "market_valid_until" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "partner_commercial_conditions" ADD CONSTRAINT "partner_commercial_conditions_owner_id_identity_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_commercial_conditions" ADD CONSTRAINT "partner_commercial_conditions_organization_id_partner_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."partner_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_commercial_reviews" ADD CONSTRAINT "partner_commercial_reviews_condition_id_partner_commercial_conditions_id_fk" FOREIGN KEY ("condition_id") REFERENCES "public"."partner_commercial_conditions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_commercial_reviews" ADD CONSTRAINT "partner_commercial_reviews_author_id_identity_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_economy_cases" ADD CONSTRAINT "partner_economy_cases_agreement_id_partner_market_reservations_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."partner_market_reservations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_economy_cases" ADD CONSTRAINT "partner_economy_cases_final_policy_id_partner_final_policies_id_fk" FOREIGN KEY ("final_policy_id") REFERENCES "public"."partner_final_policies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_economy_cases" ADD CONSTRAINT "partner_economy_cases_author_id_identity_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_economy_entries" ADD CONSTRAINT "partner_economy_entries_case_id_partner_economy_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."partner_economy_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_economy_entries" ADD CONSTRAINT "partner_economy_entries_author_id_identity_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_market_applications" ADD CONSTRAINT "partner_market_applications_listing_id_partner_market_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."partner_market_listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_market_applications" ADD CONSTRAINT "partner_market_applications_user_id_identity_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_market_listings" ADD CONSTRAINT "partner_market_listings_lead_id_partner_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."partner_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_market_listings" ADD CONSTRAINT "partner_market_listings_publisher_id_identity_users_id_fk" FOREIGN KEY ("publisher_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_market_listings" ADD CONSTRAINT "partner_market_listings_condition_id_partner_commercial_conditions_id_fk" FOREIGN KEY ("condition_id") REFERENCES "public"."partner_commercial_conditions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_market_listings" ADD CONSTRAINT "partner_market_listings_owner_id_identity_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_market_listings" ADD CONSTRAINT "partner_market_listings_responsible_id_identity_users_id_fk" FOREIGN KEY ("responsible_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_market_mandates" ADD CONSTRAINT "partner_market_mandates_reservation_id_partner_market_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."partner_market_reservations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_market_mandates" ADD CONSTRAINT "partner_market_mandates_owner_id_identity_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_market_reservations" ADD CONSTRAINT "partner_market_reservations_listing_id_partner_market_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."partner_market_listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_market_reservations" ADD CONSTRAINT "partner_market_reservations_lead_id_partner_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."partner_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_market_reservations" ADD CONSTRAINT "partner_market_reservations_publisher_id_identity_users_id_fk" FOREIGN KEY ("publisher_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_market_reservations" ADD CONSTRAINT "partner_market_reservations_target_id_identity_users_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_market_reservations" ADD CONSTRAINT "partner_market_reservations_condition_id_partner_commercial_conditions_id_fk" FOREIGN KEY ("condition_id") REFERENCES "public"."partner_commercial_conditions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_market_reservations" ADD CONSTRAINT "partner_market_reservations_target_organization_id_partner_organizations_id_fk" FOREIGN KEY ("target_organization_id") REFERENCES "public"."partner_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_market_reservations" ADD CONSTRAINT "partner_market_reservations_collaboration_id_partner_collaborations_id_fk" FOREIGN KEY ("collaboration_id") REFERENCES "public"."partner_collaborations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "partner_commercial_owner" ON "partner_commercial_conditions" USING btree ("owner_id","created_at","id");--> statement-breakpoint
CREATE INDEX "partner_commercial_review" ON "partner_commercial_reviews" USING btree ("condition_id","created_at","id");--> statement-breakpoint
CREATE INDEX "partner_economy_agreement" ON "partner_economy_cases" USING btree ("agreement_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_economy_fixed_unique" ON "partner_economy_cases" USING btree ("agreement_id") WHERE "partner_economy_cases"."stream"='lead_price';--> statement-breakpoint
CREATE UNIQUE INDEX "partner_economy_contract_unique" ON "partner_economy_cases" USING btree ("agreement_id","final_policy_id") WHERE "partner_economy_cases"."stream"='contract_commission';--> statement-breakpoint
CREATE UNIQUE INDEX "partner_economy_entry_revision" ON "partner_economy_entries" USING btree ("case_id","revision");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_market_application_unique" ON "partner_market_applications" USING btree ("listing_id","user_id");--> statement-breakpoint
CREATE INDEX "partner_market_applicant" ON "partner_market_applications" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "partner_market_feed" ON "partner_market_listings" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "partner_market_lead" ON "partner_market_listings" USING btree ("lead_id");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_market_one_open" ON "partner_market_listings" USING btree ("lead_id") WHERE "partner_market_listings"."closed_at" is null and "partner_market_listings"."invalidated_at" is null;--> statement-breakpoint
CREATE INDEX "partner_market_mandate" ON "partner_market_mandates" USING btree ("reservation_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_market_one_reservation" ON "partner_market_reservations" USING btree ("lead_id") WHERE "partner_market_reservations"."state"='reserved';--> statement-breakpoint
CREATE INDEX "partner_market_target" ON "partner_market_reservations" USING btree ("target_id","created_at","id");
--> statement-breakpoint
-- Hand-written integrity guards; Drizzle snapshot above describes the additive catalogue.
CREATE FUNCTION partner_economy_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Immutable commercial evidence' USING ERRCODE='23514'; END $$;
--> statement-breakpoint
CREATE TRIGGER partner_commercial_immutable BEFORE UPDATE OR DELETE ON partner_commercial_conditions FOR EACH ROW EXECUTE FUNCTION partner_economy_immutable();
--> statement-breakpoint
CREATE TRIGGER partner_commercial_review_immutable BEFORE UPDATE OR DELETE ON partner_commercial_reviews FOR EACH ROW EXECUTE FUNCTION partner_economy_immutable();
--> statement-breakpoint
CREATE FUNCTION partner_commercial_review_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE previous_decision text;
BEGIN
 PERFORM id FROM partner_commercial_conditions WHERE id=NEW.condition_id FOR UPDATE;
 SELECT decision INTO previous_decision FROM partner_commercial_reviews WHERE condition_id=NEW.condition_id ORDER BY created_at DESC,id DESC LIMIT 1;
 IF previous_decision IS NOT NULL AND (previous_decision<>'approve' OR NEW.decision<>'withdraw') THEN RAISE EXCEPTION 'Commercial review is terminal' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_commercial_review_transition BEFORE INSERT ON partner_commercial_reviews FOR EACH ROW EXECUTE FUNCTION partner_commercial_review_guard();
--> statement-breakpoint
CREATE TRIGGER partner_market_mandate_immutable BEFORE UPDATE OR DELETE ON partner_market_mandates FOR EACH ROW EXECUTE FUNCTION partner_economy_immutable();
--> statement-breakpoint
CREATE TRIGGER partner_economy_case_immutable BEFORE UPDATE OR DELETE ON partner_economy_cases FOR EACH ROW EXECUTE FUNCTION partner_economy_immutable();
--> statement-breakpoint
CREATE TRIGGER partner_economy_entry_immutable BEFORE UPDATE OR DELETE ON partner_economy_entries FOR EACH ROW EXECUTE FUNCTION partner_economy_immutable();
--> statement-breakpoint
CREATE FUNCTION partner_market_history_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Market history cannot be deleted' USING ERRCODE='23514'; END IF;
 IF TG_TABLE_NAME='partner_market_listings' THEN
  IF (to_jsonb(NEW)-ARRAY['closed_at','invalidated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['closed_at','invalidated_at'])
   OR (OLD.closed_at IS NOT NULL AND NEW.closed_at IS DISTINCT FROM OLD.closed_at)
   OR (OLD.invalidated_at IS NOT NULL AND NEW.invalidated_at IS DISTINCT FROM OLD.invalidated_at)
   THEN RAISE EXCEPTION 'Immutable publication' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='partner_market_applications' THEN
  IF (to_jsonb(NEW)-'withdrawn_at') IS DISTINCT FROM (to_jsonb(OLD)-'withdrawn_at') OR (OLD.withdrawn_at IS NOT NULL AND NEW.withdrawn_at IS DISTINCT FROM OLD.withdrawn_at)
   THEN RAISE EXCEPTION 'Immutable application' USING ERRCODE='23514'; END IF;
 ELSE
  IF (to_jsonb(NEW)-ARRAY['state','response','decided_at','collaboration_id']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','response','decided_at','collaboration_id'])
   OR OLD.state<>'reserved' OR NEW.state='reserved' OR NEW.decided_at IS NULL
   OR ((NEW.state='accepted') IS DISTINCT FROM (NEW.collaboration_id IS NOT NULL))
   THEN RAISE EXCEPTION 'Immutable reservation or agreement' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_market_listing_history BEFORE UPDATE OR DELETE ON partner_market_listings FOR EACH ROW EXECUTE FUNCTION partner_market_history_guard();
--> statement-breakpoint
CREATE TRIGGER partner_market_application_history BEFORE UPDATE OR DELETE ON partner_market_applications FOR EACH ROW EXECUTE FUNCTION partner_market_history_guard();
--> statement-breakpoint
CREATE TRIGGER partner_market_reservation_history BEFORE UPDATE OR DELETE ON partner_market_reservations FOR EACH ROW EXECUTE FUNCTION partner_market_history_guard();
--> statement-breakpoint
CREATE FUNCTION partner_market_reservation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE listing partner_market_listings; authority partner_market_mandates;
BEGIN
 SELECT * INTO listing FROM partner_market_listings WHERE id=NEW.listing_id FOR UPDATE;
 IF NEW.lead_id<>listing.lead_id OR NEW.publisher_id<>listing.publisher_id OR NEW.condition_id<>listing.condition_id
 THEN RAISE EXCEPTION 'Reservation context mismatch' USING ERRCODE='23514'; END IF;
 IF TG_OP='INSERT' OR NEW.state='accepted' THEN
  IF listing.closed_at IS NOT NULL OR listing.invalidated_at IS NOT NULL OR listing.expires_at<=clock_timestamp() OR NEW.expires_at<=clock_timestamp()
   OR (NEW.mission->>'validUntil')::timestamptz<=NEW.expires_at
   THEN RAISE EXCEPTION 'Reservation expired or changed' USING ERRCODE='23514'; END IF;
 END IF;
 IF TG_OP='UPDATE' AND NEW.state='accepted' THEN
  SELECT * INTO authority FROM partner_market_mandates WHERE reservation_id=NEW.id ORDER BY created_at DESC,id DESC LIMIT 1;
  IF authority.decision IS DISTINCT FROM 'accept' OR authority.owner_id IS DISTINCT FROM listing.owner_id OR authority.profile_revision IS DISTINCT FROM listing.profile_revision
   OR NOT EXISTS(SELECT 1 FROM partner_collaborations WHERE id=NEW.collaboration_id AND lead_id=NEW.lead_id AND target_id=NEW.target_id AND proposer_id=NEW.publisher_id)
   THEN RAISE EXCEPTION 'Exact current mandate required' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_market_reservation_context BEFORE INSERT OR UPDATE ON partner_market_reservations FOR EACH ROW EXECUTE FUNCTION partner_market_reservation_guard();
--> statement-breakpoint
CREATE FUNCTION partner_market_lead_context() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW.client_user_id,NEW.client_profile_id,NEW.category,NEW.advice_scope_revision,NEW.responsible_id) IS DISTINCT FROM ROW(OLD.client_user_id,OLD.client_profile_id,OLD.category,OLD.advice_scope_revision,OLD.responsible_id)
  OR (NEW.stage IN ('draft','completed') AND OLD.stage IS DISTINCT FROM NEW.stage) THEN
  UPDATE partner_market_listings SET invalidated_at=clock_timestamp() WHERE lead_id=OLD.id AND invalidated_at IS NULL;
  UPDATE partner_market_reservations SET state='context_changed',decided_at=clock_timestamp() WHERE lead_id=OLD.id AND state='reserved';
 END IF;
 IF ROW(NEW.client_user_id,NEW.client_profile_id,NEW.category,NEW.advice_scope_revision) IS DISTINCT FROM ROW(OLD.client_user_id,OLD.client_profile_id,OLD.category,OLD.advice_scope_revision) THEN
  UPDATE partner_contributors SET revoked_at=clock_timestamp() WHERE lead_id=OLD.id AND market_mandate_id IS NOT NULL AND revoked_at IS NULL;
  IF OLD.market_mandate_id IS NOT NULL THEN NEW.responsible_id=NULL;NEW.assignment='reassign'; END IF;
 END IF;
 IF NEW.responsible_id IS DISTINCT FROM OLD.responsible_id AND NEW.market_mandate_id IS NOT DISTINCT FROM OLD.market_mandate_id THEN
  NEW.market_mandate_id=NULL;NEW.market_valid_until=NULL;
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_market_lead_context BEFORE UPDATE ON partner_leads FOR EACH ROW EXECUTE FUNCTION partner_market_lead_context();
--> statement-breakpoint
CREATE FUNCTION partner_market_profile_context() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW.user_id,NEW.revision) IS DISTINCT FROM ROW(OLD.user_id,OLD.revision) THEN
  UPDATE partner_market_listings SET invalidated_at=clock_timestamp() WHERE subject_key='profile:'||OLD.id AND invalidated_at IS NULL;
  UPDATE partner_market_reservations SET state='context_changed',decided_at=clock_timestamp() WHERE state='reserved' AND lead_id IN (SELECT id FROM partner_leads WHERE client_profile_id=OLD.id);
  UPDATE partner_contributors SET revoked_at=clock_timestamp() WHERE market_mandate_id IS NOT NULL AND revoked_at IS NULL AND lead_id IN (SELECT id FROM partner_leads WHERE client_profile_id=OLD.id);
  UPDATE partner_leads SET responsible_id=NULL,assignment='reassign',revision=revision+1 WHERE client_profile_id=OLD.id AND market_mandate_id IS NOT NULL;
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_market_profile_context AFTER UPDATE ON managed_profiles FOR EACH ROW EXECUTE FUNCTION partner_market_profile_context();
--> statement-breakpoint
CREATE FUNCTION partner_market_member_context() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW.professional_revision,NEW.organization_id,NEW.state) IS DISTINCT FROM ROW(OLD.professional_revision,OLD.organization_id,OLD.state) THEN
  UPDATE partner_market_listings SET invalidated_at=clock_timestamp() WHERE publisher_id=OLD.user_id AND invalidated_at IS NULL;
  UPDATE partner_market_reservations SET state='context_changed',decided_at=clock_timestamp() WHERE state='reserved' AND (publisher_id=OLD.user_id OR target_id=OLD.user_id);
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_market_member_context AFTER UPDATE ON partner_members FOR EACH ROW EXECUTE FUNCTION partner_market_member_context();
--> statement-breakpoint
CREATE FUNCTION partner_economy_insert_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE agreement partner_market_reservations; previous_revision integer;
BEGIN
 IF TG_TABLE_NAME='partner_economy_cases' THEN
  SELECT * INTO agreement FROM partner_market_reservations WHERE id=NEW.agreement_id;
  IF agreement.state IS DISTINCT FROM 'accepted' OR (NEW.final_policy_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM partner_final_policies WHERE id=NEW.final_policy_id AND lead_id=agreement.lead_id AND active AND source_snapshot#>>'{candidate,facts,companyId}'=NEW.company_id))
  THEN RAISE EXCEPTION 'Accepted agreement and exact contract required' USING ERRCODE='23514'; END IF;
 ELSE
  PERFORM id FROM partner_economy_cases WHERE id=NEW.case_id FOR UPDATE;
  SELECT coalesce(max(revision),0) INTO previous_revision FROM partner_economy_entries WHERE case_id=NEW.case_id;
  IF NEW.revision<>previous_revision+1 THEN RAISE EXCEPTION 'Non sequential financial entry' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_economy_case_context BEFORE INSERT ON partner_economy_cases FOR EACH ROW EXECUTE FUNCTION partner_economy_insert_guard();
--> statement-breakpoint
CREATE TRIGGER partner_economy_entry_context BEFORE INSERT ON partner_economy_entries FOR EACH ROW EXECUTE FUNCTION partner_economy_insert_guard();

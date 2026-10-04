CREATE TABLE "partner_evaluation_contests" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"subject_kind" text NOT NULL,
	"subject_id" text NOT NULL,
	"reason" text NOT NULL,
	"decision" text,
	"decision_reason" text,
	"decided_by" text,
	"decided_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_evaluation_contest_shape" CHECK ("partner_evaluation_contests"."subject_kind" in ('survey','quality_case') and length(trim("partner_evaluation_contests"."reason")) between 10 and 2000 and (("partner_evaluation_contests"."decision" is null and "partner_evaluation_contests"."decision_reason" is null and "partner_evaluation_contests"."decided_by" is null and "partner_evaluation_contests"."decided_at" is null) or ("partner_evaluation_contests"."decision" in ('accepted','rejected') and length(trim("partner_evaluation_contests"."decision_reason")) between 5 and 2000 and "partner_evaluation_contests"."decided_by" is not null and "partner_evaluation_contests"."decided_by"<>"partner_evaluation_contests"."user_id" and "partner_evaluation_contests"."decided_at" is not null)))
);
--> statement-breakpoint
CREATE TABLE "partner_profile_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"version_id" text NOT NULL,
	"decision" text NOT NULL,
	"reason" text NOT NULL,
	"decided_by" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_profile_review_shape" CHECK ("partner_profile_reviews"."decision" in ('published','rejected','withdrawn') and length(trim("partner_profile_reviews"."reason")) between 5 and 2000)
);
--> statement-breakpoint
CREATE TABLE "partner_profile_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"revision" integer NOT NULL,
	"professional_revision" integer NOT NULL,
	"declared_name" text NOT NULL,
	"declared_organization" text NOT NULL,
	"presentation" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_profile_shape" CHECK ("partner_profile_versions"."revision">0 and "partner_profile_versions"."professional_revision">0 and length(trim("partner_profile_versions"."presentation")) between 40 and 1200 and length(trim("partner_profile_versions"."declared_name")) between 2 and 160 and length(trim("partner_profile_versions"."declared_organization")) between 2 and 160)
);
--> statement-breakpoint
CREATE TABLE "partner_survey_attributions" (
	"survey_id" text PRIMARY KEY NOT NULL,
	"advisor_id" text,
	"referrer_id" text,
	"category" text NOT NULL,
	"backfilled" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_survey_attribution_backfill" CHECK ("partner_survey_attributions"."backfilled" in (0,1))
);
--> statement-breakpoint
ALTER TABLE "partner_evaluation_contests" ADD CONSTRAINT "partner_evaluation_contests_user_id_identity_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_evaluation_contests" ADD CONSTRAINT "partner_evaluation_contests_decided_by_identity_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_profile_reviews" ADD CONSTRAINT "partner_profile_reviews_version_id_partner_profile_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."partner_profile_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_profile_reviews" ADD CONSTRAINT "partner_profile_reviews_decided_by_identity_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_profile_versions" ADD CONSTRAINT "partner_profile_versions_user_id_partner_members_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."partner_members"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_profile_versions" ADD CONSTRAINT "partner_profile_versions_organization_id_partner_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."partner_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_survey_attributions" ADD CONSTRAINT "partner_survey_attributions_survey_id_partner_surveys_id_fk" FOREIGN KEY ("survey_id") REFERENCES "public"."partner_surveys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_survey_attributions" ADD CONSTRAINT "partner_survey_attributions_advisor_id_identity_users_id_fk" FOREIGN KEY ("advisor_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_survey_attributions" ADD CONSTRAINT "partner_survey_attributions_referrer_id_identity_users_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "partner_evaluation_contest_user" ON "partner_evaluation_contests" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_evaluation_contest_open" ON "partner_evaluation_contests" USING btree ("user_id","subject_kind","subject_id") WHERE "partner_evaluation_contests"."decision" is null;--> statement-breakpoint
CREATE INDEX "partner_profile_review_version" ON "partner_profile_reviews" USING btree ("version_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_profile_revision" ON "partner_profile_versions" USING btree ("user_id","revision");--> statement-breakpoint
CREATE INDEX "partner_survey_attribution_advisor" ON "partner_survey_attributions" USING btree ("advisor_id","created_at");--> statement-breakpoint
-- Profile versions, their reviews and survey attributions are evidence: append-only.
CREATE FUNCTION partner_profile_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'profile and evaluation evidence is immutable' USING ERRCODE='23514';
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_profile_versions_immutable BEFORE UPDATE OR DELETE ON partner_profile_versions FOR EACH ROW EXECUTE FUNCTION partner_profile_immutable();
--> statement-breakpoint
CREATE TRIGGER partner_profile_reviews_immutable BEFORE UPDATE OR DELETE ON partner_profile_reviews FOR EACH ROW EXECUTE FUNCTION partner_profile_immutable();
--> statement-breakpoint
CREATE TRIGGER partner_survey_attributions_immutable BEFORE UPDATE OR DELETE ON partner_survey_attributions FOR EACH ROW EXECUTE FUNCTION partner_profile_immutable();
--> statement-breakpoint
-- Only CoverView publishes or refuses someone else's version; only the person withdraws it.
CREATE FUNCTION partner_profile_review_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner text;
BEGIN
 SELECT user_id INTO owner FROM partner_profile_versions WHERE id=NEW.version_id;
 IF (NEW.decision='withdrawn') <> (NEW.decided_by=owner) THEN
  RAISE EXCEPTION 'invalid profile review author' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_profile_review_guard BEFORE INSERT ON partner_profile_reviews FOR EACH ROW EXECUTE FUNCTION partner_profile_review_guard();
--> statement-breakpoint
-- A contest is decided once; nothing else about it can change and it is never deleted.
CREATE FUNCTION partner_evaluation_contest_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.decision IS NULL AND NEW.decision IS NOT NULL
  AND (to_jsonb(NEW)-'decision'-'decision_reason'-'decided_by'-'decided_at')=(to_jsonb(OLD)-'decision'-'decision_reason'-'decided_by'-'decided_at') THEN
  RETURN NEW;
 END IF;
 RAISE EXCEPTION 'evaluation contest cannot be rewritten' USING ERRCODE='23514';
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_evaluation_contest_guard BEFORE UPDATE OR DELETE ON partner_evaluation_contests FOR EACH ROW EXECUTE FUNCTION partner_evaluation_contest_guard();
--> statement-breakpoint
-- Freeze who served the client when the survey is created, so a later transfer never moves it.
CREATE FUNCTION partner_survey_attribute() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO partner_survey_attributions(survey_id,advisor_id,referrer_id,category)
 SELECT NEW.id,l.responsible_id,l.creator_id,l.category FROM partner_leads l WHERE l.id=NEW.lead_id;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_survey_attribute AFTER INSERT ON partner_surveys FOR EACH ROW EXECUTE FUNCTION partner_survey_attribute();
--> statement-breakpoint
-- Surveys created before this migration: best effort from the current Lead, flagged as backfilled.
INSERT INTO partner_survey_attributions(survey_id,advisor_id,referrer_id,category,backfilled)
SELECT s.id,l.responsible_id,l.creator_id,l.category,1 FROM partner_surveys s JOIN partner_leads l ON l.id=s.lead_id
WHERE NOT EXISTS(SELECT 1 FROM partner_survey_attributions a WHERE a.survey_id=s.id);

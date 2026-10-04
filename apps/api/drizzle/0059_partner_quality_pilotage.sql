CREATE TABLE "partner_communication_preferences" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"subject_key" text NOT NULL,
	"owner_id" text NOT NULL,
	"revision" integer NOT NULL,
	"input" jsonb NOT NULL,
	"invalidated_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_communication_preference_positive" CHECK ("partner_communication_preferences"."revision">0)
);
--> statement-breakpoint
CREATE TABLE "partner_communication_records" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"owner_id" text,
	"invalidated_at" timestamp (3) with time zone,
	"author_id" text NOT NULL,
	"subject_key" text NOT NULL,
	"input" jsonb NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partner_recording_decisions" (
	"id" text PRIMARY KEY NOT NULL,
	"request_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"revision" integer NOT NULL,
	"decision" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_recording_decision_values" CHECK ("partner_recording_decisions"."revision">0 and "partner_recording_decisions"."decision" in ('allow','decline','withdraw'))
);
--> statement-breakpoint
CREATE TABLE "partner_recording_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"advisor_id" text NOT NULL,
	"advisor_revision" integer NOT NULL,
	"owner_id" text NOT NULL,
	"subject_key" text NOT NULL,
	"scope_revision" integer NOT NULL,
	"input" jsonb NOT NULL,
	"invalidated_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partner_transcript_accesses" (
	"id" text PRIMARY KEY NOT NULL,
	"request_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partner_transcript_actions" (
	"id" text PRIMARY KEY NOT NULL,
	"version_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"segment_index" integer NOT NULL,
	"quote" text NOT NULL,
	"task_id" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_transcript_segment" CHECK ("partner_transcript_actions"."segment_index" between 0 and 99)
);
--> statement-breakpoint
CREATE TABLE "partner_transcripts" (
	"id" text PRIMARY KEY NOT NULL,
	"request_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"revision" integer NOT NULL,
	"input" jsonb NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_transcript_positive" CHECK ("partner_transcripts"."revision">0)
);
--> statement-breakpoint
CREATE TABLE "partner_goal_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"goal_id" text NOT NULL,
	"revision" integer NOT NULL,
	"author_id" text NOT NULL,
	"input" jsonb NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_goal_revision" CHECK ("partner_goal_versions"."revision">0)
);
--> statement-breakpoint
CREATE TABLE "partner_goals" (
	"id" text PRIMARY KEY NOT NULL,
	"creator_id" text NOT NULL,
	"scope_kind" text NOT NULL,
	"organization_id" text,
	"user_ids" jsonb NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_goal_scope" CHECK ("partner_goals"."scope_kind" in ('individual','team','organization','network'))
);
--> statement-breakpoint
CREATE TABLE "partner_quality_actions" (
	"id" text PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"revision" integer NOT NULL,
	"actor_id" text NOT NULL,
	"input" jsonb NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_quality_action_positive" CHECK ("partner_quality_actions"."revision">0)
);
--> statement-breakpoint
CREATE TABLE "partner_quality_cases" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"subject_key" text NOT NULL,
	"owner_id" text,
	"invalidated_at" timestamp (3) with time zone,
	"author_id" text NOT NULL,
	"survey_id" text,
	"kind" text NOT NULL,
	"summary" text NOT NULL,
	"priority" text NOT NULL,
	"audience" text NOT NULL,
	"due_at" timestamp (3) with time zone NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_quality_values" CHECK ("partner_quality_cases"."kind" in ('complaint','callback','verification','corrective_action') and "partner_quality_cases"."priority" in ('normal','high','urgent') and "partner_quality_cases"."audience" in ('client','coverview'))
);
--> statement-breakpoint
CREATE TABLE "partner_quality_settings" (
	"revision" integer PRIMARY KEY NOT NULL,
	"actor_id" text NOT NULL,
	"input" jsonb NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_quality_settings_revision" CHECK ("partner_quality_settings"."revision">0)
);
--> statement-breakpoint
CREATE TABLE "partner_survey_responses" (
	"survey_id" text PRIMARY KEY NOT NULL,
	"actor_id" text NOT NULL,
	"response" jsonb NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_survey_response_branch" CHECK (coalesce(jsonb_typeof("partner_survey_responses"."response")='object' and ("partner_survey_responses"."response"->>'rating')::integer between 1 and 5 and jsonb_typeof("partner_survey_responses"."response"->'positives')='array' and jsonb_typeof("partner_survey_responses"."response"->'improvements')='array' and "partner_survey_responses"."response"->'confirmed'='true'::jsonb and (("partner_survey_responses"."response"->>'rating')::integer=5 and jsonb_array_length("partner_survey_responses"."response"->'improvements')=0 and "partner_survey_responses"."response"->'callbackRequested'='false'::jsonb or ("partner_survey_responses"."response"->>'rating')::integer<5 and jsonb_array_length("partner_survey_responses"."response"->'positives')=0),false))
);
--> statement-breakpoint
CREATE TABLE "partner_surveys" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"subject_key" text NOT NULL,
	"owner_id" text NOT NULL,
	"completed_at" timestamp (3) with time zone NOT NULL,
	"invalidated_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "partner_communication_preferences" ADD CONSTRAINT "partner_communication_preferences_lead_id_partner_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."partner_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_communication_preferences" ADD CONSTRAINT "partner_communication_preferences_owner_id_identity_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_communication_records" ADD CONSTRAINT "partner_communication_records_lead_id_partner_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."partner_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_communication_records" ADD CONSTRAINT "partner_communication_records_owner_id_identity_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_communication_records" ADD CONSTRAINT "partner_communication_records_author_id_identity_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_recording_decisions" ADD CONSTRAINT "partner_recording_decisions_request_id_partner_recording_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."partner_recording_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_recording_decisions" ADD CONSTRAINT "partner_recording_decisions_actor_id_identity_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_recording_requests" ADD CONSTRAINT "partner_recording_requests_lead_id_partner_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."partner_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_recording_requests" ADD CONSTRAINT "partner_recording_requests_advisor_id_identity_users_id_fk" FOREIGN KEY ("advisor_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_recording_requests" ADD CONSTRAINT "partner_recording_requests_owner_id_identity_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_transcript_accesses" ADD CONSTRAINT "partner_transcript_accesses_request_id_partner_recording_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."partner_recording_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_transcript_accesses" ADD CONSTRAINT "partner_transcript_accesses_actor_id_identity_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_transcript_actions" ADD CONSTRAINT "partner_transcript_actions_version_id_partner_transcripts_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."partner_transcripts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_transcript_actions" ADD CONSTRAINT "partner_transcript_actions_actor_id_identity_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_transcript_actions" ADD CONSTRAINT "partner_transcript_actions_task_id_partner_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."partner_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_transcripts" ADD CONSTRAINT "partner_transcripts_request_id_partner_recording_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."partner_recording_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_transcripts" ADD CONSTRAINT "partner_transcripts_actor_id_identity_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_goal_versions" ADD CONSTRAINT "partner_goal_versions_goal_id_partner_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."partner_goals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_goal_versions" ADD CONSTRAINT "partner_goal_versions_author_id_identity_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_goals" ADD CONSTRAINT "partner_goals_creator_id_identity_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_goals" ADD CONSTRAINT "partner_goals_organization_id_partner_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."partner_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_quality_actions" ADD CONSTRAINT "partner_quality_actions_case_id_partner_quality_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."partner_quality_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_quality_actions" ADD CONSTRAINT "partner_quality_actions_actor_id_identity_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_quality_cases" ADD CONSTRAINT "partner_quality_cases_lead_id_partner_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."partner_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_quality_cases" ADD CONSTRAINT "partner_quality_cases_owner_id_identity_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_quality_cases" ADD CONSTRAINT "partner_quality_cases_author_id_identity_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_quality_cases" ADD CONSTRAINT "partner_quality_cases_survey_id_partner_surveys_id_fk" FOREIGN KEY ("survey_id") REFERENCES "public"."partner_surveys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_quality_settings" ADD CONSTRAINT "partner_quality_settings_actor_id_identity_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_survey_responses" ADD CONSTRAINT "partner_survey_responses_survey_id_partner_surveys_id_fk" FOREIGN KEY ("survey_id") REFERENCES "public"."partner_surveys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_survey_responses" ADD CONSTRAINT "partner_survey_responses_actor_id_identity_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_surveys" ADD CONSTRAINT "partner_surveys_lead_id_partner_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."partner_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_surveys" ADD CONSTRAINT "partner_surveys_owner_id_identity_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "partner_communication_preference_revision" ON "partner_communication_preferences" USING btree ("lead_id","revision");--> statement-breakpoint
CREATE INDEX "partner_communication_record_lead" ON "partner_communication_records" USING btree ("lead_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_recording_decision_revision" ON "partner_recording_decisions" USING btree ("request_id","revision");--> statement-breakpoint
CREATE INDEX "partner_recording_lead" ON "partner_recording_requests" USING btree ("lead_id","created_at","id");--> statement-breakpoint
CREATE INDEX "partner_transcript_access_request" ON "partner_transcript_accesses" USING btree ("request_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_transcript_task" ON "partner_transcript_actions" USING btree ("task_id");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_transcript_revision" ON "partner_transcripts" USING btree ("request_id","revision");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_goal_version" ON "partner_goal_versions" USING btree ("goal_id","revision");--> statement-breakpoint
CREATE INDEX "partner_goal_creator" ON "partner_goals" USING btree ("creator_id","created_at","id");--> statement-breakpoint
CREATE INDEX "partner_goal_organization" ON "partner_goals" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_quality_action_revision" ON "partner_quality_actions" USING btree ("case_id","revision");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_quality_survey_once" ON "partner_quality_cases" USING btree ("survey_id");--> statement-breakpoint
CREATE INDEX "partner_quality_lead" ON "partner_quality_cases" USING btree ("lead_id","created_at","id");--> statement-breakpoint
CREATE INDEX "partner_quality_queue" ON "partner_quality_cases" USING btree ("created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_survey_lead_once" ON "partner_surveys" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "partner_survey_owner" ON "partner_surveys" USING btree ("owner_id","created_at","id");
--> statement-breakpoint
-- Handwritten integrity guards. Catalogue generation must preserve this section.
CREATE FUNCTION partner_quality_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'partner quality evidence is immutable' USING ERRCODE='23514'; END $$;
--> statement-breakpoint
CREATE FUNCTION partner_quality_invalidation_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.invalidated_at IS NULL AND NEW.invalidated_at IS NOT NULL
 AND (to_jsonb(OLD)-'invalidated_at')=(to_jsonb(NEW)-'invalidated_at') THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'partner quality context cannot be rewritten or restored' USING ERRCODE='23514';
END $$;
--> statement-breakpoint
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['partner_surveys','partner_quality_cases','partner_communication_preferences','partner_communication_records','partner_recording_requests'] LOOP
  EXECUTE format('CREATE TRIGGER quality_context_immutable BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION partner_quality_invalidation_only()',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['partner_survey_responses','partner_quality_actions','partner_quality_settings','partner_recording_decisions','partner_transcripts','partner_transcript_actions','partner_transcript_accesses','partner_goals','partner_goal_versions'] LOOP
  EXECUTE format('CREATE TRIGGER quality_evidence_immutable BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION partner_quality_immutable()',t);
 END LOOP;
END $$;
--> statement-breakpoint
CREATE FUNCTION partner_quality_context(lead_key text,subject text,owner_key text) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE l partner_leads%ROWTYPE; canonical_owner text; canonical_subject text;
BEGIN
 SELECT * INTO l FROM partner_leads WHERE id=lead_key FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 IF l.client_profile_id IS NOT NULL THEN
  SELECT user_id INTO canonical_owner FROM managed_profiles WHERE id=l.client_profile_id FOR SHARE;
  canonical_subject='profile:'||l.client_profile_id;
 ELSE
  canonical_owner=l.client_user_id; canonical_subject='self:'||coalesce(l.client_user_id,'null');
  PERFORM id FROM identity_profiles WHERE user_id=canonical_owner FOR SHARE;
 END IF;
 RETURN canonical_subject=subject AND canonical_owner IS NOT DISTINCT FROM owner_key;
END $$;
--> statement-breakpoint
CREATE FUNCTION partner_quality_subject_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE l partner_leads%ROWTYPE; previous_revision int; survey partner_surveys%ROWTYPE;
BEGIN
 IF NEW.invalidated_at IS NOT NULL OR NOT partner_quality_context(NEW.lead_id,NEW.subject_key,NEW.owner_id) THEN
  RAISE EXCEPTION 'partner quality subject changed' USING ERRCODE='23514';
 END IF;
 SELECT * INTO l FROM partner_leads WHERE id=NEW.lead_id;
 IF TG_TABLE_NAME='partner_surveys' THEN
  IF l.stage<>'completed' OR NEW.completed_at IS DISTINCT FROM l.stage_changed_at THEN
   RAISE EXCEPTION 'survey requires effective completion' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='partner_quality_cases' THEN
  IF length(trim(NEW.summary)) NOT BETWEEN 1 AND 2000 OR NEW.due_at<=now() OR (NEW.audience='client' AND NEW.owner_id IS NULL) THEN
   RAISE EXCEPTION 'quality case requires accountable follow-up' USING ERRCODE='23514'; END IF;
  IF NEW.survey_id IS NOT NULL THEN
   SELECT * INTO survey FROM partner_surveys WHERE id=NEW.survey_id FOR UPDATE;
   IF NOT FOUND OR survey.lead_id<>NEW.lead_id OR survey.owner_id<>NEW.author_id OR survey.invalidated_at IS NOT NULL
   OR NOT EXISTS(SELECT 1 FROM partner_survey_responses r WHERE r.survey_id=survey.id AND (r.response->>'rating')::int<5) THEN
    RAISE EXCEPTION 'quality case survey mismatch' USING ERRCODE='23514'; END IF;
  END IF;
 ELSIF TG_TABLE_NAME='partner_communication_preferences' THEN
  SELECT coalesce(max(revision),0) INTO previous_revision FROM partner_communication_preferences WHERE lead_id=NEW.lead_id;
  IF NEW.revision<>previous_revision+1 OR (NEW.input->>'expectedRevision')::int IS DISTINCT FROM previous_revision
  OR NEW.input->'confirmed' IS DISTINCT FROM 'true'::jsonb OR jsonb_typeof(NEW.input->'channels') IS DISTINCT FROM 'array'
  OR jsonb_array_length(NEW.input->'channels') NOT BETWEEN 1 AND 7 THEN
   RAISE EXCEPTION 'communication preference revision or confirmation invalid' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='partner_communication_records' THEN
  IF NEW.input->'confirmed' IS DISTINCT FROM 'true'::jsonb OR (NEW.input->>'expectedLeadRevision')::int IS DISTINCT FROM l.revision
  OR (NEW.input->>'occurredAt')::timestamptz<l.created_at OR (NEW.input->>'occurredAt')::timestamptz>clock_timestamp()
  OR (NEW.input->>'dueAt')::timestamptz<=clock_timestamp() OR length(trim(NEW.input->>'sourceReference'))<10 THEN
   RAISE EXCEPTION 'communication record source or context invalid' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['partner_surveys','partner_quality_cases','partner_communication_preferences','partner_communication_records'] LOOP
  EXECUTE format('CREATE TRIGGER quality_subject_guard BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION partner_quality_subject_guard()',t);
 END LOOP;
END $$;
--> statement-breakpoint
CREATE FUNCTION partner_quality_completed() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner_key text; subject text; survey_key text;
BEGIN
 IF OLD.stage='completed' OR NEW.stage<>'completed' THEN RETURN NEW; END IF;
 IF NEW.client_profile_id IS NOT NULL THEN
  SELECT user_id INTO owner_key FROM managed_profiles WHERE id=NEW.client_profile_id FOR SHARE;
  subject='profile:'||NEW.client_profile_id;
 ELSE owner_key=NEW.client_user_id; subject='self:'||coalesce(owner_key,'null'); END IF;
 IF owner_key IS NULL THEN
  INSERT INTO partner_notifications(id,lead_id,audience,kind,dedupe_key,action,priority)
  VALUES('pn_'||gen_random_uuid(),NEW.id,'coverview','quality.survey_dependency','survey-dependency:'||NEW.id,'review_quality','normal')
  ON CONFLICT(dedupe_key) DO NOTHING;
  RETURN NEW;
 END IF;
 INSERT INTO partner_surveys(id,lead_id,subject_key,owner_id,completed_at)
 VALUES('ps_'||gen_random_uuid(),NEW.id,subject,owner_key,NEW.stage_changed_at)
 ON CONFLICT(lead_id) DO NOTHING RETURNING id INTO survey_key;
 IF survey_key IS NOT NULL THEN
  INSERT INTO partner_notifications(id,lead_id,recipient_id,audience,kind,dedupe_key,action,priority)
  VALUES('pn_'||gen_random_uuid(),NEW.id,owner_key,'wallet','quality.survey','survey:'||survey_key,'survey','normal');
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_quality_completed AFTER UPDATE ON partner_leads FOR EACH ROW EXECUTE FUNCTION partner_quality_completed();
--> statement-breakpoint
CREATE FUNCTION partner_survey_response_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s partner_surveys%ROWTYPE;
BEGIN
 SELECT * INTO s FROM partner_surveys WHERE id=NEW.survey_id FOR UPDATE;
 IF NOT FOUND OR s.invalidated_at IS NOT NULL OR NEW.actor_id<>s.owner_id
 OR NOT partner_quality_context(s.lead_id,s.subject_key,s.owner_id)
 OR NOT EXISTS(SELECT 1 FROM partner_leads WHERE id=s.lead_id AND stage='completed') THEN
  RAISE EXCEPTION 'survey response requires original current owner' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_survey_response_context BEFORE INSERT ON partner_survey_responses FOR EACH ROW EXECUTE FUNCTION partner_survey_response_guard();
--> statement-breakpoint
CREATE FUNCTION partner_quality_action_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c partner_quality_cases%ROWTYPE; previous_revision int; last_action text; action text;
BEGIN
 SELECT * INTO c FROM partner_quality_cases WHERE id=NEW.case_id FOR UPDATE;
 SELECT coalesce(max(revision),0) INTO previous_revision FROM partner_quality_actions WHERE case_id=NEW.case_id;
 SELECT input->>'action' INTO last_action FROM partner_quality_actions WHERE case_id=NEW.case_id AND input->>'action'<>'reply' ORDER BY revision DESC LIMIT 1;
 action=NEW.input->>'action';
 IF NEW.revision<>previous_revision+1 OR (NEW.input->>'expectedRevision')::int IS DISTINCT FROM previous_revision
 OR length(trim(NEW.input->>'note')) NOT BETWEEN 10 AND 2000
 OR action IS NULL OR action NOT IN ('reply','take_charge','follow_up','request_explanation','verify','close','reopen')
 OR coalesce(last_action='close',false) IS DISTINCT FROM (action='reopen') THEN
  RAISE EXCEPTION 'quality action revision or transition invalid' USING ERRCODE='23514'; END IF;
 IF NEW.input->'sharedWithClient'='true'::jsonb AND (c.audience<>'client' OR c.invalidated_at IS NOT NULL OR NOT partner_quality_context(c.lead_id,c.subject_key,c.owner_id)) THEN
  RAISE EXCEPTION 'quality client sharing context invalid' USING ERRCODE='23514'; END IF;
 IF action='reply' THEN
  IF c.invalidated_at IS NOT NULL OR NOT partner_quality_context(c.lead_id,c.subject_key,c.owner_id)
  OR NOT (NEW.actor_id=c.author_id OR NEW.actor_id=c.owner_id AND c.audience='client') THEN
   RAISE EXCEPTION 'quality reply author invalid' USING ERRCODE='23514'; END IF;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM identity_admin_permissions WHERE user_id=NEW.actor_id AND permission='administration.access' AND revoked_at IS NULL) THEN
   RAISE EXCEPTION 'quality management permission required' USING ERRCODE='23514'; END IF;
  IF action='close' THEN
   IF NEW.input->'verified' IS DISTINCT FROM 'true'::jsonb OR NEW.input->'dueAt' IS DISTINCT FROM 'null'::jsonb OR NEW.input->>'nextAction' IS DISTINCT FROM '' THEN
    RAISE EXCEPTION 'quality closure requires verified resolution' USING ERRCODE='23514'; END IF;
  ELSIF (NEW.input->>'dueAt')::timestamptz IS NULL OR (NEW.input->>'dueAt')::timestamptz<=clock_timestamp() OR length(trim(NEW.input->>'nextAction'))<5 THEN
   RAISE EXCEPTION 'quality follow-up requires future action' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_quality_action_context BEFORE INSERT ON partner_quality_actions FOR EACH ROW EXECUTE FUNCTION partner_quality_action_guard();
--> statement-breakpoint
CREATE FUNCTION partner_recording_advisor_current(lead_key text,advisor_key text,professional_rev int) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE l partner_leads%ROWTYPE; m partner_members%ROWTYPE; organization_state text;
BEGIN
 SELECT * INTO l FROM partner_leads WHERE id=lead_key FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 SELECT * INTO m FROM partner_members WHERE user_id=advisor_key FOR SHARE;
 IF NOT FOUND THEN RETURN false; END IF;
 SELECT state INTO organization_state FROM partner_organizations WHERE id=m.organization_id FOR SHARE;
 PERFORM id FROM partner_contributors WHERE lead_id=lead_key AND user_id=advisor_key FOR SHARE;
 RETURN m.professional_revision=professional_rev AND m.state='approved' AND organization_state='approved' AND m.roles ? 'advisor'
 AND (m.review_due_at IS NULL OR m.review_due_at>clock_timestamp()) AND (
 l.responsible_id=advisor_key AND (l.market_valid_until IS NULL OR l.market_valid_until>clock_timestamp()) OR EXISTS(
 SELECT 1 FROM partner_contributors WHERE lead_id=lead_key AND user_id=advisor_key AND revoked_at IS NULL AND access_scope='advice' AND can_edit AND can_contact AND (market_valid_until IS NULL OR market_valid_until>clock_timestamp())));
END $$;
--> statement-breakpoint
CREATE FUNCTION partner_recording_current(request_key text) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE r partner_recording_requests%ROWTYPE;
BEGIN
 SELECT * INTO r FROM partner_recording_requests WHERE id=request_key FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 RETURN r.invalidated_at IS NULL AND partner_quality_context(r.lead_id,r.subject_key,r.owner_id)
 AND partner_recording_advisor_current(r.lead_id,r.advisor_id,r.advisor_revision)
 AND EXISTS(SELECT 1 FROM partner_leads WHERE id=r.lead_id AND advice_scope_revision=r.scope_revision)
 AND (r.input->>'validUntil')::timestamptz>clock_timestamp() AND (r.input->>'retainUntil')::timestamptz>clock_timestamp();
END $$;
--> statement-breakpoint
CREATE FUNCTION partner_recording_request_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE l partner_leads%ROWTYPE;
BEGIN
 IF NEW.invalidated_at IS NOT NULL OR NOT partner_quality_context(NEW.lead_id,NEW.subject_key,NEW.owner_id)
 OR NOT coalesce(partner_recording_advisor_current(NEW.lead_id,NEW.advisor_id,NEW.advisor_revision),false) THEN
  RAISE EXCEPTION 'recording request context invalid' USING ERRCODE='23514'; END IF;
 SELECT * INTO l FROM partner_leads WHERE id=NEW.lead_id;
 IF l.stage IN ('draft','completed') OR NEW.scope_revision<>l.advice_scope_revision
 OR (NEW.input->>'expectedLeadRevision')::int IS DISTINCT FROM l.revision
 OR NEW.input->'confirmed' IS DISTINCT FROM 'true'::jsonb
 OR (NEW.input->>'validUntil')::timestamptz IS NULL OR (NEW.input->>'validUntil')::timestamptz<=clock_timestamp()
 OR (NEW.input->>'retainUntil')::timestamptz IS NULL OR (NEW.input->>'retainUntil')::timestamptz<=(NEW.input->>'validUntil')::timestamptz
 OR jsonb_typeof(NEW.input->'purposes') IS DISTINCT FROM 'array' OR jsonb_array_length(NEW.input->'purposes') NOT BETWEEN 1 AND 5
 OR length(trim(NEW.input->>'notice'))<10 OR length(trim(NEW.input->>'sourceReference'))<10 THEN
  RAISE EXCEPTION 'recording request requires explicit bounded notice' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_recording_request_context BEFORE INSERT ON partner_recording_requests FOR EACH ROW EXECUTE FUNCTION partner_recording_request_guard();
--> statement-breakpoint
CREATE FUNCTION partner_recording_decision_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r partner_recording_requests%ROWTYPE; previous_revision int; previous_decision text;
BEGIN
 IF NOT coalesce(partner_recording_current(NEW.request_id),false) THEN RAISE EXCEPTION 'recording decision context invalid' USING ERRCODE='23514'; END IF;
 SELECT * INTO r FROM partner_recording_requests WHERE id=NEW.request_id;
 SELECT revision,decision INTO previous_revision,previous_decision FROM partner_recording_decisions WHERE request_id=NEW.request_id ORDER BY revision DESC LIMIT 1;
 IF NEW.actor_id<>r.owner_id OR NEW.revision<>coalesce(previous_revision,0)+1
 OR NOT (previous_decision IS NULL AND NEW.decision IN ('allow','decline') OR previous_decision='allow' AND NEW.decision='withdraw') THEN
  RAISE EXCEPTION 'recording decision transition invalid' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_recording_decision_context BEFORE INSERT ON partner_recording_decisions FOR EACH ROW EXECUTE FUNCTION partner_recording_decision_guard();
--> statement-breakpoint
CREATE FUNCTION partner_transcript_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r partner_recording_requests%ROWTYPE; d partner_recording_decisions%ROWTYPE; v partner_transcripts%ROWTYPE; task partner_tasks%ROWTYPE; request_key text;
BEGIN
 IF TG_TABLE_NAME='partner_transcript_actions' THEN
  SELECT * INTO v FROM partner_transcripts WHERE id=NEW.version_id;
  request_key=v.request_id;
 ELSE request_key=NEW.request_id; END IF;
 IF NOT coalesce(partner_recording_current(request_key),false) THEN RAISE EXCEPTION 'transcript context invalid' USING ERRCODE='23514'; END IF;
 SELECT * INTO r FROM partner_recording_requests WHERE id=request_key;
 SELECT * INTO d FROM partner_recording_decisions WHERE request_id=request_key ORDER BY revision DESC LIMIT 1;
 IF d.decision IS DISTINCT FROM 'allow' THEN RAISE EXCEPTION 'transcript requires prior agreement' USING ERRCODE='23514'; END IF;
 IF TG_TABLE_NAME='partner_transcript_accesses' THEN
  IF NEW.actor_id NOT IN (r.owner_id,r.advisor_id) THEN RAISE EXCEPTION 'transcript reader invalid' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 END IF;
 IF NEW.actor_id<>r.advisor_id OR EXISTS(SELECT 1 FROM partner_leads WHERE id=r.lead_id AND stage IN ('draft','completed')) THEN
  RAISE EXCEPTION 'transcript author context invalid' USING ERRCODE='23514'; END IF;
 IF TG_TABLE_NAME='partner_transcript_actions' THEN
  SELECT * INTO task FROM partner_tasks WHERE id=NEW.task_id;
  IF NOT FOUND OR task.lead_id<>r.lead_id OR task.responsible_id<>NEW.actor_id OR task.due_at<=clock_timestamp()
  OR v.revision<>(SELECT max(revision) FROM partner_transcripts WHERE request_id=request_key)
  OR length(trim(NEW.quote))<1 OR position(NEW.quote in coalesce(v.input->'segments'->NEW.segment_index->>'text',''))=0 THEN
   RAISE EXCEPTION 'transcript follow-up requires latest exact source and task' USING ERRCODE='23514'; END IF;
 ELSE
  SELECT * INTO v FROM partner_transcripts WHERE request_id=request_key ORDER BY revision DESC LIMIT 1;
  IF NEW.revision<>coalesce(v.revision,0)+1 OR (NEW.input->>'expectedRevision')::int IS DISTINCT FROM coalesce(v.revision,0)
  OR (NEW.input->>'occurredAt')::timestamptz IS NULL OR (NEW.input->>'occurredAt')::timestamptz<d.created_at
  OR (NEW.input->>'occurredAt')::timestamptz>clock_timestamp() OR (NEW.input->>'occurredAt')::timestamptz>=(r.input->>'validUntil')::timestamptz
  OR v.id IS NOT NULL AND ((NEW.input->>'occurredAt')::timestamptz IS DISTINCT FROM (v.input->>'occurredAt')::timestamptz OR length(trim(NEW.input->>'correctionReason'))<10)
  OR NEW.input->'allParticipantsAgreed' IS DISTINCT FROM 'true'::jsonb OR NEW.input->'sourceReviewed' IS DISTINCT FROM 'true'::jsonb
  OR length(trim(NEW.input->>'sourceReference'))<10 OR jsonb_typeof(NEW.input->'segments') IS DISTINCT FROM 'array'
  OR jsonb_array_length(NEW.input->'segments') NOT BETWEEN 1 AND 100 THEN
   RAISE EXCEPTION 'transcript revision or source invalid' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['partner_transcripts','partner_transcript_actions','partner_transcript_accesses'] LOOP
  EXECUTE format('CREATE TRIGGER transcript_context BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION partner_transcript_guard()',t);
 END LOOP;
END $$;
--> statement-breakpoint
CREATE FUNCTION partner_goal_version_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE g partner_goals%ROWTYPE; previous_revision int;
BEGIN
 SELECT * INTO g FROM partner_goals WHERE id=NEW.goal_id FOR UPDATE;
 SELECT coalesce(max(revision),0) INTO previous_revision FROM partner_goal_versions WHERE goal_id=NEW.goal_id;
 IF NEW.revision<>previous_revision+1 OR (NEW.input->>'expectedRevision')::int IS DISTINCT FROM previous_revision
 OR NEW.input->'confirmed' IS DISTINCT FROM 'true'::jsonb
 OR NEW.input->'scope'->>'kind' IS DISTINCT FROM g.scope_kind
 OR NEW.input->'scope'->>'organizationId' IS DISTINCT FROM g.organization_id
 OR NOT ((NEW.input->'scope'->'userIds') @> g.user_ids AND g.user_ids @> (NEW.input->'scope'->'userIds'))
 OR (NEW.input->>'target')::numeric IS NULL OR (NEW.input->>'target')::numeric<0
 OR (NEW.input->>'from')::timestamptz IS NULL OR (NEW.input->>'to')::timestamptz IS NULL
 OR (NEW.input->>'to')::timestamptz<=(NEW.input->>'from')::timestamptz THEN
  RAISE EXCEPTION 'goal revision or immutable population invalid' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_goal_version_context BEFORE INSERT ON partner_goal_versions FOR EACH ROW EXECUTE FUNCTION partner_goal_version_guard();
--> statement-breakpoint
CREATE FUNCTION partner_quality_settings_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE previous_revision int;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('partner-quality-settings'));
 SELECT coalesce(max(revision),0) INTO previous_revision FROM partner_quality_settings;
 IF NEW.revision<>previous_revision+1 OR (NEW.input->>'expectedRevision')::int IS DISTINCT FROM previous_revision
 OR NEW.input->'reviewed' IS DISTINCT FROM 'true'::jsonb OR NOT EXISTS(SELECT 1 FROM identity_admin_permissions WHERE user_id=NEW.actor_id AND permission='administration.access' AND revoked_at IS NULL) THEN
  RAISE EXCEPTION 'quality settings revision or review invalid' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_quality_settings_context BEFORE INSERT ON partner_quality_settings FOR EACH ROW EXECUTE FUNCTION partner_quality_settings_guard();
--> statement-breakpoint
CREATE FUNCTION partner_quality_invalidate(lead_key text,all_evidence boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 UPDATE partner_recording_requests SET invalidated_at=clock_timestamp() WHERE lead_id=lead_key AND invalidated_at IS NULL;
 UPDATE partner_notifications SET resolved_at=coalesce(resolved_at,clock_timestamp()) WHERE lead_id=lead_key AND kind='communication.consent';
 IF all_evidence THEN
  UPDATE partner_surveys SET invalidated_at=clock_timestamp() WHERE lead_id=lead_key AND invalidated_at IS NULL;
  UPDATE partner_quality_cases SET invalidated_at=clock_timestamp() WHERE lead_id=lead_key AND invalidated_at IS NULL;
  UPDATE partner_communication_preferences SET invalidated_at=clock_timestamp() WHERE lead_id=lead_key AND invalidated_at IS NULL;
  UPDATE partner_communication_records SET invalidated_at=clock_timestamp() WHERE lead_id=lead_key AND invalidated_at IS NULL;
  UPDATE partner_notifications SET resolved_at=coalesce(resolved_at,clock_timestamp()) WHERE lead_id=lead_key AND kind='quality.survey';
 END IF;
END $$;
--> statement-breakpoint
CREATE FUNCTION partner_quality_lead_context() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW.client_user_id,NEW.client_profile_id,NEW.category,NEW.advice_scope_revision) IS DISTINCT FROM ROW(OLD.client_user_id,OLD.client_profile_id,OLD.category,OLD.advice_scope_revision) THEN
  PERFORM partner_quality_invalidate(NEW.id,true);
 ELSIF ROW(NEW.responsible_id,NEW.market_mandate_id,NEW.market_valid_until) IS DISTINCT FROM ROW(OLD.responsible_id,OLD.market_mandate_id,OLD.market_valid_until) THEN
  PERFORM partner_quality_invalidate(NEW.id,false);
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_quality_lead_context BEFORE UPDATE ON partner_leads FOR EACH ROW EXECUTE FUNCTION partner_quality_lead_context();
--> statement-breakpoint
CREATE FUNCTION partner_quality_profile_context() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE lead_key text; changed_owner boolean;
BEGIN
 IF to_jsonb(NEW)=to_jsonb(OLD) THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='managed_profiles' THEN
  changed_owner=NEW.user_id IS DISTINCT FROM OLD.user_id;
  FOR lead_key IN SELECT id FROM partner_leads WHERE client_profile_id=NEW.id ORDER BY id FOR UPDATE LOOP
   PERFORM partner_quality_invalidate(lead_key,changed_owner);
  END LOOP;
 ELSE
  FOR lead_key IN SELECT id FROM partner_leads WHERE client_profile_id IS NULL AND client_user_id=NEW.user_id ORDER BY id FOR UPDATE LOOP
   PERFORM partner_quality_invalidate(lead_key,false);
  END LOOP;
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_quality_profile_context AFTER UPDATE ON managed_profiles FOR EACH ROW EXECUTE FUNCTION partner_quality_profile_context();
--> statement-breakpoint
CREATE TRIGGER partner_quality_identity_context AFTER UPDATE ON identity_profiles FOR EACH ROW EXECUTE FUNCTION partner_quality_profile_context();
--> statement-breakpoint
CREATE FUNCTION partner_recording_professional_context() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE lead_key text;
BEGIN
 IF TG_TABLE_NAME='partner_members' THEN
  IF ROW(NEW.professional_revision,NEW.organization_id,NEW.state,NEW.roles,NEW.review_due_at) IS NOT DISTINCT FROM ROW(OLD.professional_revision,OLD.organization_id,OLD.state,OLD.roles,OLD.review_due_at) THEN RETURN NEW; END IF;
  FOR lead_key IN SELECT DISTINCT lead_id FROM partner_recording_requests WHERE advisor_id=NEW.user_id AND invalidated_at IS NULL ORDER BY lead_id LOOP
   PERFORM partner_quality_invalidate(lead_key,false);
  END LOOP;
 ELSIF TG_TABLE_NAME='partner_organizations' THEN
  IF NEW.state IS NOT DISTINCT FROM OLD.state THEN RETURN NEW; END IF;
  FOR lead_key IN SELECT DISTINCT r.lead_id FROM partner_recording_requests r JOIN partner_members m ON m.user_id=r.advisor_id WHERE m.organization_id=NEW.id AND r.invalidated_at IS NULL ORDER BY r.lead_id LOOP
   PERFORM partner_quality_invalidate(lead_key,false);
  END LOOP;
 ELSE
  IF TG_OP='UPDATE' AND ROW(NEW.can_edit,NEW.can_contact,NEW.access_scope,NEW.revoked_at,NEW.market_valid_until,NEW.user_id,NEW.lead_id) IS NOT DISTINCT FROM ROW(OLD.can_edit,OLD.can_contact,OLD.access_scope,OLD.revoked_at,OLD.market_valid_until,OLD.user_id,OLD.lead_id) THEN RETURN NEW; END IF;
  PERFORM partner_quality_invalidate(OLD.lead_id,false);
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_recording_member_context AFTER UPDATE ON partner_members FOR EACH ROW EXECUTE FUNCTION partner_recording_professional_context();
--> statement-breakpoint
CREATE TRIGGER partner_recording_organization_context AFTER UPDATE ON partner_organizations FOR EACH ROW EXECUTE FUNCTION partner_recording_professional_context();
--> statement-breakpoint
CREATE TRIGGER partner_recording_contributor_context AFTER UPDATE OR DELETE ON partner_contributors FOR EACH ROW EXECUTE FUNCTION partner_recording_professional_context();

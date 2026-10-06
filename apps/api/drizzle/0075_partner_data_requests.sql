CREATE TABLE "partner_data_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"requester_id" text NOT NULL,
	"surface" text NOT NULL,
	"subject_key" text NOT NULL,
	"profile_id" text,
	"kind" text NOT NULL,
	"category" text,
	"lead_id" text,
	"message" text NOT NULL,
	"state" text DEFAULT 'received' NOT NULL,
	"outcome" text,
	"answer" text,
	"access_until" timestamp (3) with time zone,
	"erasure" jsonb,
	"taken_by" text,
	"taken_at" timestamp (3) with time zone,
	"answered_by" text,
	"answered_at" timestamp (3) with time zone,
	"withdrawn_at" timestamp (3) with time zone,
	"revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_data_request_kind" CHECK ("partner_data_requests"."surface" in ('wallet','partner') and "partner_data_requests"."kind" in ('rectification','erasure','complete_access','other') and ("partner_data_requests"."surface"='wallet' or "partner_data_requests"."kind"<>'complete_access')),
	CONSTRAINT "partner_data_request_subject" CHECK (("partner_data_requests"."surface"='partner' and "partner_data_requests"."subject_key"='member:'||"partner_data_requests"."requester_id" and "partner_data_requests"."profile_id" is null and "partner_data_requests"."lead_id" is null)
        or ("partner_data_requests"."surface"='wallet' and ("partner_data_requests"."subject_key"='self:'||"partner_data_requests"."requester_id" and "partner_data_requests"."profile_id" is null or "partner_data_requests"."subject_key"='profile:'||"partner_data_requests"."profile_id"))),
	CONSTRAINT "partner_data_request_text" CHECK (length(trim("partner_data_requests"."message")) between 10 and 2000 and ("partner_data_requests"."answer" is null or length(trim("partner_data_requests"."answer")) between 10 and 2000)),
	CONSTRAINT "partner_data_request_state" CHECK ("partner_data_requests"."state" in ('received','in_progress','answered','withdrawn') and "partner_data_requests"."revision">=0
        and (("partner_data_requests"."state"='answered') = ("partner_data_requests"."outcome" is not null and "partner_data_requests"."answer" is not null and "partner_data_requests"."answered_by" is not null and "partner_data_requests"."answered_at" is not null))
        and (("partner_data_requests"."state"='withdrawn') = ("partner_data_requests"."withdrawn_at" is not null))
        and (("partner_data_requests"."taken_by" is null) = ("partner_data_requests"."taken_at" is null))
        and ("partner_data_requests"."access_until" is null or "partner_data_requests"."outcome"='granted')),
	CONSTRAINT "partner_data_request_outcome" CHECK ("partner_data_requests"."outcome" is null
        or "partner_data_requests"."kind"='rectification' and "partner_data_requests"."outcome" in ('done','partially_done','refused')
        or "partner_data_requests"."kind"='erasure' and "partner_data_requests"."surface"='wallet' and "partner_data_requests"."outcome" in ('done','partially_done','refused')
        or "partner_data_requests"."kind"='erasure' and "partner_data_requests"."surface"='partner' and "partner_data_requests"."outcome" in ('answered','refused')
        or "partner_data_requests"."kind"='complete_access' and ("partner_data_requests"."outcome"='granted' and "partner_data_requests"."access_until" is not null or "partner_data_requests"."outcome"='refused')
        or "partner_data_requests"."kind"='other' and "partner_data_requests"."outcome" in ('answered','refused')),
	CONSTRAINT "partner_data_request_erasure" CHECK (("partner_data_requests"."erasure" is not null) = ("partner_data_requests"."kind"='erasure' and "partner_data_requests"."surface"='wallet' and "partner_data_requests"."outcome" in ('done','partially_done')))
);
--> statement-breakpoint
ALTER TABLE "partner_data_requests" ADD CONSTRAINT "partner_data_requests_requester_id_identity_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_data_requests" ADD CONSTRAINT "partner_data_requests_profile_id_managed_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."managed_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_data_requests" ADD CONSTRAINT "partner_data_requests_lead_id_partner_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."partner_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_data_requests" ADD CONSTRAINT "partner_data_requests_taken_by_identity_users_id_fk" FOREIGN KEY ("taken_by") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_data_requests" ADD CONSTRAINT "partner_data_requests_answered_by_identity_users_id_fk" FOREIGN KEY ("answered_by") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "partner_data_request_requester" ON "partner_data_requests" USING btree ("requester_id","created_at","id");--> statement-breakpoint
CREATE INDEX "partner_data_request_queue" ON "partner_data_requests" USING btree ("state","created_at","id");--> statement-breakpoint
-- A data request keeps who asked, about whom and what; it moves forward only, each change counts
-- one revision, and it is frozen once answered or withdrawn. It is never deleted.
CREATE FUNCTION partner_data_request_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  RAISE EXCEPTION 'partner data request cannot be deleted' USING ERRCODE='23514';
 END IF;
 IF (NEW.id, NEW.requester_id, NEW.surface, NEW.subject_key, NEW.profile_id, NEW.kind, NEW.category, NEW.lead_id, NEW.message, NEW.created_at)
  IS DISTINCT FROM (OLD.id, OLD.requester_id, OLD.surface, OLD.subject_key, OLD.profile_id, OLD.kind, OLD.category, OLD.lead_id, OLD.message, OLD.created_at)
  OR OLD.state IN ('answered','withdrawn')
  OR NEW.revision<>OLD.revision+1
  OR (OLD.taken_by IS NOT NULL AND (NEW.taken_by, NEW.taken_at) IS DISTINCT FROM (OLD.taken_by, OLD.taken_at))
  OR NOT (
   (OLD.state='received' AND NEW.state IN ('in_progress','answered','withdrawn'))
   OR (OLD.state='in_progress' AND NEW.state IN ('answered','withdrawn'))) THEN
  RAISE EXCEPTION 'invalid partner data request change' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_data_request_guard BEFORE UPDATE OR DELETE ON partner_data_requests FOR EACH ROW EXECUTE FUNCTION partner_data_request_guard();

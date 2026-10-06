ALTER TABLE "partner_leads" ADD COLUMN "client_erased_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "partner_leads" ADD COLUMN "client_erasure_request_id" text;--> statement-breakpoint
ALTER TABLE "partner_leads" ADD CONSTRAINT "partner_lead_erasure" CHECK (("partner_leads"."client_erased_at" is null) = ("partner_leads"."client_erasure_request_id" is null) and ("partner_leads"."client_erased_at" is null or ("partner_leads"."client_user_id" is null and "partner_leads"."client_profile_id" is null)));--> statement-breakpoint
-- The erasing request is kept with the request it erased (partner_data_requests is never deleted).
ALTER TABLE "partner_leads" ADD CONSTRAINT "partner_leads_erasure_request_fk" FOREIGN KEY ("client_erasure_request_id") REFERENCES "public"."partner_data_requests"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
-- An invitation keeps its recipient, request and validity; it moves forward only, ends once, and
-- is never deleted: it is the trace of an indirect collection of personal data. The one exception
-- is a controlled erasure (C7c): inside that transaction only, and with nothing else changed, the
-- recipient address is replaced by a reserved placeholder; the trace of the information remains.
CREATE OR REPLACE FUNCTION partner_client_invitation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  RAISE EXCEPTION 'client invitation cannot be deleted' USING ERRCODE='23514';
 END IF;
 IF coalesce(current_setting('coverview.partner_erasure', true), '')<>''
  AND NEW.email='erased@coverview.invalid'
  AND to_jsonb(NEW)-'email'=to_jsonb(OLD)-'email' THEN
  RETURN NEW;
 END IF;
 IF (NEW.id, NEW.lead_id, NEW.email, NEW.created_by, NEW.created_at, NEW.expires_at)
  IS DISTINCT FROM (OLD.id, OLD.lead_id, OLD.email, OLD.created_by, OLD.created_at, OLD.expires_at)
  OR OLD.state IN ('accepted','declined','expired','cancelled','failed','superseded')
  OR (NEW.state<>OLD.state AND NOT (
   (OLD.state='queued' AND NEW.state IN ('sending','cancelled','expired','superseded'))
   OR (OLD.state='sending' AND NEW.state IN ('sent','queued','failed'))
   OR (OLD.state='sent' AND NEW.state IN ('accepted','declined','cancelled','expired','superseded')))) THEN
  RAISE EXCEPTION 'invalid client invitation change' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;

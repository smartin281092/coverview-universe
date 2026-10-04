-- Live invalidation (C6a, RT-10, RT-16). PostgreSQL delivers these notices only after the
-- transaction commits, and folds identical notices of one transaction into one. The payload
-- names a Lead and an audience, never content: the API decides per connection who may learn it.
CREATE FUNCTION partner_live_lead_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.lead_id IS NOT NULL THEN
    PERFORM pg_notify('partner_live', json_build_object('lead', NEW.lead_id, 'audience', NEW.audience)::text);
  END IF;
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_live_event AFTER INSERT ON partner_events
FOR EACH ROW EXECUTE FUNCTION partner_live_lead_event();
--> statement-breakpoint
CREATE FUNCTION partner_live_notification() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('partner_live', json_build_object('notification', true, 'recipient', NEW.recipient_id, 'audience', NEW.audience)::text);
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_live_notification AFTER INSERT OR UPDATE ON partner_notifications
FOR EACH ROW EXECUTE FUNCTION partner_live_notification();

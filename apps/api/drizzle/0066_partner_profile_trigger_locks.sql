-- Profile changes keep invalidating dependent Partner evidence, without locking the client's leads.
-- Partner paths lock a lead before its profile. Locking leads from a profile update inverted that
-- order and deadlocked concurrent reads and commands. Insert guards already serialise on the profile
-- row through partner_quality_context (lead FOR UPDATE, then profile FOR SHARE), as 0057 does.
CREATE OR REPLACE FUNCTION partner_quality_profile_context() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE lead_key text; changed_owner boolean;
BEGIN
 IF to_jsonb(NEW)=to_jsonb(OLD) THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='managed_profiles' THEN
  changed_owner=NEW.user_id IS DISTINCT FROM OLD.user_id;
  FOR lead_key IN SELECT id FROM partner_leads WHERE client_profile_id=NEW.id ORDER BY id LOOP
   PERFORM partner_quality_invalidate(lead_key,changed_owner);
  END LOOP;
 ELSE
  FOR lead_key IN SELECT id FROM partner_leads WHERE client_profile_id IS NULL AND client_user_id=NEW.user_id ORDER BY id LOOP
   PERFORM partner_quality_invalidate(lead_key,false);
  END LOOP;
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION partner_conclusion_profile_context() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE lead_key text;
BEGIN
 IF to_jsonb(NEW)=to_jsonb(OLD) THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='managed_profiles' THEN
  FOR lead_key IN SELECT id FROM partner_leads WHERE client_profile_id=NEW.id ORDER BY id LOOP
   PERFORM partner_conclusion_invalidate(lead_key,NEW.user_id IS DISTINCT FROM OLD.user_id);
  END LOOP;
 ELSE
  FOR lead_key IN SELECT id FROM partner_leads WHERE client_profile_id IS NULL AND client_user_id=NEW.user_id ORDER BY id LOOP
   PERFORM partner_conclusion_invalidate(lead_key,false);
  END LOOP;
 END IF;
 RETURN NEW;
END $$;

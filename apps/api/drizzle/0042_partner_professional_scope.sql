ALTER TABLE "partner_competence_declarations" ADD COLUMN "professional_revision" integer;--> statement-breakpoint
ALTER TABLE "partner_competence_declarations" ADD COLUMN "declared_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "partner_competence_declarations" ADD COLUMN "declared_organization" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "partner_convention_declarations" ADD COLUMN "professional_revision" integer;--> statement-breakpoint
ALTER TABLE "partner_members" ADD COLUMN "professional_revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "partner_competence_declarations" ADD CONSTRAINT "partner_competence_professional_revision" CHECK ("partner_competence_declarations"."professional_revision">0);--> statement-breakpoint
ALTER TABLE "partner_convention_declarations" ADD CONSTRAINT "partner_convention_professional_revision" CHECK ("partner_convention_declarations"."professional_revision">0);--> statement-breakpoint
ALTER TABLE "partner_members" ADD CONSTRAINT "partner_member_professional_revision" CHECK ("partner_members"."professional_revision">0);--> statement-breakpoint
-- Keep the generation monotone even for an older application writer. Existing
-- declarations intentionally keep NULL: no historical parties can be inferred.
CREATE FUNCTION partner_advance_professional_scope() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.professional_revision := 1;
  ELSIF OLD.organization_id IS DISTINCT FROM NEW.organization_id
    OR OLD.application->>'name' IS DISTINCT FROM NEW.application->>'name'
    OR OLD.application->>'organization' IS DISTINCT FROM NEW.application->>'organization'
    OR NOT (coalesce(OLD.application->'categories','[]'::jsonb) @> coalesce(NEW.application->'categories','[]'::jsonb)
      AND coalesce(NEW.application->'categories','[]'::jsonb) @> coalesce(OLD.application->'categories','[]'::jsonb)) THEN
    NEW.professional_revision := OLD.professional_revision + 1;
  ELSE
    NEW.professional_revision := OLD.professional_revision;
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER partner_professional_scope_revision
BEFORE INSERT OR UPDATE ON partner_members
FOR EACH ROW EXECUTE FUNCTION partner_advance_professional_scope();

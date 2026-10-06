CREATE TABLE "partner_organization_profile_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"version_id" text NOT NULL,
	"decision" text NOT NULL,
	"reason" text NOT NULL,
	"decided_by" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_organization_profile_review_shape" CHECK ("partner_organization_profile_reviews"."decision" in ('published','rejected','withdrawn') and length(trim("partner_organization_profile_reviews"."reason")) between 5 and 2000)
);
--> statement-breakpoint
CREATE TABLE "partner_organization_profile_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"revision" integer NOT NULL,
	"declared_name" text NOT NULL,
	"presentation" text NOT NULL,
	"logo_document_id" text,
	"logo_checksum" text,
	"submitted_by" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_organization_profile_shape" CHECK ("partner_organization_profile_versions"."revision">0 and length(trim("partner_organization_profile_versions"."presentation")) between 40 and 1200 and length(trim("partner_organization_profile_versions"."declared_name")) between 2 and 160),
	CONSTRAINT "partner_organization_profile_logo" CHECK (("logo_document_id" is null)=("logo_checksum" is null) and ("logo_checksum" is null or "logo_checksum" ~ '^[a-f0-9]{64}$'))
);
--> statement-breakpoint
ALTER TABLE "files" DROP CONSTRAINT "files_purpose";--> statement-breakpoint
ALTER TABLE "partner_profile_versions" ADD COLUMN "photo_document_id" text;--> statement-breakpoint
ALTER TABLE "partner_profile_versions" ADD COLUMN "photo_checksum" text;--> statement-breakpoint
ALTER TABLE "partner_organization_profile_reviews" ADD CONSTRAINT "partner_organization_profile_reviews_version_id_partner_organization_profile_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."partner_organization_profile_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_organization_profile_reviews" ADD CONSTRAINT "partner_organization_profile_reviews_decided_by_identity_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_organization_profile_versions" ADD CONSTRAINT "partner_organization_profile_versions_organization_id_partner_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."partner_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_organization_profile_versions" ADD CONSTRAINT "partner_organization_profile_versions_logo_document_id_files_id_fk" FOREIGN KEY ("logo_document_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_organization_profile_versions" ADD CONSTRAINT "partner_organization_profile_versions_submitted_by_identity_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "partner_organization_profile_review_version" ON "partner_organization_profile_reviews" USING btree ("version_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_organization_profile_revision" ON "partner_organization_profile_versions" USING btree ("organization_id","revision");--> statement-breakpoint
ALTER TABLE "partner_profile_versions" ADD CONSTRAINT "partner_profile_versions_photo_document_id_files_id_fk" FOREIGN KEY ("photo_document_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_purpose" CHECK ("files"."purpose" is null or "files"."purpose" in ('identity_card','lead_offer','partner_competence','partner_convention','partner_profile_photo','partner_organization_logo'));--> statement-breakpoint
ALTER TABLE "partner_profile_versions" ADD CONSTRAINT "partner_profile_photo" CHECK (("photo_document_id" is null)=("photo_checksum" is null) and ("photo_checksum" is null or "photo_checksum" ~ '^[a-f0-9]{64}$'));--> statement-breakpoint
-- Handwritten guards (C8c). Organisation profile versions and reviews are evidence: append-only.
CREATE TRIGGER partner_organization_profile_versions_immutable BEFORE UPDATE OR DELETE ON partner_organization_profile_versions FOR EACH ROW EXECUTE FUNCTION partner_profile_immutable();
--> statement-breakpoint
CREATE TRIGGER partner_organization_profile_reviews_immutable BEFORE UPDATE OR DELETE ON partner_organization_profile_reviews FOR EACH ROW EXECUTE FUNCTION partner_profile_immutable();
--> statement-breakpoint
-- Only someone outside the organisation publishes or refuses; only one of its members withdraws.
CREATE FUNCTION partner_organization_profile_review_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE organization text;
BEGIN
 SELECT organization_id INTO organization FROM partner_organization_profile_versions WHERE id=NEW.version_id;
 IF (NEW.decision='withdrawn') <> EXISTS(SELECT 1 FROM partner_members WHERE user_id=NEW.decided_by AND organization_id=organization) THEN
  RAISE EXCEPTION 'invalid organisation profile review author' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_organization_profile_review_guard BEFORE INSERT ON partner_organization_profile_reviews FOR EACH ROW EXECUTE FUNCTION partner_organization_profile_review_guard();
--> statement-breakpoint
-- A picture is the exact file of its purpose: the person's own photo, or an organisation logo.
CREATE FUNCTION partner_profile_picture_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 -- Nested branches: each table's record is read only in its own branch.
 IF TG_TABLE_NAME='partner_profile_versions' THEN
  IF NEW.photo_document_id IS NOT NULL AND NOT EXISTS(
   SELECT 1 FROM files WHERE id=NEW.photo_document_id AND user_id=NEW.user_id AND purpose='partner_profile_photo'
   AND checksum=NEW.photo_checksum AND managed_profile_id IS NULL) THEN
   RAISE EXCEPTION 'profile photo must be the person''s own photo file' USING ERRCODE='23514';
  END IF;
 ELSE
  IF NEW.logo_document_id IS NOT NULL AND NOT EXISTS(
   SELECT 1 FROM files WHERE id=NEW.logo_document_id AND purpose='partner_organization_logo'
   AND checksum=NEW.logo_checksum AND managed_profile_id IS NULL) THEN
   RAISE EXCEPTION 'organisation logo must be a logo file' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_profile_picture_guard BEFORE INSERT ON partner_profile_versions FOR EACH ROW EXECUTE FUNCTION partner_profile_picture_guard();
--> statement-breakpoint
CREATE TRIGGER partner_organization_logo_guard BEFORE INSERT ON partner_organization_profile_versions FOR EACH ROW EXECUTE FUNCTION partner_profile_picture_guard();

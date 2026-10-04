CREATE TABLE "partner_advice_preferences" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"subject_id" text NOT NULL,
	"self_user_id" text,
	"profile_id" text,
	"profile_revision" integer NOT NULL,
	"scope_revision" integer NOT NULL,
	"scope" jsonb NOT NULL,
	"revision" integer NOT NULL,
	"language_code" text,
	"mode" text,
	"canton" text,
	"confirmed_by" text NOT NULL,
	"confirmation_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_advice_subject" CHECK (("partner_advice_preferences"."profile_id" is not null and "partner_advice_preferences"."self_user_id" is null and "partner_advice_preferences"."subject_id"='profile:'||"partner_advice_preferences"."profile_id") or ("partner_advice_preferences"."profile_id" is null and "partner_advice_preferences"."self_user_id" is not null and "partner_advice_preferences"."subject_id"='self:'||"partner_advice_preferences"."self_user_id" and "partner_advice_preferences"."confirmed_by"="partner_advice_preferences"."self_user_id" and "partner_advice_preferences"."profile_revision"=0)),
	CONSTRAINT "partner_advice_bounds" CHECK ("partner_advice_preferences"."revision">0 and "partner_advice_preferences"."scope_revision">0 and "partner_advice_preferences"."profile_revision">=0 and "partner_advice_preferences"."confirmation_version"=1),
	CONSTRAINT "partner_advice_language" CHECK ("partner_advice_preferences"."language_code" is null or "partner_advice_preferences"."language_code" in ('aa', 'ab', 'ae', 'af', 'ak', 'am', 'an', 'ar', 'as', 'av', 'ay', 'az', 'ba', 'be', 'bg', 'bho', 'bi', 'bm', 'bn', 'bo', 'br', 'bs', 'ca', 'ce', 'ch', 'co', 'cr', 'cs', 'cu', 'cv', 'cy', 'da', 'de', 'dv', 'dz', 'ee', 'el', 'en', 'eo', 'es', 'et', 'eu', 'fa', 'ff', 'fi', 'fil', 'fj', 'fo', 'fr', 'fy', 'ga', 'gd', 'gl', 'gn', 'gu', 'gv', 'ha', 'he', 'hi', 'ho', 'hr', 'ht', 'hu', 'hy', 'hz', 'ia', 'id', 'ie', 'ig', 'ii', 'ik', 'io', 'is', 'it', 'iu', 'ja', 'jv', 'ka', 'kg', 'ki', 'kj', 'kk', 'kl', 'km', 'kn', 'ko', 'kr', 'ks', 'ku', 'kv', 'kw', 'ky', 'la', 'lb', 'lg', 'li', 'ln', 'lo', 'lt', 'lu', 'lv', 'mg', 'mh', 'mi', 'mk', 'ml', 'mn', 'mr', 'ms', 'mt', 'my', 'na', 'nb', 'nd', 'ne', 'ng', 'nl', 'nn', 'no', 'nr', 'nv', 'ny', 'oc', 'oj', 'om', 'or', 'os', 'pa', 'pi', 'pl', 'ps', 'pt', 'qu', 'rm', 'rn', 'ro', 'ru', 'rw', 'sa', 'sc', 'sd', 'se', 'sg', 'si', 'sk', 'sl', 'sm', 'sn', 'so', 'sq', 'sr', 'ss', 'st', 'su', 'sv', 'sw', 'ta', 'te', 'tg', 'th', 'ti', 'tk', 'tn', 'to', 'tr', 'ts', 'tt', 'ty', 'ug', 'uk', 'ur', 'uz', 've', 'vi', 'vo', 'wa', 'wo', 'xh', 'yi', 'yo', 'za', 'zh', 'zu')),
	CONSTRAINT "partner_advice_mode" CHECK ("partner_advice_preferences"."mode" is null or "partner_advice_preferences"."mode" in ('phone','video','office','home')),
	CONSTRAINT "partner_advice_canton" CHECK ("partner_advice_preferences"."canton" is null or ("partner_advice_preferences"."mode" is not null and "partner_advice_preferences"."mode" in ('office','home') and "partner_advice_preferences"."canton" in ('AG', 'AI', 'AR', 'BE', 'BL', 'BS', 'FR', 'GE', 'GL', 'GR', 'JU', 'LU', 'NE', 'NW', 'OW', 'SG', 'SH', 'SO', 'SZ', 'TG', 'TI', 'UR', 'VD', 'VS', 'ZG', 'ZH')))
);
--> statement-breakpoint
ALTER TABLE "partner_leads" ADD COLUMN "advice_scope_revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "partner_advice_preferences" ADD CONSTRAINT "partner_advice_preferences_lead_id_partner_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."partner_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_advice_preferences" ADD CONSTRAINT "partner_advice_preferences_self_user_id_identity_users_id_fk" FOREIGN KEY ("self_user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_advice_preferences" ADD CONSTRAINT "partner_advice_preferences_profile_id_managed_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."managed_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_advice_preferences" ADD CONSTRAINT "partner_advice_preferences_confirmed_by_identity_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "partner_advice_revision" ON "partner_advice_preferences" USING btree ("lead_id","revision");--> statement-breakpoint
CREATE INDEX "partner_advice_subject_history" ON "partner_advice_preferences" USING btree ("lead_id","subject_id","revision");--> statement-breakpoint
ALTER TABLE "partner_leads" ADD CONSTRAINT "partner_lead_advice_scope" CHECK ("partner_leads"."advice_scope_revision">0);
--> statement-breakpoint
-- An older writer must not reactivate a confirmation after changing and restoring a need.
-- A managed profile keeps its identity when its current owner changes.
CREATE FUNCTION partner_advance_advice_scope() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.advice_scope_revision := 1;
  ELSIF OLD.client_profile_id IS DISTINCT FROM NEW.client_profile_id
    OR (NEW.client_profile_id IS NULL AND OLD.client_user_id IS DISTINCT FROM NEW.client_user_id)
    OR OLD.title IS DISTINCT FROM NEW.title
    OR OLD.category IS DISTINCT FROM NEW.category
    OR OLD.object IS DISTINCT FROM NEW.object
    OR OLD.details->>'context' IS DISTINCT FROM NEW.details->>'context' THEN
    NEW.advice_scope_revision := OLD.advice_scope_revision + 1;
  ELSE
    NEW.advice_scope_revision := OLD.advice_scope_revision;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER partner_advice_scope_revision
BEFORE INSERT OR UPDATE ON partner_leads
FOR EACH ROW EXECUTE FUNCTION partner_advance_advice_scope();

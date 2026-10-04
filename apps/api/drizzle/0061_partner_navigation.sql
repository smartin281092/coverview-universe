CREATE TABLE "partner_lead_views" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"revision" integer NOT NULL,
	"filters" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_lead_views_bounds" CHECK ("partner_lead_views"."revision">0 and length(trim("partner_lead_views"."name")) between 2 and 60 and jsonb_typeof("partner_lead_views"."filters")='object' and octet_length("partner_lead_views"."filters"::text)<=4096)
);
--> statement-breakpoint
ALTER TABLE "partner_lead_views" ADD CONSTRAINT "partner_lead_views_user_id_identity_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "partner_lead_views_owner" ON "partner_lead_views" USING btree ("user_id","active","updated_at","id");
--> statement-breakpoint
CREATE FUNCTION partner_lead_view_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM id FROM identity_users WHERE id=NEW.user_id FOR UPDATE;
 IF TG_OP='INSERT' THEN
  IF NEW.revision<>1 OR NOT NEW.active OR (SELECT count(*) FROM partner_lead_views WHERE user_id=NEW.user_id AND active)>=20 THEN
   RAISE EXCEPTION 'view limit or initial revision invalid' USING ERRCODE='23514';
  END IF;
 ELSE
  IF NEW.id<>OLD.id OR NEW.user_id<>OLD.user_id OR NEW.created_at IS DISTINCT FROM OLD.created_at
  OR NEW.revision<>OLD.revision+1 OR NOT OLD.active THEN
   RAISE EXCEPTION 'private view scope or revision changed' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_lead_view_guard BEFORE INSERT OR UPDATE ON partner_lead_views FOR EACH ROW EXECUTE FUNCTION partner_lead_view_guard();

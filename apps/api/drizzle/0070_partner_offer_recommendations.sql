CREATE TABLE "partner_offer_recommendations" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"version" integer NOT NULL,
	"kind" text NOT NULL,
	"offer_id" text,
	"offer_version" integer,
	"rationale" text NOT NULL,
	"attention" text DEFAULT '' NOT NULL,
	"orientation_kind" text NOT NULL,
	"deviation" boolean NOT NULL,
	"deviation_reason" text,
	"basis" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_recommendation_shape" CHECK ("partner_offer_recommendations"."version">0 and "partner_offer_recommendations"."kind" in ('offer','keep_current','none') and (("partner_offer_recommendations"."kind"='offer') = ("partner_offer_recommendations"."offer_id" is not null and "partner_offer_recommendations"."offer_version" is not null)) and length(trim("partner_offer_recommendations"."rationale")) between 20 and 3000 and length("partner_offer_recommendations"."attention")<=2000 and "partner_offer_recommendations"."orientation_kind" in ('insufficient','offer_advantage','keep_current','tradeoff','offers_only') and "partner_offer_recommendations"."deviation" = ("partner_offer_recommendations"."deviation_reason" is not null and length(trim("partner_offer_recommendations"."deviation_reason"))>=20) and "partner_offer_recommendations"."basis" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "partner_offer_recommendations" ADD CONSTRAINT "partner_offer_recommendations_lead_id_partner_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."partner_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_offer_recommendations" ADD CONSTRAINT "partner_offer_recommendations_offer_id_partner_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."partner_offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_offer_recommendations" ADD CONSTRAINT "partner_offer_recommendations_created_by_identity_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "partner_recommendation_version" ON "partner_offer_recommendations" USING btree ("lead_id","version");--> statement-breakpoint
-- A published recommendation is a trace of advice given to the client: never rewritten or deleted.
CREATE FUNCTION partner_offer_recommendation_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'offer recommendation cannot be changed' USING ERRCODE='23514';
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_offer_recommendation_immutable BEFORE UPDATE OR DELETE ON partner_offer_recommendations FOR EACH ROW EXECUTE FUNCTION partner_offer_recommendation_immutable();

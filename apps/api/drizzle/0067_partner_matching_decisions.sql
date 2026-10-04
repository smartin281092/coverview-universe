CREATE TABLE "partner_matching_decisions" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"cycle" integer NOT NULL,
	"kind" text NOT NULL,
	"actor_id" text,
	"system_actor" text,
	"chosen_user_id" text NOT NULL,
	"chosen_rank" integer,
	"top_user_id" text,
	"deviation" boolean NOT NULL,
	"reason" text NOT NULL,
	"basis" text NOT NULL,
	"ranking" jsonb NOT NULL,
	"excluded" jsonb NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_matching_actor" CHECK (("partner_matching_decisions"."kind"='manual' and "partner_matching_decisions"."actor_id" is not null and "partner_matching_decisions"."system_actor" is null) or ("partner_matching_decisions"."kind"='automatic' and "partner_matching_decisions"."actor_id" is null and "partner_matching_decisions"."system_actor"='partner-continuity-v1' and "partner_matching_decisions"."deviation"=false)),
	CONSTRAINT "partner_matching_shape" CHECK ("partner_matching_decisions"."cycle">0 and ("partner_matching_decisions"."chosen_rank" is null or "partner_matching_decisions"."chosen_rank" between 1 and 100) and length(trim("partner_matching_decisions"."reason")) between 1 and 2000 and "partner_matching_decisions"."basis" ~ '^[a-f0-9]{64}$' and jsonb_typeof("partner_matching_decisions"."ranking")='array' and jsonb_array_length("partner_matching_decisions"."ranking")<=10 and jsonb_typeof("partner_matching_decisions"."excluded")='array')
);
--> statement-breakpoint
ALTER TABLE "partner_matching_decisions" ADD CONSTRAINT "partner_matching_decisions_lead_id_partner_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."partner_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_matching_decisions" ADD CONSTRAINT "partner_matching_decisions_actor_id_identity_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_matching_decisions" ADD CONSTRAINT "partner_matching_decisions_chosen_user_id_identity_users_id_fk" FOREIGN KEY ("chosen_user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_matching_decisions" ADD CONSTRAINT "partner_matching_decisions_top_user_id_identity_users_id_fk" FOREIGN KEY ("top_user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "partner_matching_lead_history" ON "partner_matching_decisions" USING btree ("lead_id","created_at","id");--> statement-breakpoint
-- Decisions are evidence of who chose whom against which ranking: append-only, never rewritten.
CREATE FUNCTION partner_matching_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'matching decisions are immutable' USING ERRCODE='23514';
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_matching_immutable BEFORE UPDATE OR DELETE ON partner_matching_decisions FOR EACH ROW EXECUTE FUNCTION partner_matching_immutable();

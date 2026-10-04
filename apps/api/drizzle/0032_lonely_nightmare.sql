CREATE TABLE "partner_collaborations" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"proposer_id" text NOT NULL,
	"target_id" text NOT NULL,
	"previous_responsible_id" text NOT NULL,
	"category" text NOT NULL,
	"terms" jsonb NOT NULL,
	"state" text DEFAULT 'proposed' NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"response" text DEFAULT '' NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp (3) with time zone,
	"ended_at" timestamp (3) with time zone,
	CONSTRAINT "partner_collaboration_state" CHECK ("partner_collaborations"."state" in ('proposed','accepted','declined','cancelled','ended') and "partner_collaborations"."revision" >= 0),
	CONSTRAINT "partner_collaboration_people" CHECK ("partner_collaborations"."target_id" <> "partner_collaborations"."previous_responsible_id" and "partner_collaborations"."target_id" <> "partner_collaborations"."proposer_id"),
	CONSTRAINT "partner_collaboration_terms" CHECK (coalesce(jsonb_typeof("partner_collaborations"."terms")='object' and "partner_collaborations"."terms"->>'targetId'="partner_collaborations"."target_id" and "partner_collaborations"."terms"->>'mode' in ('one_off','co_advice','transfer') and "partner_collaborations"."terms"->>'access' in ('read','contribute') and "partner_collaborations"."terms"->>'communication' in ('referent_only','client_direct') and "partner_collaborations"."terms"->'existingRightsPreserved'='true'::jsonb and "partner_collaborations"."terms"->'transmissionConfirmed'='true'::jsonb, false))
);
--> statement-breakpoint
ALTER TABLE "partner_contributors" ADD COLUMN "access_scope" text DEFAULT 'advice' NOT NULL;--> statement-breakpoint
ALTER TABLE "partner_contributors" ADD COLUMN "can_contact" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "partner_contributors" ADD COLUMN "collaboration_id" text;--> statement-breakpoint
ALTER TABLE "partner_notifications" ADD COLUMN "collaboration_id" text;--> statement-breakpoint
ALTER TABLE "partner_collaborations" ADD CONSTRAINT "partner_collaborations_lead_id_partner_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."partner_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_collaborations" ADD CONSTRAINT "partner_collaborations_proposer_id_identity_users_id_fk" FOREIGN KEY ("proposer_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_collaborations" ADD CONSTRAINT "partner_collaborations_target_id_identity_users_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_collaborations" ADD CONSTRAINT "partner_collaborations_previous_responsible_id_identity_users_id_fk" FOREIGN KEY ("previous_responsible_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "partner_collaboration_inbox" ON "partner_collaborations" USING btree ("target_id","state","created_at");--> statement-breakpoint
CREATE INDEX "partner_collaboration_lead" ON "partner_collaborations" USING btree ("lead_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_collaboration_pending" ON "partner_collaborations" USING btree ("lead_id","target_id") WHERE "partner_collaborations"."state" = 'proposed';--> statement-breakpoint
ALTER TABLE "partner_contributors" ADD CONSTRAINT "partner_contributors_collaboration_id_partner_collaborations_id_fk" FOREIGN KEY ("collaboration_id") REFERENCES "public"."partner_collaborations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_notifications" ADD CONSTRAINT "partner_notifications_collaboration_id_partner_collaborations_id_fk" FOREIGN KEY ("collaboration_id") REFERENCES "public"."partner_collaborations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_contributors" ADD CONSTRAINT "partner_contributor_scope" CHECK ("partner_contributors"."access_scope" in ('advice','progress') and ("partner_contributors"."access_scope" <> 'progress' or (not "partner_contributors"."can_edit" and not "partner_contributors"."can_contact")));
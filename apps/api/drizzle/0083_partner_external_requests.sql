CREATE TABLE "partner_external_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"request_id" text NOT NULL,
	"fingerprint" text NOT NULL,
	"data" jsonb NOT NULL,
	"lead_id" text,
	"notification" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"claimed_at" timestamp (3) with time zone,
	"notified_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_external_request_state" CHECK ("partner_external_requests"."notification" in ('queued','sending','sent','failed') and "partner_external_requests"."attempts" >= 0 and ("partner_external_requests"."notification" = 'sent') = ("partner_external_requests"."notified_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "partner_events" DROP CONSTRAINT "partner_event_actor";--> statement-breakpoint
ALTER TABLE "partner_leads" ADD COLUMN "restricted_to" text;--> statement-breakpoint
ALTER TABLE "partner_external_requests" ADD CONSTRAINT "partner_external_requests_lead_id_partner_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."partner_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "partner_external_request_once" ON "partner_external_requests" USING btree ("source","request_id");--> statement-breakpoint
CREATE INDEX "partner_external_request_queue" ON "partner_external_requests" USING btree ("created_at","id") WHERE "partner_external_requests"."notification" in ('queued','sending');--> statement-breakpoint
CREATE INDEX "partner_external_request_unlinked" ON "partner_external_requests" USING btree ("created_at","id") WHERE "partner_external_requests"."lead_id" is null;--> statement-breakpoint
CREATE INDEX "partner_external_request_sent" ON "partner_external_requests" USING btree ("notified_at");--> statement-breakpoint
ALTER TABLE "partner_leads" ADD CONSTRAINT "partner_leads_restricted_to_identity_users_id_fk" FOREIGN KEY ("restricted_to") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_events" ADD CONSTRAINT "partner_event_actor" CHECK (("partner_events"."actor_id" is not null and "partner_events"."system_actor" is null) or ("partner_events"."actor_id" is null and "partner_events"."system_actor" is not null and "partner_events"."system_actor" in ('partner-continuity-v1','partner-intake-v1')));--> statement-breakpoint
ALTER TABLE "partner_leads" ADD CONSTRAINT "partner_lead_restricted" CHECK ("partner_leads"."restricted_to" is null or "partner_leads"."responsible_id" is null or "partner_leads"."responsible_id" = "partner_leads"."restricted_to");
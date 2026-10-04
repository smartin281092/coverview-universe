CREATE TABLE "partner_notification_reads" (
	"id" text PRIMARY KEY NOT NULL,
	"notification_id" text NOT NULL,
	"user_id" text NOT NULL,
	"read_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partner_notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"recipient_id" text,
	"audience" text NOT NULL,
	"kind" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"action" text,
	"priority" text NOT NULL,
	"due_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp (3) with time zone,
	CONSTRAINT "partner_notifications_dedupe_key_unique" UNIQUE("dedupe_key"),
	CONSTRAINT "partner_notification_recipient" CHECK (("partner_notifications"."audience" = 'coverview' and "partner_notifications"."recipient_id" is null) or ("partner_notifications"."audience" in ('partner','wallet') and "partner_notifications"."recipient_id" is not null)),
	CONSTRAINT "partner_notification_priority" CHECK ("partner_notifications"."priority" in ('normal','high','urgent'))
);
--> statement-breakpoint
ALTER TABLE "partner_events" ALTER COLUMN "actor_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "partner_events" ADD COLUMN "system_actor" text;--> statement-breakpoint
ALTER TABLE "partner_leads" ADD COLUMN "notification_cycle" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "partner_leads" ADD COLUMN "continuity_checked_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "partner_notification_reads" ADD CONSTRAINT "partner_notification_reads_notification_id_partner_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."partner_notifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_notification_reads" ADD CONSTRAINT "partner_notification_reads_user_id_identity_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_notifications" ADD CONSTRAINT "partner_notifications_lead_id_partner_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."partner_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_notifications" ADD CONSTRAINT "partner_notifications_recipient_id_identity_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "partner_notification_read_once" ON "partner_notification_reads" USING btree ("notification_id","user_id");--> statement-breakpoint
CREATE INDEX "partner_notification_inbox" ON "partner_notifications" USING btree ("recipient_id","created_at","id");--> statement-breakpoint
CREATE INDEX "partner_notification_lead" ON "partner_notifications" USING btree ("lead_id","resolved_at");--> statement-breakpoint
CREATE INDEX "partner_leads_continuity" ON "partner_leads" USING btree ("continuity_checked_at","id") WHERE "partner_leads"."stage" not in ('draft','completed');--> statement-breakpoint
ALTER TABLE "partner_events" ADD CONSTRAINT "partner_event_actor" CHECK (("partner_events"."actor_id" is not null and "partner_events"."system_actor" is null) or ("partner_events"."actor_id" is null and "partner_events"."system_actor" = 'partner-continuity-v1'));
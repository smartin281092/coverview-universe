ALTER TABLE "partner_offers" ADD COLUMN "source_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "partner_offers" ADD COLUMN "reviewed_by" text;--> statement-breakpoint
ALTER TABLE "partner_offers" ADD COLUMN "published_by" text;--> statement-breakpoint
ALTER TABLE "partner_offers" ADD CONSTRAINT "partner_offers_reviewed_by_identity_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_offers" ADD CONSTRAINT "partner_offers_published_by_identity_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "partner_offer_history" ON "partner_offers" USING btree ("lead_id","created_at","id");
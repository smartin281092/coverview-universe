CREATE TABLE "partner_offer_imports" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"document_id" text NOT NULL,
	"checksum" text NOT NULL,
	"created_by" text NOT NULL,
	"offer_id" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_import_checksum" CHECK ("partner_offer_imports"."checksum" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "partner_offer_imports" ADD CONSTRAINT "partner_offer_imports_lead_id_partner_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."partner_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_offer_imports" ADD CONSTRAINT "partner_offer_imports_document_id_files_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_offer_imports" ADD CONSTRAINT "partner_offer_imports_created_by_identity_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_offer_imports" ADD CONSTRAINT "partner_offer_imports_offer_id_partner_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."partner_offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "partner_import_content" ON "partner_offer_imports" USING btree ("lead_id","checksum");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_import_document" ON "partner_offer_imports" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "partner_import_history" ON "partner_offer_imports" USING btree ("lead_id","created_at","id");
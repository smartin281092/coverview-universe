CREATE TABLE "partner_data_exports" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"session_id" text NOT NULL,
	"surface" text NOT NULL,
	"manifest_version" text NOT NULL,
	"complete" boolean DEFAULT false NOT NULL,
	"counts" jsonb NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_data_export_surface" CHECK ("partner_data_exports"."surface" in ('wallet','partner'))
);
--> statement-breakpoint
ALTER TABLE "partner_data_exports" ADD CONSTRAINT "partner_data_exports_user_id_identity_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "partner_data_export_user" ON "partner_data_exports" USING btree ("user_id","created_at","id");--> statement-breakpoint
-- An export proof is written once: it records that a person received a copy of their data.
CREATE FUNCTION partner_data_export_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'partner data export proof is immutable' USING ERRCODE='23514';
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_data_export_immutable BEFORE UPDATE OR DELETE ON partner_data_exports FOR EACH ROW EXECUTE FUNCTION partner_data_export_immutable();

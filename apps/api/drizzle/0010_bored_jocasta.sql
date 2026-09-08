ALTER TABLE "document_change_requests" DROP CONSTRAINT "document_change_requests_field";--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "managed_profile_id" text;--> statement-breakpoint
ALTER TABLE "managed_profile_sections" ADD COLUMN "document_sources" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_user_id_managed_profile_id_managed_profiles_user_id_id_fk" FOREIGN KEY ("user_id","managed_profile_id") REFERENCES "public"."managed_profiles"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "files_profile_list" ON "files" USING btree ("user_id","managed_profile_id","created_at","id");--> statement-breakpoint
ALTER TABLE "document_change_requests" ADD CONSTRAINT "document_change_requests_field" CHECK ("document_change_requests"."field" in ('firstName','lastName','birthDate','nationality','street','postalCode','city','country','phone','contactEmail'));
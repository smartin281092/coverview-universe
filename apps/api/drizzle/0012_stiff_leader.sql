CREATE TABLE "managed_document_identity_attachments" (
	"user_id" text NOT NULL,
	"managed_profile_id" text NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"document_type" text DEFAULT 'unknown' NOT NULL,
	"combined_id" text,
	"front_id" text,
	"back_id" text,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "managed_document_identity_attachment_revision" CHECK ("managed_document_identity_attachments"."revision" >= 0),
	CONSTRAINT "managed_document_identity_attachment_type" CHECK ("managed_document_identity_attachments"."document_type" in ('identity_card','passport','residence_permit','unknown')),
	CONSTRAINT "managed_document_identity_attachment_mode" CHECK ("managed_document_identity_attachments"."combined_id" is null or ("managed_document_identity_attachments"."front_id" is null and "managed_document_identity_attachments"."back_id" is null)),
	CONSTRAINT "managed_document_identity_attachment_faces" CHECK ("managed_document_identity_attachments"."front_id" is null or "managed_document_identity_attachments"."back_id" is null or "managed_document_identity_attachments"."front_id" <> "managed_document_identity_attachments"."back_id")
);
--> statement-breakpoint
ALTER TABLE "document_identity_attachments" ADD COLUMN "document_type" text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "managed_document_identity_attachments" ADD CONSTRAINT "managed_document_identity_attachments_user_id_identity_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "managed_document_identity_attachments" ADD CONSTRAINT "managed_identity_attachment_profile_fk" FOREIGN KEY ("user_id","managed_profile_id") REFERENCES "public"."managed_profiles"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "files_profile_id" ON "files" USING btree ("user_id","managed_profile_id","id");--> statement-breakpoint
ALTER TABLE "managed_document_identity_attachments" ADD CONSTRAINT "managed_identity_attachment_combined_fk" FOREIGN KEY ("user_id","managed_profile_id","combined_id") REFERENCES "public"."files"("user_id","managed_profile_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "managed_document_identity_attachments" ADD CONSTRAINT "managed_identity_attachment_front_fk" FOREIGN KEY ("user_id","managed_profile_id","front_id") REFERENCES "public"."files"("user_id","managed_profile_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "managed_document_identity_attachments" ADD CONSTRAINT "managed_identity_attachment_back_fk" FOREIGN KEY ("user_id","managed_profile_id","back_id") REFERENCES "public"."files"("user_id","managed_profile_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "managed_document_identity_attachment_owner" ON "managed_document_identity_attachments" USING btree ("user_id","managed_profile_id");--> statement-breakpoint
ALTER TABLE "document_identity_attachments" ADD CONSTRAINT "document_identity_attachment_type" CHECK ("document_identity_attachments"."document_type" in ('identity_card','passport','residence_permit','unknown'));
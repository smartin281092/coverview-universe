CREATE TABLE "document_identity_attachment_commands" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"key" text NOT NULL,
	"hash" text NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_identity_attachments" (
	"user_id" text PRIMARY KEY NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"combined_id" text,
	"front_id" text,
	"back_id" text,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_identity_attachment_revision" CHECK ("document_identity_attachments"."revision" >= 0),
	CONSTRAINT "document_identity_attachment_mode" CHECK ("document_identity_attachments"."combined_id" is null or ("document_identity_attachments"."front_id" is null and "document_identity_attachments"."back_id" is null)),
	CONSTRAINT "document_identity_attachment_faces" CHECK ("document_identity_attachments"."front_id" is null or "document_identity_attachments"."back_id" is null or "document_identity_attachments"."front_id" <> "document_identity_attachments"."back_id")
);
--> statement-breakpoint
CREATE TABLE "managed_profile_audit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"session_id" text NOT NULL,
	"profile_id" text NOT NULL,
	"section" text,
	"action" text NOT NULL,
	"revision" integer NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "managed_profile_audit_action" CHECK ("managed_profile_audit_events"."action" in ('profile.created.v1','profile.section_saved.v1')),
	CONSTRAINT "managed_profile_audit_revision" CHECK ("managed_profile_audit_events"."revision" >= 0)
);
--> statement-breakpoint
CREATE TABLE "managed_profile_commands" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"operation" text NOT NULL,
	"key" text NOT NULL,
	"request_hash" text NOT NULL,
	"response" jsonb NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "managed_profile_commands_operation" CHECK ("managed_profile_commands"."operation" in ('create','save_section')),
	CONSTRAINT "managed_profile_commands_hash" CHECK ("managed_profile_commands"."request_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "managed_profile_commands_response" CHECK (jsonb_typeof("managed_profile_commands"."response") = 'object')
);
--> statement-breakpoint
CREATE TABLE "managed_profile_sections" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"managed_profile_id" text,
	"section" text NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"step" text DEFAULT 'information' NOT NULL,
	"values" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"confirmed_at" timestamp (3) with time zone,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "managed_profile_sections_kind" CHECK ("managed_profile_sections"."section" in ('general','finances','health') and ("managed_profile_sections"."managed_profile_id" is not null or "managed_profile_sections"."section" <> 'general')),
	CONSTRAINT "managed_profile_sections_bounds" CHECK ("managed_profile_sections"."revision" >= 0 and jsonb_typeof("managed_profile_sections"."values") = 'object'),
	CONSTRAINT "managed_profile_sections_step" CHECK ("managed_profile_sections"."step" in ('information','details','review'))
);
--> statement-breakpoint
CREATE TABLE "managed_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"display_name" text NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "managed_profiles_kind" CHECK ("managed_profiles"."kind" in ('person','legal_entity')),
	CONSTRAINT "managed_profiles_bounds" CHECK ("managed_profiles"."revision" >= 0 and length("managed_profiles"."display_name") between 1 and 160)
);
--> statement-breakpoint
ALTER TABLE "document_identity_attachment_commands" ADD CONSTRAINT "document_identity_attachment_commands_user_id_identity_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_identity_attachments" ADD CONSTRAINT "document_identity_attachments_user_id_identity_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_identity_attachments" ADD CONSTRAINT "document_identity_attachments_user_id_combined_id_files_user_id_id_fk" FOREIGN KEY ("user_id","combined_id") REFERENCES "public"."files"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_identity_attachments" ADD CONSTRAINT "document_identity_attachments_user_id_front_id_files_user_id_id_fk" FOREIGN KEY ("user_id","front_id") REFERENCES "public"."files"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_identity_attachments" ADD CONSTRAINT "document_identity_attachments_user_id_back_id_files_user_id_id_fk" FOREIGN KEY ("user_id","back_id") REFERENCES "public"."files"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "managed_profile_audit_events" ADD CONSTRAINT "managed_profile_audit_events_user_id_identity_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "managed_profile_commands" ADD CONSTRAINT "managed_profile_commands_user_id_identity_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "managed_profile_sections" ADD CONSTRAINT "managed_profile_sections_user_id_identity_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "managed_profiles_owner_id" ON "managed_profiles" USING btree ("user_id","id");--> statement-breakpoint
ALTER TABLE "managed_profile_sections" ADD CONSTRAINT "managed_profile_sections_user_id_managed_profile_id_managed_profiles_user_id_id_fk" FOREIGN KEY ("user_id","managed_profile_id") REFERENCES "public"."managed_profiles"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "managed_profiles" ADD CONSTRAINT "managed_profiles_user_id_identity_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "document_identity_attachment_commands_key" ON "document_identity_attachment_commands" USING btree ("user_id","key");--> statement-breakpoint
CREATE INDEX "document_identity_attachment_commands_expiry" ON "document_identity_attachment_commands" USING btree ("expires_at","id");--> statement-breakpoint
CREATE INDEX "managed_profile_audit_owner" ON "managed_profile_audit_events" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "managed_profile_commands_key" ON "managed_profile_commands" USING btree ("user_id","operation","key");--> statement-breakpoint
CREATE INDEX "managed_profile_commands_expiry" ON "managed_profile_commands" USING btree ("user_id","expires_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "managed_profile_sections_managed" ON "managed_profile_sections" USING btree ("user_id","managed_profile_id","section") WHERE "managed_profile_sections"."managed_profile_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "managed_profile_sections_self" ON "managed_profile_sections" USING btree ("user_id","section") WHERE "managed_profile_sections"."managed_profile_id" is null;--> statement-breakpoint
CREATE INDEX "managed_profiles_owner_list" ON "managed_profiles" USING btree ("user_id","created_at","id");

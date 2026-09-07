CREATE TABLE "document_ai_calls" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"document_id" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"model" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_audit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"user_id" text NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"revision" integer NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_commands" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"document_id" text NOT NULL,
	"operation" text NOT NULL,
	"key" text NOT NULL,
	"hash" text NOT NULL,
	"response" jsonb NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_decisions" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"user_id" text NOT NULL,
	"session_id" text NOT NULL,
	"revision" integer NOT NULL,
	"decision" jsonb NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_outbox" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"generation" integer NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp (3) with time zone
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"mime" text NOT NULL,
	"declared_mime" text NOT NULL,
	"size" integer NOT NULL,
	"checksum" text NOT NULL,
	"object_key" text NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"category" text DEFAULT 'unknown' NOT NULL,
	"category_corrected" boolean DEFAULT false NOT NULL,
	"analysis_requested" boolean DEFAULT false NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"generation" integer DEFAULT 0 NOT NULL,
	"analysis" jsonb,
	"failure" text,
	"scan_version" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp (3) with time zone,
	CONSTRAINT "files_object_key_unique" UNIQUE("object_key"),
	CONSTRAINT "files_state" CHECK ("files"."state" in ('pending','queued','scanning','reading','ready','failed','quarantined','deleting','deleted')),
	CONSTRAINT "files_category" CHECK ("files"."category" in ('identity','insurance','pension','invoice','correspondence','unknown')),
	CONSTRAINT "files_bounds" CHECK ("files"."size" between 0 and 20971520 and "files"."revision" >= 0 and "files"."generation" >= 0),
	CONSTRAINT "files_checksum" CHECK ("files"."checksum" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "document_ai_calls" ADD CONSTRAINT "document_ai_calls_user_id_identity_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_ai_calls" ADD CONSTRAINT "document_ai_calls_document_id_files_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_audit_events" ADD CONSTRAINT "document_audit_events_document_id_files_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_audit_events" ADD CONSTRAINT "document_audit_events_user_id_identity_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_commands" ADD CONSTRAINT "document_commands_user_id_identity_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_commands" ADD CONSTRAINT "document_commands_document_id_files_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_decisions" ADD CONSTRAINT "document_decisions_document_id_files_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_decisions" ADD CONSTRAINT "document_decisions_user_id_identity_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_outbox" ADD CONSTRAINT "document_outbox_document_id_files_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_outbox" ADD CONSTRAINT "document_outbox_user_id_identity_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_user_id_identity_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_ai_owner_budget" ON "document_ai_calls" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "document_audit_owner" ON "document_audit_events" USING btree ("user_id","document_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "document_commands_idempotency" ON "document_commands" USING btree ("user_id","operation","key");--> statement-breakpoint
CREATE INDEX "document_commands_expiry" ON "document_commands" USING btree ("expires_at","id");--> statement-breakpoint
CREATE INDEX "document_decisions_owner" ON "document_decisions" USING btree ("user_id","document_id","created_at","id");--> statement-breakpoint
CREATE INDEX "document_outbox_pending" ON "document_outbox" USING btree ("published_at","created_at","id");--> statement-breakpoint
CREATE INDEX "files_owner_list" ON "files" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "files_pending" ON "files" USING btree ("state","updated_at","id");
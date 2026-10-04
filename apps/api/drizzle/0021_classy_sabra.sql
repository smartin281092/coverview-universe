CREATE TABLE "insurance_email_challenges" (
	"browser_hash" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"key" text NOT NULL,
	"state" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "insurance_request_commands" (
	"id" text PRIMARY KEY NOT NULL,
	"request_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"key" text NOT NULL,
	"hash" text NOT NULL,
	"state" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "insurance_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"browser_hash" text NOT NULL,
	"user_id" text,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"state" text DEFAULT 'draft' NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"save_in_wallet" boolean DEFAULT false NOT NULL,
	"legal_version" text,
	"submit_hash" text,
	"submit_key" text,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"draft" jsonb,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp (3) with time zone,
	CONSTRAINT "insurance_requests_hash" CHECK ("insurance_requests"."browser_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "insurance_requests_state" CHECK ("insurance_requests"."state" in ('draft','submitted','reviewing','insurer_contacted','offer_ready','completed','cancelled')),
	CONSTRAINT "insurance_requests_revision" CHECK ("insurance_requests"."revision" >= 0)
);
--> statement-breakpoint
ALTER TABLE "insurance_request_commands" ADD CONSTRAINT "insurance_request_commands_request_id_insurance_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."insurance_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insurance_requests" ADD CONSTRAINT "insurance_requests_user_id_identity_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "insurance_email_rate" ON "insurance_email_challenges" USING btree ("email","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "insurance_request_commands_key" ON "insurance_request_commands" USING btree ("request_id","actor_id","key");--> statement-breakpoint
CREATE INDEX "insurance_requests_owner_list" ON "insurance_requests" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "insurance_requests_admin_list" ON "insurance_requests" USING btree ("state","created_at","id");--> statement-breakpoint
CREATE INDEX "insurance_requests_browser" ON "insurance_requests" USING btree ("browser_hash","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "insurance_requests_active_draft" ON "insurance_requests" USING btree ("browser_hash") WHERE "insurance_requests"."state" = 'draft';
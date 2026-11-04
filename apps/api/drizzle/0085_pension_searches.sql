CREATE TABLE "pension_search_challenges" (
	"browser_hash" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"email_hash" text NOT NULL,
	"key" text NOT NULL,
	"state" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "pension_search_challenges_hash" CHECK ("pension_search_challenges"."browser_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "pension_search_commands" (
	"id" text PRIMARY KEY NOT NULL,
	"search_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"key" text NOT NULL,
	"hash" text NOT NULL,
	"state" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pension_searches" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"email" text NOT NULL,
	"state" text DEFAULT 'submitted' NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"details" jsonb NOT NULL,
	"mandate_version" text NOT NULL,
	"submit_key" text NOT NULL,
	"submit_hash" text NOT NULL,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pension_searches_id" CHECK ("pension_searches"."id" ~ '^lpp_[0-9a-f-]{36}$'),
	CONSTRAINT "pension_searches_state" CHECK ("pension_searches"."state" in ('submitted','reviewing','search_sent','results_received','completed','cancelled')),
	CONSTRAINT "pension_searches_revision" CHECK ("pension_searches"."revision" >= 0)
);
--> statement-breakpoint
ALTER TABLE "pension_search_commands" ADD CONSTRAINT "pension_search_commands_search_id_pension_searches_id_fk" FOREIGN KEY ("search_id") REFERENCES "public"."pension_searches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pension_searches" ADD CONSTRAINT "pension_searches_user_id_identity_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pension_search_challenges_email" ON "pension_search_challenges" USING btree ("email_hash","created_at");--> statement-breakpoint
CREATE INDEX "pension_search_challenges_expiry" ON "pension_search_challenges" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "pension_search_commands_key" ON "pension_search_commands" USING btree ("search_id","actor_id","key");--> statement-breakpoint
CREATE INDEX "pension_searches_owner_list" ON "pension_searches" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "pension_searches_admin_list" ON "pension_searches" USING btree ("state","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "pension_searches_submit_key" ON "pension_searches" USING btree ("user_id","submit_key");
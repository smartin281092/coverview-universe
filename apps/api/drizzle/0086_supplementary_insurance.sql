CREATE TABLE "supplementary_catalogs" (
	"id" text PRIMARY KEY NOT NULL,
	"year" integer NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "supplementary_catalog_id" CHECK ("supplementary_catalogs"."id" ~ '^slc_[0-9]{4}_[0-9a-f]{24}$')
);
--> statement-breakpoint
CREATE TABLE "supplementary_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"request_id" text NOT NULL,
	"reference" text NOT NULL,
	"fingerprint" text NOT NULL,
	"catalog_id" text NOT NULL,
	"product_key" text NOT NULL,
	"data" jsonb NOT NULL,
	"notification" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"claimed_at" timestamp (3) with time zone,
	"notified_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "supplementary_order_state" CHECK ("supplementary_orders"."notification" in ('queued','sending','sent','failed') and "supplementary_orders"."attempts" >= 0 and ("supplementary_orders"."notification" = 'sent') = ("supplementary_orders"."notified_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "supplementary_premiums" (
	"catalog_id" text NOT NULL,
	"insurer" text NOT NULL,
	"product_key" text NOT NULL,
	"variant" text NOT NULL,
	"option" text NOT NULL,
	"birth_year" integer NOT NULL,
	"sex" text NOT NULL,
	"postal_code" text NOT NULL,
	"accident" boolean,
	"monthly_minor" integer NOT NULL,
	"note" text,
	CONSTRAINT "supplementary_premium_once" UNIQUE NULLS NOT DISTINCT("catalog_id","product_key","variant","option","birth_year","sex","postal_code","accident"),
	CONSTRAINT "supplementary_premium_valid" CHECK ("supplementary_premiums"."sex" in ('female','male') and "supplementary_premiums"."monthly_minor" >= 0 and "supplementary_premiums"."postal_code" ~ '^[0-9]{4}$')
);
--> statement-breakpoint
ALTER TABLE "supplementary_orders" ADD CONSTRAINT "supplementary_orders_catalog_id_supplementary_catalogs_id_fk" FOREIGN KEY ("catalog_id") REFERENCES "public"."supplementary_catalogs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplementary_premiums" ADD CONSTRAINT "supplementary_premiums_catalog_id_supplementary_catalogs_id_fk" FOREIGN KEY ("catalog_id") REFERENCES "public"."supplementary_catalogs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "supplementary_catalog_year" ON "supplementary_catalogs" USING btree ("year","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "supplementary_order_once" ON "supplementary_orders" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "supplementary_order_queue" ON "supplementary_orders" USING btree ("created_at","id") WHERE "supplementary_orders"."notification" in ('queued','sending');--> statement-breakpoint
CREATE INDEX "supplementary_order_sent" ON "supplementary_orders" USING btree ("notified_at");--> statement-breakpoint
CREATE INDEX "supplementary_premium_profile" ON "supplementary_premiums" USING btree ("catalog_id","birth_year","postal_code");
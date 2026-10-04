CREATE TABLE "partner_convention_decisions" (
	"id" text PRIMARY KEY NOT NULL,
	"declaration_id" text NOT NULL,
	"user_id" text NOT NULL,
	"category" text NOT NULL,
	"company_id" text NOT NULL,
	"revision" integer NOT NULL,
	"decision" text NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"scope" text DEFAULT '' NOT NULL,
	"coverage" text,
	"valid_until" timestamp (3) with time zone,
	"valid_from" timestamp (3) with time zone,
	"member_covered" boolean DEFAULT false NOT NULL,
	"document_revision" integer NOT NULL,
	"decided_by" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_convention_decision_bounds" CHECK ("partner_convention_decisions"."revision">0 and "partner_convention_decisions"."document_revision">=0 and "partner_convention_decisions"."decision" in ('submitted','reviewed','needs_information','rejected','withdrawn') and length("partner_convention_decisions"."reason")<=2000 and length("partner_convention_decisions"."scope")<=2000 and ("partner_convention_decisions"."decision"='submitted' or length(trim("partner_convention_decisions"."reason"))>0)),
	CONSTRAINT "partner_convention_review_scope" CHECK (case when "partner_convention_decisions"."decision"='reviewed' then ("partner_convention_decisions"."decided_by"<>"partner_convention_decisions"."user_id" and length(trim("partner_convention_decisions"."scope"))>0 and "partner_convention_decisions"."coverage" is not null and "partner_convention_decisions"."coverage" in ('category','limited') and "partner_convention_decisions"."member_covered"=true and "partner_convention_decisions"."valid_from" is not null and "partner_convention_decisions"."valid_until" is not null and "partner_convention_decisions"."valid_until">"partner_convention_decisions"."valid_from" and "partner_convention_decisions"."valid_until">"partner_convention_decisions"."created_at") else ("partner_convention_decisions"."coverage" is null and "partner_convention_decisions"."member_covered"=false and "partner_convention_decisions"."valid_from" is null and "partner_convention_decisions"."valid_until" is null and "partner_convention_decisions"."scope"='') end)
);
--> statement-breakpoint
CREATE TABLE "partner_convention_declarations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"category" text NOT NULL,
	"company_id" text NOT NULL,
	"declaration" text NOT NULL,
	"document_id" text NOT NULL,
	"checksum" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_convention_declaration_bounds" CHECK ("partner_convention_declarations"."company_id" in ('allianz','assura','automate','axa','baloise','css','generali','groupe-mutuel','helsana','liechtenstein-life','tsm') and "partner_convention_declarations"."category" in ('health','vehicle','pension','household','legal','business','other') and length(trim("partner_convention_declarations"."declaration")) between 1 and 2000 and "partner_convention_declarations"."checksum" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "files" DROP CONSTRAINT "files_purpose";--> statement-breakpoint
ALTER TABLE "partner_convention_decisions" ADD CONSTRAINT "partner_convention_decisions_decided_by_identity_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "partner_convention_subject" ON "partner_convention_declarations" USING btree ("id","user_id","category","company_id");--> statement-breakpoint
ALTER TABLE "partner_convention_decisions" ADD CONSTRAINT "partner_convention_decision_subject" FOREIGN KEY ("declaration_id","user_id","category","company_id") REFERENCES "public"."partner_convention_declarations"("id","user_id","category","company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_convention_declarations" ADD CONSTRAINT "partner_convention_declarations_user_id_identity_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_convention_declarations" ADD CONSTRAINT "partner_convention_declarations_organization_id_partner_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."partner_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_convention_declarations" ADD CONSTRAINT "partner_convention_declarations_document_id_files_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "partner_convention_revision" ON "partner_convention_decisions" USING btree ("user_id","category","company_id","revision");--> statement-breakpoint
CREATE INDEX "partner_convention_document" ON "partner_convention_declarations" USING btree ("document_id");--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_purpose" CHECK ("files"."purpose" is null or "files"."purpose" in ('identity_card','lead_offer','partner_competence','partner_convention'));
CREATE TABLE "partner_competence_decisions" (
	"id" text PRIMARY KEY NOT NULL,
	"declaration_id" text NOT NULL,
	"user_id" text NOT NULL,
	"category" text NOT NULL,
	"revision" integer NOT NULL,
	"decision" text NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"scope" text DEFAULT '' NOT NULL,
	"coverage" text,
	"valid_until" timestamp (3) with time zone,
	"document_revision" integer NOT NULL,
	"decided_by" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_competence_decision_bounds" CHECK ("partner_competence_decisions"."revision">0 and "partner_competence_decisions"."document_revision">=0 and "partner_competence_decisions"."decision" in ('submitted','reviewed','needs_information','rejected','withdrawn') and length("partner_competence_decisions"."reason")<=2000 and length("partner_competence_decisions"."scope")<=2000 and ("partner_competence_decisions"."decision"='submitted' or length(trim("partner_competence_decisions"."reason"))>0)),
	CONSTRAINT "partner_competence_review_scope" CHECK (case when "partner_competence_decisions"."decision"='reviewed' then ("partner_competence_decisions"."decided_by"<>"partner_competence_decisions"."user_id" and length(trim("partner_competence_decisions"."scope"))>0 and "partner_competence_decisions"."coverage" is not null and "partner_competence_decisions"."coverage" in ('category','limited') and "partner_competence_decisions"."valid_until" is not null and "partner_competence_decisions"."valid_until">"partner_competence_decisions"."created_at") else ("partner_competence_decisions"."coverage" is null and "partner_competence_decisions"."valid_until" is null and "partner_competence_decisions"."scope"='') end)
);
--> statement-breakpoint
CREATE TABLE "partner_competence_declarations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"category" text NOT NULL,
	"declaration" text NOT NULL,
	"document_id" text NOT NULL,
	"checksum" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_competence_declaration_bounds" CHECK ("partner_competence_declarations"."category" in ('health','vehicle','pension','household','legal','business','other') and length(trim("partner_competence_declarations"."declaration")) between 1 and 2000 and "partner_competence_declarations"."checksum" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "files" DROP CONSTRAINT "files_purpose";--> statement-breakpoint
ALTER TABLE "partner_competence_decisions" ADD CONSTRAINT "partner_competence_decisions_decided_by_identity_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "partner_competence_subject" ON "partner_competence_declarations" USING btree ("id","user_id","category");--> statement-breakpoint
ALTER TABLE "partner_competence_decisions" ADD CONSTRAINT "partner_competence_decision_subject" FOREIGN KEY ("declaration_id","user_id","category") REFERENCES "public"."partner_competence_declarations"("id","user_id","category") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_competence_declarations" ADD CONSTRAINT "partner_competence_declarations_user_id_identity_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_competence_declarations" ADD CONSTRAINT "partner_competence_declarations_organization_id_partner_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."partner_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_competence_declarations" ADD CONSTRAINT "partner_competence_declarations_document_id_files_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "partner_competence_revision" ON "partner_competence_decisions" USING btree ("user_id","category","revision");--> statement-breakpoint
CREATE INDEX "partner_competence_document" ON "partner_competence_declarations" USING btree ("document_id");--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_purpose" CHECK ("files"."purpose" is null or "files"."purpose" in ('identity_card','lead_offer','partner_competence'));
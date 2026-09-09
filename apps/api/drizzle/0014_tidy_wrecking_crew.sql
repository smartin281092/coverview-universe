CREATE TABLE "company_action_audit" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"request_id" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"session_id" text NOT NULL,
	"state" text NOT NULL,
	"revision" integer NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_action_audit_bounds" CHECK ("company_action_audit"."revision" >= 0 and "company_action_audit"."state" in ('requested','in_progress','notified','confirmed'))
);
--> statement-breakpoint
CREATE TABLE "company_action_commands" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"session_id" text NOT NULL,
	"operation" text NOT NULL,
	"key" text NOT NULL,
	"request_hash" text NOT NULL,
	"response" jsonb NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "company_action_commands_bounds" CHECK ("company_action_commands"."operation" in ('request','transition') and "company_action_commands"."request_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "company_action_evidence" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"request_id" text NOT NULL,
	"kind" text NOT NULL,
	"occurred_at" timestamp (3) with time zone NOT NULL,
	"recorded_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"reference" text NOT NULL,
	"administrator_user_id" text NOT NULL,
	CONSTRAINT "company_action_evidence_kind" CHECK ("company_action_evidence"."kind" in ('notified','confirmed')),
	CONSTRAINT "company_action_evidence_bounds" CHECK (length("company_action_evidence"."reference") between 1 and 500 and "company_action_evidence"."occurred_at" <= "company_action_evidence"."recorded_at")
);
--> statement-breakpoint
CREATE TABLE "company_service_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"managed_profile_id" text,
	"profile_id" text NOT NULL,
	"profile_name" text NOT NULL,
	"company_id" text NOT NULL,
	"field_group" text NOT NULL,
	"values" jsonb NOT NULL,
	"values_hash" text NOT NULL,
	"profile_revision" integer NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"state" text DEFAULT 'requested' NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_service_requests_target" CHECK (("company_service_requests"."profile_id" = 'self' and "company_service_requests"."managed_profile_id" is null) or ("company_service_requests"."profile_id" = "company_service_requests"."managed_profile_id" and "company_service_requests"."managed_profile_id" is not null)),
	CONSTRAINT "company_service_requests_state" CHECK ("company_service_requests"."state" in ('requested','in_progress','notified','confirmed')),
	CONSTRAINT "company_service_requests_group" CHECK ("company_service_requests"."field_group" in ('address','phone','contactEmail','firstName','lastName','birthDate','nationality','companyName','registrationNumber')),
	CONSTRAINT "company_service_requests_company" CHECK ("company_service_requests"."company_id" in ('allianz','assura','automate','axa','baloise','css','generali','groupe-mutuel','helsana','liechtenstein-life','tsm')),
	CONSTRAINT "company_service_requests_bounds" CHECK ("company_service_requests"."revision" >= 0 and "company_service_requests"."profile_revision" >= 0 and jsonb_typeof("company_service_requests"."values") = 'object' and octet_length("company_service_requests"."values"::text) <= 8192 and "company_service_requests"."values_hash" ~ '^[0-9a-f]{64}$' and length("company_service_requests"."profile_name") between 1 and 160)
);
--> statement-breakpoint
CREATE TABLE "document_field_corrections" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"document_id" text NOT NULL,
	"generation" integer NOT NULL,
	"extraction_id" text NOT NULL,
	"field" text NOT NULL,
	"value" text NOT NULL,
	"document_revision" integer NOT NULL,
	"actor" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_field_corrections_bounds" CHECK ("document_field_corrections"."generation" >= 0 and "document_field_corrections"."document_revision" >= 0 and length("document_field_corrections"."value") between 1 and 240),
	CONSTRAINT "document_field_corrections_field" CHECK ("document_field_corrections"."field" in ('firstName','lastName','birthDate','nationality','street','postalCode','city','country','documentNumber','documentType','expiresOn','phone','contactEmail','companyName','registrationNumber'))
);
--> statement-breakpoint
-- Referenced composite key must exist before the new foreign keys are installed.
CREATE UNIQUE INDEX "company_service_requests_owner_id" ON "company_service_requests" USING btree ("user_id","id");--> statement-breakpoint
ALTER TABLE "company_action_audit" ADD CONSTRAINT "company_action_audit_user_id_identity_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_action_audit" ADD CONSTRAINT "company_action_audit_actor_user_id_identity_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_action_audit" ADD CONSTRAINT "company_action_audit_user_id_request_id_company_service_requests_user_id_id_fk" FOREIGN KEY ("user_id","request_id") REFERENCES "public"."company_service_requests"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_action_commands" ADD CONSTRAINT "company_action_commands_user_id_identity_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_action_commands" ADD CONSTRAINT "company_action_commands_actor_user_id_identity_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_action_evidence" ADD CONSTRAINT "company_action_evidence_user_id_identity_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_action_evidence" ADD CONSTRAINT "company_action_evidence_administrator_user_id_identity_users_id_fk" FOREIGN KEY ("administrator_user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_action_evidence" ADD CONSTRAINT "company_action_evidence_user_id_request_id_company_service_requests_user_id_id_fk" FOREIGN KEY ("user_id","request_id") REFERENCES "public"."company_service_requests"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_service_requests" ADD CONSTRAINT "company_service_requests_user_id_identity_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_service_requests" ADD CONSTRAINT "company_service_requests_user_id_managed_profile_id_managed_profiles_user_id_id_fk" FOREIGN KEY ("user_id","managed_profile_id") REFERENCES "public"."managed_profiles"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_field_corrections" ADD CONSTRAINT "document_field_corrections_user_id_document_id_files_user_id_id_fk" FOREIGN KEY ("user_id","document_id") REFERENCES "public"."files"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "company_action_audit_owner" ON "company_action_audit" USING btree ("user_id","request_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "company_action_commands_key" ON "company_action_commands" USING btree ("user_id","actor_user_id","operation","key");--> statement-breakpoint
CREATE INDEX "company_action_commands_expiry" ON "company_action_commands" USING btree ("expires_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "company_action_evidence_request_kind" ON "company_action_evidence" USING btree ("user_id","request_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "company_service_requests_active" ON "company_service_requests" USING btree ("user_id","profile_id","company_id","field_group","values_hash") WHERE "company_service_requests"."state" in ('requested','in_progress');--> statement-breakpoint
CREATE INDEX "company_service_requests_owner_list" ON "company_service_requests" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "company_service_requests_admin_list" ON "company_service_requests" USING btree ("state","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "document_field_corrections_revision" ON "document_field_corrections" USING btree ("user_id","document_id","generation","extraction_id","document_revision");--> statement-breakpoint
CREATE INDEX "document_field_corrections_current" ON "document_field_corrections" USING btree ("user_id","document_id","generation","extraction_id");--> statement-breakpoint
-- Legacy corrections: only a review receipt identifying the current extraction is sufficient evidence.
INSERT INTO document_field_corrections
  (id, user_id, document_id, generation, extraction_id, field, value, document_revision, actor, created_at)
SELECT DISTINCT ON (f.user_id, f.id, f.generation, extracted.item->>'id', decision.revision)
  gen_random_uuid()::text, f.user_id, f.id, f.generation, extracted.item->>'id', accepted.item->>'field',
  accepted.item->>'value', decision.revision, decision.session_id, decision.created_at
FROM document_commands receipt
JOIN files f ON f.user_id = receipt.user_id AND f.id = receipt.document_id
JOIN document_decisions decision ON decision.user_id = f.user_id AND decision.document_id = f.id
  AND decision.revision = (receipt.response#>>'{document,revision}')::integer
CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(receipt.response#>'{document,analysis,fields}') = 'array'
  THEN receipt.response#>'{document,analysis,fields}' ELSE '[]'::jsonb END) AS extracted(item)
CROSS JOIN LATERAL jsonb_array_elements(decision.decision->'fields') AS accepted(item)
WHERE receipt.operation = 'reviewed' AND f.deleted_at IS NULL
  AND decision.decision->>'action' = 'review'
  AND accepted.item->>'choice' IN ('use','correct')
  AND accepted.item->>'field' = extracted.item->>'field'
  AND length(accepted.item->>'value') BETWEEN 1 AND 240
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(f.analysis->'fields') AS current(item)
    WHERE current.item->>'id' = extracted.item->>'id' AND current.item->>'field' = accepted.item->>'field')
ORDER BY f.user_id, f.id, f.generation, extracted.item->>'id', decision.revision
ON CONFLICT (user_id, document_id, generation, extraction_id, document_revision) DO NOTHING;

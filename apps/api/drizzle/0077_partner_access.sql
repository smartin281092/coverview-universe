CREATE TABLE "partner_access_decisions" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text,
	"kind" text NOT NULL,
	"state" text,
	"roles" jsonb,
	"restrictions" jsonb,
	"reason" text,
	"review_due_at" timestamp (3) with time zone,
	"actor_id" text,
	"system_actor" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_access_decision_kind" CHECK ("partner_access_decisions"."kind" in ('member_review','organization_review','restriction','automatic_review','team_removal')),
	CONSTRAINT "partner_access_decision_actor" CHECK (("partner_access_decisions"."actor_id" is not null and "partner_access_decisions"."system_actor" is null and "partner_access_decisions"."kind"<>'automatic_review') or ("partner_access_decisions"."actor_id" is null and "partner_access_decisions"."system_actor"='partner-continuity-v1' and "partner_access_decisions"."kind"='automatic_review')),
	CONSTRAINT "partner_access_decision_subject" CHECK (("partner_access_decisions"."kind"='organization_review' and "partner_access_decisions"."user_id" is null) or ("partner_access_decisions"."kind" in ('member_review','restriction','team_removal') and "partner_access_decisions"."user_id" is not null) or "partner_access_decisions"."kind"='automatic_review'),
	CONSTRAINT "partner_access_decision_reason" CHECK (case when "partner_access_decisions"."kind"='automatic_review' then "partner_access_decisions"."reason" is null else length(trim("partner_access_decisions"."reason")) between 5 and 2000 end),
	CONSTRAINT "partner_access_decision_state" CHECK ("partner_access_decisions"."state" is null or "partner_access_decisions"."state" in ('needs_information','approved','rejected','suspended','closed'))
);
--> statement-breakpoint
ALTER TABLE "partner_members" ADD COLUMN "restrictions" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "partner_members" ADD COLUMN "restriction_revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "partner_organizations" ADD COLUMN "revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "partner_organizations" ADD COLUMN "review_due_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "partner_access_decisions" ADD CONSTRAINT "partner_access_decisions_organization_id_partner_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."partner_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_access_decisions" ADD CONSTRAINT "partner_access_decisions_user_id_identity_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_access_decisions" ADD CONSTRAINT "partner_access_decisions_actor_id_identity_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "partner_access_decisions_user" ON "partner_access_decisions" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "partner_access_decisions_organization" ON "partner_access_decisions" USING btree ("organization_id","created_at","id");--> statement-breakpoint
ALTER TABLE "partner_members" ADD CONSTRAINT "partner_member_restrictions" CHECK (jsonb_typeof("partner_members"."restrictions")='object' and "partner_members"."restriction_revision" >= 0);--> statement-breakpoint
ALTER TABLE "partner_organizations" ADD CONSTRAINT "partner_org_revision" CHECK ("partner_organizations"."revision" >= 0);--> statement-breakpoint
-- Handwritten guard. A decision about a member or an organisation is written once (C8a).
CREATE FUNCTION partner_access_decision_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'partner access decision is immutable' USING ERRCODE='23514';
END $$;
--> statement-breakpoint
CREATE TRIGGER partner_access_decision_immutable BEFORE UPDATE OR DELETE ON partner_access_decisions FOR EACH ROW EXECUTE FUNCTION partner_access_decision_immutable();

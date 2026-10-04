CREATE TABLE "partner_referent_selections" (
	"id" text PRIMARY KEY NOT NULL,
	"subject_id" text NOT NULL,
	"self_user_id" text,
	"profile_id" text,
	"subject_revision" integer NOT NULL,
	"category" text NOT NULL,
	"revision" integer NOT NULL,
	"advisor_id" text,
	"confirmed_by" text NOT NULL,
	"confirmation_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_referent_subject" CHECK (("partner_referent_selections"."profile_id" is not null and "partner_referent_selections"."self_user_id" is null and "partner_referent_selections"."subject_id"='profile:'||"partner_referent_selections"."profile_id") or ("partner_referent_selections"."profile_id" is null and "partner_referent_selections"."self_user_id" is not null and "partner_referent_selections"."subject_id"='self:'||"partner_referent_selections"."self_user_id" and "partner_referent_selections"."confirmed_by"="partner_referent_selections"."self_user_id" and "partner_referent_selections"."subject_revision"=0)),
	CONSTRAINT "partner_referent_bounds" CHECK ("partner_referent_selections"."revision">0 and "partner_referent_selections"."subject_revision">=0 and "partner_referent_selections"."confirmation_version"=1 and "partner_referent_selections"."category" in ('health','vehicle','pension','household','legal','business','other'))
);
--> statement-breakpoint
ALTER TABLE "partner_referent_selections" ADD CONSTRAINT "partner_referent_selections_self_user_id_identity_users_id_fk" FOREIGN KEY ("self_user_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_referent_selections" ADD CONSTRAINT "partner_referent_selections_profile_id_managed_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."managed_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_referent_selections" ADD CONSTRAINT "partner_referent_selections_advisor_id_identity_users_id_fk" FOREIGN KEY ("advisor_id") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_referent_selections" ADD CONSTRAINT "partner_referent_selections_confirmed_by_identity_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."identity_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "partner_referent_revision" ON "partner_referent_selections" USING btree ("subject_id","category","revision");
ALTER TABLE "profile_drafts" DROP CONSTRAINT "profile_drafts_step";--> statement-breakpoint
ALTER TABLE "identity_profiles" DROP CONSTRAINT "identity_profiles_step";--> statement-breakpoint
ALTER TABLE "managed_profile_sections" DROP CONSTRAINT "managed_profile_sections_step";--> statement-breakpoint
ALTER TABLE "profile_drafts" ADD CONSTRAINT "profile_drafts_step" CHECK ("profile_drafts"."step" in ('information', 'contact', 'address', 'review'));--> statement-breakpoint
ALTER TABLE "identity_profiles" ADD CONSTRAINT "identity_profiles_step" CHECK ("identity_profiles"."step" in ('information', 'contact', 'address', 'review'));--> statement-breakpoint
ALTER TABLE "managed_profile_sections" ADD CONSTRAINT "managed_profile_sections_step" CHECK ("managed_profile_sections"."step" in ('information','contact','details','review') and ("managed_profile_sections"."step" <> 'contact' or "managed_profile_sections"."section" = 'general'));
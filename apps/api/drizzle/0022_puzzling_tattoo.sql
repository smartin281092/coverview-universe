CREATE TABLE "insurance_email_reservations" (
	"email_hash" text PRIMARY KEY NOT NULL,
	"reserved_at" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "insurance_request_commands" DROP CONSTRAINT "insurance_request_commands_request_id_insurance_requests_id_fk";
--> statement-breakpoint
DROP INDEX "insurance_requests_active_draft";--> statement-breakpoint
ALTER TABLE "insurance_request_commands" ADD CONSTRAINT "insurance_request_commands_request_id_insurance_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."insurance_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "insurance_requests_guest_draft" ON "insurance_requests" USING btree ("browser_hash") WHERE "insurance_requests"."state" = 'draft' and "insurance_requests"."user_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "insurance_requests_owner_draft" ON "insurance_requests" USING btree ("browser_hash","user_id") WHERE "insurance_requests"."state" = 'draft' and "insurance_requests"."user_id" is not null;
ALTER TABLE "opportunity_quotes" ADD COLUMN "follow_up_id" uuid;--> statement-breakpoint
ALTER TABLE "opportunity_quotes" ADD CONSTRAINT "opportunity_quotes_follow_up_id_opportunity_follow_ups_id_fk" FOREIGN KEY ("follow_up_id") REFERENCES "public"."opportunity_follow_ups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "opportunity_quotes_follow_up_uq" ON "opportunity_quotes" USING btree ("follow_up_id");

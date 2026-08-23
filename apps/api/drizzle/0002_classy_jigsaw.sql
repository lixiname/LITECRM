CREATE TABLE "complaint_follow_ups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"complaint_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"content" text NOT NULL,
	"next_follow_up_date" date,
	"outcome" text NOT NULL,
	"resolution" text,
	CONSTRAINT "follow_ups_outcome_check" CHECK ("complaint_follow_ups"."outcome" in ('followed_up','resolved'))
);
--> statement-breakpoint
CREATE TABLE "complaints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"customer_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'registered' NOT NULL,
	"description" text NOT NULL,
	"next_follow_up_date" date,
	"resolution" text,
	"resolved_at" timestamp with time zone,
	"entry_source" text,
	"entry_ref_id" uuid,
	CONSTRAINT "complaints_type_check" CHECK ("complaints"."type" in ('product_quality','delivery','service','logistics','price','other')),
	CONSTRAINT "complaints_status_check" CHECK ("complaints"."status" in ('registered','resolved'))
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"customer_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"amount" numeric(14, 2),
	"product_line" text,
	"trade_type" text,
	"note" text,
	"source_opportunity_id" uuid,
	"entry_source" text,
	"entry_ref_id" uuid,
	CONSTRAINT "deals_trade_type_check" CHECK ("deals"."trade_type" in ('equipment','consumable','part','service'))
);
--> statement-breakpoint
CREATE TABLE "opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"customer_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"stage" text DEFAULT 'intent' NOT NULL,
	"source" text NOT NULL,
	"product_line" text,
	"source_record_id" uuid,
	"amount_type" text DEFAULT 'oral' NOT NULL,
	"amount" numeric(14, 2),
	"approximate" boolean DEFAULT false NOT NULL,
	"amount_note" text,
	"discovered_date" date,
	"expected_close_date" date,
	"last_follow_up_at" timestamp with time zone,
	"next_action" text,
	"next_follow_up_date" date,
	"closed_at" timestamp with time zone,
	"close_reason" text,
	"notes" text,
	"entry_source" text,
	"entry_ref_id" uuid,
	CONSTRAINT "opportunities_stage_check" CHECK ("opportunities"."stage" in ('intent','following','ordered','lost','demand_disappeared')),
	CONSTRAINT "opportunities_amount_type_check" CHECK ("opportunities"."amount_type" in ('oral','quoted')),
	CONSTRAINT "opportunities_source_check" CHECK ("opportunities"."source" in ('referral','cold_call','exhibition','online','other'))
);
--> statement-breakpoint
CREATE TABLE "opportunity_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb,
	CONSTRAINT "opportunity_events_type_check" CHECK ("opportunity_events"."type" in ('created','stage_changed','updated'))
);
--> statement-breakpoint
CREATE TABLE "visit_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"customer_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"method" text NOT NULL,
	"visit_type" text,
	"business_situation" text,
	"equipment_situation" text,
	"personnel_changes" text,
	"next_follow_up_date" date,
	"next_follow_up_action" text,
	"entry_source" text,
	"entry_ref_id" uuid,
	CONSTRAINT "visits_method_check" CHECK ("visit_records"."method" in ('offline_visit','remote','other')),
	CONSTRAINT "visits_type_check" CHECK ("visit_records"."visit_type" in ('new_customer','existing_maintenance','industry_relation'))
);
--> statement-breakpoint
ALTER TABLE "complaint_follow_ups" ADD CONSTRAINT "complaint_follow_ups_complaint_id_complaints_id_fk" FOREIGN KEY ("complaint_id") REFERENCES "public"."complaints"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaint_follow_ups" ADD CONSTRAINT "complaint_follow_ups_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_source_opportunity_id_opportunities_id_fk" FOREIGN KEY ("source_opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_source_record_id_visit_records_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."visit_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_events" ADD CONSTRAINT "opportunity_events_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_events" ADD CONSTRAINT "opportunity_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_records" ADD CONSTRAINT "visit_records_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_records" ADD CONSTRAINT "visit_records_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "follow_ups_complaint_idx" ON "complaint_follow_ups" USING btree ("complaint_id");--> statement-breakpoint
CREATE INDEX "complaints_customer_idx" ON "complaints" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "complaints_status_followup_idx" ON "complaints" USING btree ("status","next_follow_up_date");--> statement-breakpoint
CREATE INDEX "deals_customer_idx" ON "deals" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "opportunities_customer_idx" ON "opportunities" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "opportunities_owner_stage_idx" ON "opportunities" USING btree ("owner_id","stage");--> statement-breakpoint
CREATE INDEX "opportunities_followup_idx" ON "opportunities" USING btree ("next_follow_up_date");--> statement-breakpoint
CREATE INDEX "opportunity_events_opp_occurred_idx" ON "opportunity_events" USING btree ("opportunity_id","occurred_at");--> statement-breakpoint
CREATE INDEX "visits_customer_idx" ON "visit_records" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "visits_owner_occurred_idx" ON "visit_records" USING btree ("owner_id","occurred_at");
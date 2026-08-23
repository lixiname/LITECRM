CREATE TABLE "business_weeks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"name" text NOT NULL,
	"week_start" date NOT NULL,
	"week_end" date NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"owner_id" uuid NOT NULL,
	"expense_date" date NOT NULL,
	"tobacco_alcohol" numeric(12, 2) DEFAULT '0' NOT NULL,
	"gifts" numeric(12, 2) DEFAULT '0' NOT NULL,
	"dining" numeric(12, 2) DEFAULT '0' NOT NULL,
	"entertainment" numeric(12, 2) DEFAULT '0' NOT NULL,
	"lodging" numeric(12, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"submitted_at" timestamp with time zone,
	"entry_source" text,
	"entry_ref_id" uuid,
	CONSTRAINT "daily_expenses_status_check" CHECK ("daily_expenses"."status" in ('draft','submitted','voided'))
);
--> statement-breakpoint
CREATE TABLE "management_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"content" text NOT NULL,
	"read_at" timestamp with time zone,
	CONSTRAINT "comments_target_type_check" CHECK ("management_comments"."target_type" in ('weekly_plan','weekly_plan_item','visit'))
);
--> statement-breakpoint
CREATE TABLE "weekly_plan_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"plan_id" uuid NOT NULL,
	"planned_date" date NOT NULL,
	"customer_id" uuid,
	"action" text NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "weekly_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"owner_id" uuid NOT NULL,
	"business_week_id" uuid NOT NULL,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "daily_expenses" ADD CONSTRAINT "daily_expenses_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "management_comments" ADD CONSTRAINT "management_comments_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "management_comments" ADD CONSTRAINT "management_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_plan_items" ADD CONSTRAINT "weekly_plan_items_plan_id_weekly_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."weekly_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_plan_items" ADD CONSTRAINT "weekly_plan_items_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_plans" ADD CONSTRAINT "weekly_plans_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_plans" ADD CONSTRAINT "weekly_plans_business_week_id_business_weeks_id_fk" FOREIGN KEY ("business_week_id") REFERENCES "public"."business_weeks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "business_weeks_start_uq" ON "business_weeks" USING btree ("week_start");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_expenses_owner_date_uq" ON "daily_expenses" USING btree ("owner_id","expense_date");--> statement-breakpoint
CREATE INDEX "daily_expenses_owner_date_idx" ON "daily_expenses" USING btree ("owner_id","expense_date");--> statement-breakpoint
CREATE INDEX "comments_owner_unread_idx" ON "management_comments" USING btree ("owner_id","read_at");--> statement-breakpoint
CREATE INDEX "plan_items_plan_idx" ON "weekly_plan_items" USING btree ("plan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "weekly_plans_owner_week_uq" ON "weekly_plans" USING btree ("owner_id","business_week_id");--> statement-breakpoint
CREATE INDEX "weekly_plans_owner_idx" ON "weekly_plans" USING btree ("owner_id");
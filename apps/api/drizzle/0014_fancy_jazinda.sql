CREATE TABLE "sales_plan_reschedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sales_plan_id" uuid NOT NULL,
	"from_planned_at" timestamp with time zone NOT NULL,
	"to_planned_at" timestamp with time zone NOT NULL,
	"reason" text NOT NULL,
	"changed_by_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_plan_reschedules_changed_check" CHECK ("sales_plan_reschedules"."from_planned_at" <> "sales_plan_reschedules"."to_planned_at"),
	CONSTRAINT "sales_plan_reschedules_reason_check" CHECK (length(trim("sales_plan_reschedules"."reason")) > 0)
);
--> statement-breakpoint
ALTER TABLE "sales_plan_reschedules" ADD CONSTRAINT "sales_plan_reschedules_sales_plan_id_follow_up_actions_id_fk" FOREIGN KEY ("sales_plan_id") REFERENCES "public"."follow_up_actions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_plan_reschedules" ADD CONSTRAINT "sales_plan_reschedules_changed_by_id_users_id_fk" FOREIGN KEY ("changed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sales_plan_reschedules_plan_occurred_idx" ON "sales_plan_reschedules" USING btree ("sales_plan_id","occurred_at");
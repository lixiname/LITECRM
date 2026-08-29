ALTER TABLE "sales_plan_reschedules" DROP CONSTRAINT "sales_plan_reschedules_changed_check";--> statement-breakpoint
ALTER TABLE "sales_plan_reschedules" ADD COLUMN "from_content" text;--> statement-breakpoint
ALTER TABLE "sales_plan_reschedules" ADD COLUMN "to_content" text;--> statement-breakpoint
ALTER TABLE "sales_plan_reschedules" ADD CONSTRAINT "sales_plan_reschedules_changed_check" CHECK ("sales_plan_reschedules"."from_planned_at" <> "sales_plan_reschedules"."to_planned_at" or "sales_plan_reschedules"."from_content" is distinct from "sales_plan_reschedules"."to_content");
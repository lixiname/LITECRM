ALTER TABLE "complaint_follow_ups" ALTER COLUMN "occurred_at" SET DATA TYPE date;--> statement-breakpoint
ALTER TABLE "complaints" ALTER COLUMN "occurred_at" SET DATA TYPE date;--> statement-breakpoint
ALTER TABLE "complaints" ALTER COLUMN "resolved_at" SET DATA TYPE date;--> statement-breakpoint
ALTER TABLE "customers" ALTER COLUMN "first_visited_at" SET DATA TYPE date;--> statement-breakpoint
ALTER TABLE "customers" ALTER COLUMN "first_deal_at" SET DATA TYPE date;--> statement-breakpoint
ALTER TABLE "customers" ALTER COLUMN "last_activity_at" SET DATA TYPE date;--> statement-breakpoint
ALTER TABLE "deals" ALTER COLUMN "occurred_at" SET DATA TYPE date;--> statement-breakpoint
ALTER TABLE "follow_up_actions" ALTER COLUMN "planned_at" SET DATA TYPE date;--> statement-breakpoint
ALTER TABLE "opportunities" ALTER COLUMN "last_follow_up_at" SET DATA TYPE date;--> statement-breakpoint
ALTER TABLE "opportunities" ALTER COLUMN "closed_at" SET DATA TYPE date;--> statement-breakpoint
ALTER TABLE "opportunity_events" ALTER COLUMN "occurred_at" SET DATA TYPE date;--> statement-breakpoint
ALTER TABLE "opportunity_follow_ups" ALTER COLUMN "occurred_at" SET DATA TYPE date;--> statement-breakpoint
ALTER TABLE "opportunity_quotes" ALTER COLUMN "quoted_at" SET DATA TYPE date;--> statement-breakpoint
ALTER TABLE "sales_plan_reschedules" ALTER COLUMN "from_planned_at" SET DATA TYPE date;--> statement-breakpoint
ALTER TABLE "sales_plan_reschedules" ALTER COLUMN "to_planned_at" SET DATA TYPE date;--> statement-breakpoint
ALTER TABLE "visit_records" ALTER COLUMN "occurred_at" SET DATA TYPE date;
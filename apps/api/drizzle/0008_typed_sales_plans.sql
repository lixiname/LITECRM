ALTER TABLE "follow_up_actions" ADD COLUMN "plan_kind" text;--> statement-breakpoint
UPDATE "follow_up_actions"
SET "plan_kind" = CASE
  WHEN "complaint_id" IS NOT NULL THEN 'complaint_follow_up'
  WHEN "opportunity_id" IS NOT NULL THEN 'opportunity_follow_up'
  ELSE 'customer_visit'
END;--> statement-breakpoint
DELETE FROM "follow_up_actions" WHERE "customer_id" IS NULL;--> statement-breakpoint
ALTER TABLE "follow_up_actions" ALTER COLUMN "plan_kind" SET NOT NULL;--> statement-breakpoint

ALTER TABLE "visit_records" ADD COLUMN "source_plan_id" uuid;--> statement-breakpoint
ALTER TABLE "opportunity_follow_ups" ADD COLUMN "source_plan_id" uuid;--> statement-breakpoint
ALTER TABLE "opportunity_quotes" ADD COLUMN "source_plan_id" uuid;--> statement-breakpoint
ALTER TABLE "complaint_follow_ups" ADD COLUMN "source_plan_id" uuid;--> statement-breakpoint

ALTER TABLE "opportunity_follow_ups" DROP CONSTRAINT IF EXISTS "opportunity_follow_ups_source_visit_id_visit_records_id_fk";--> statement-breakpoint
DROP INDEX IF EXISTS "opportunity_follow_ups_source_visit_idx";--> statement-breakpoint
ALTER TABLE "opportunity_follow_ups" DROP COLUMN IF EXISTS "source_visit_id";--> statement-breakpoint

ALTER TABLE "follow_up_actions" DROP CONSTRAINT IF EXISTS "follow_up_actions_target_check";--> statement-breakpoint
ALTER TABLE "follow_up_actions" DROP CONSTRAINT IF EXISTS "follow_up_actions_complaint_target_check";--> statement-breakpoint
ALTER TABLE "follow_up_actions" ADD CONSTRAINT "follow_up_actions_plan_kind_check"
  CHECK ("plan_kind" in ('customer_visit','opportunity_follow_up','complaint_follow_up'));--> statement-breakpoint
ALTER TABLE "follow_up_actions" ADD CONSTRAINT "follow_up_actions_target_check" CHECK (
  "customer_id" is not null and (
    ("plan_kind" = 'customer_visit' and "opportunity_id" is null and "complaint_id" is null)
    or ("plan_kind" = 'opportunity_follow_up' and "opportunity_id" is not null and "complaint_id" is null)
    or ("plan_kind" = 'complaint_follow_up' and "complaint_id" is not null and "opportunity_id" is null)
  )
);--> statement-breakpoint

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY opportunity_id ORDER BY planned_at, created_at, id) AS rn
  FROM follow_up_actions WHERE status = 'pending' AND opportunity_id IS NOT NULL
)
UPDATE follow_up_actions SET status = 'cancelled', cancel_reason = '模型迁移：合并重复商机计划', updated_at = now(), version = version + 1
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);--> statement-breakpoint
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY complaint_id ORDER BY planned_at, created_at, id) AS rn
  FROM follow_up_actions WHERE status = 'pending' AND complaint_id IS NOT NULL
)
UPDATE follow_up_actions SET status = 'cancelled', cancel_reason = '模型迁移：合并重复客诉计划', updated_at = now(), version = version + 1
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);--> statement-breakpoint
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY customer_id ORDER BY planned_at, created_at, id) AS rn
  FROM follow_up_actions WHERE status = 'pending' AND plan_kind = 'customer_visit'
)
UPDATE follow_up_actions SET status = 'cancelled', cancel_reason = '模型迁移：合并重复拜访计划', updated_at = now(), version = version + 1
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);--> statement-breakpoint

CREATE UNIQUE INDEX "follow_up_actions_pending_opportunity_uq" ON "follow_up_actions" ("opportunity_id") WHERE "status" = 'pending' and "opportunity_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "follow_up_actions_pending_complaint_uq" ON "follow_up_actions" ("complaint_id") WHERE "status" = 'pending' and "complaint_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "follow_up_actions_pending_visit_uq" ON "follow_up_actions" ("customer_id") WHERE "status" = 'pending' and "plan_kind" = 'customer_visit';--> statement-breakpoint
CREATE UNIQUE INDEX "visits_source_plan_uq" ON "visit_records" ("source_plan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "opportunity_follow_ups_source_plan_uq" ON "opportunity_follow_ups" ("source_plan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "opportunity_quotes_source_plan_uq" ON "opportunity_quotes" ("source_plan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "complaint_follow_ups_source_plan_uq" ON "complaint_follow_ups" ("source_plan_id");

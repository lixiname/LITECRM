CREATE TABLE "follow_up_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"owner_id" uuid NOT NULL,
	"customer_id" uuid,
	"opportunity_id" uuid,
	"complaint_id" uuid,
	"source_type" text NOT NULL,
	"source_id" uuid,
	"planned_at" timestamp with time zone NOT NULL,
	"content" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"completed_at" timestamp with time zone,
	"cancel_reason" text,
	CONSTRAINT "follow_up_actions_source_type_check" CHECK ("follow_up_actions"."source_type" in ('manual','visit','opportunity','opportunity_follow_up','opportunity_quote','complaint','complaint_follow_up')),
	CONSTRAINT "follow_up_actions_status_check" CHECK ("follow_up_actions"."status" in ('pending','completed','cancelled')),
	CONSTRAINT "follow_up_actions_lifecycle_check" CHECK (("follow_up_actions"."status" = 'pending' and "follow_up_actions"."completed_at" is null and "follow_up_actions"."cancel_reason" is null)
        or ("follow_up_actions"."status" = 'completed' and "follow_up_actions"."completed_at" is not null and "follow_up_actions"."cancel_reason" is null)
        or ("follow_up_actions"."status" = 'cancelled' and "follow_up_actions"."completed_at" is null and length(trim("follow_up_actions"."cancel_reason")) > 0)),
	CONSTRAINT "follow_up_actions_target_check" CHECK ("follow_up_actions"."opportunity_id" is null or "follow_up_actions"."customer_id" is not null),
	CONSTRAINT "follow_up_actions_complaint_target_check" CHECK ("follow_up_actions"."complaint_id" is null or "follow_up_actions"."customer_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "opportunity_follow_ups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"source_visit_id" uuid,
	"occurred_at" timestamp with time zone NOT NULL,
	"conclusion" text NOT NULL,
	"method" text,
	"entry_source" text,
	"entry_ref_id" uuid
);
--> statement-breakpoint
CREATE TABLE "opportunity_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"quoted_at" timestamp with time zone NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"quote_no" text,
	"status" text DEFAULT 'active' NOT NULL,
	"supersedes_quote_id" uuid,
	"note" text,
	"document_ref" text,
	CONSTRAINT "opportunity_quotes_kind_check" CHECK ("opportunity_quotes"."kind" in ('oral','formal')),
	CONSTRAINT "opportunity_quotes_status_check" CHECK ("opportunity_quotes"."status" in ('active','superseded','withdrawn')),
	CONSTRAINT "opportunity_quotes_amount_check" CHECK ("opportunity_quotes"."amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "opportunities" RENAME COLUMN "amount" TO "estimated_amount";--> statement-breakpoint
ALTER TABLE "opportunities" RENAME COLUMN "amount_note" TO "estimate_note";--> statement-breakpoint
ALTER TABLE "weekly_plans" RENAME COLUMN "notes" TO "summary";--> statement-breakpoint
ALTER TABLE "management_comments" DROP CONSTRAINT "comments_target_type_check";--> statement-breakpoint
ALTER TABLE "opportunities" DROP CONSTRAINT "opportunities_amount_type_check";--> statement-breakpoint
ALTER TABLE "opportunities" DROP CONSTRAINT "opportunities_stage_check";--> statement-breakpoint
DROP INDEX "complaints_status_followup_idx";--> statement-breakpoint
DROP INDEX "opportunities_followup_idx";--> statement-breakpoint
DROP INDEX "follow_ups_complaint_idx";--> statement-breakpoint
INSERT INTO "follow_up_actions" (
	"id", "created_at", "updated_at", "version", "owner_id", "customer_id",
	"source_type", "planned_at", "content", "status"
)
SELECT
	wpi."id", wpi."created_at", wpi."updated_at", wpi."version", wp."owner_id", wpi."customer_id",
	'manual', (wpi."planned_date"::timestamp + time '09:00') AT TIME ZONE 'Asia/Hong_Kong',
	CASE
		WHEN nullif(trim(wpi."notes"), '') IS NULL THEN wpi."action"
		ELSE wpi."action" || E'\n' || wpi."notes"
	END,
	'pending'
FROM "weekly_plan_items" wpi
JOIN "weekly_plans" wp ON wp."id" = wpi."plan_id";--> statement-breakpoint
UPDATE "management_comments"
SET "target_type" = 'follow_up_action'
WHERE "target_type" = 'weekly_plan_item';--> statement-breakpoint
INSERT INTO "follow_up_actions" (
	"owner_id", "customer_id", "source_type", "source_id", "planned_at", "content", "status"
)
SELECT
	v."owner_id", v."customer_id", 'visit', v."id",
	(v."next_follow_up_date"::timestamp + time '09:00') AT TIME ZONE 'Asia/Hong_Kong',
	coalesce(nullif(trim(v."next_follow_up_action"), ''), '跟进客户'),
	'pending'
FROM "visit_records" v
JOIN "customers" c ON c."id" = v."customer_id"
WHERE v."next_follow_up_date" IS NOT NULL
AND NOT EXISTS (
	SELECT 1
	FROM "weekly_plan_items" wpi
	JOIN "weekly_plans" wp ON wp."id" = wpi."plan_id"
	WHERE wp."owner_id" = v."owner_id"
		AND wpi."customer_id" = v."customer_id"
		AND wpi."planned_date" = v."next_follow_up_date"
		AND wpi."action" = '拜访客户 ' || c."name"
);--> statement-breakpoint
INSERT INTO "follow_up_actions" (
	"owner_id", "customer_id", "opportunity_id", "source_type", "source_id",
	"planned_at", "content", "status", "cancel_reason"
)
SELECT
	o."owner_id", o."customer_id", o."id", 'opportunity', o."id",
	(o."next_follow_up_date"::timestamp + time '09:00') AT TIME ZONE 'Asia/Hong_Kong',
	coalesce(nullif(trim(o."next_action"), ''), '跟进商机'),
	CASE WHEN o."stage" IN ('ordered', 'lost', 'demand_disappeared') THEN 'cancelled' ELSE 'pending' END,
	CASE WHEN o."stage" IN ('ordered', 'lost', 'demand_disappeared') THEN '历史商机已结案' ELSE NULL END
FROM "opportunities" o
WHERE o."next_follow_up_date" IS NOT NULL;--> statement-breakpoint
WITH ranked_follow_ups AS (
	SELECT
		cf.*,
		row_number() OVER (
			PARTITION BY cf."complaint_id"
			ORDER BY cf."occurred_at" DESC, cf."created_at" DESC, cf."id" DESC
		) AS sequence_no
	FROM "complaint_follow_ups" cf
	WHERE cf."next_follow_up_date" IS NOT NULL
)
INSERT INTO "follow_up_actions" (
	"created_at", "updated_at", "version", "owner_id", "customer_id", "complaint_id",
	"source_type", "source_id", "planned_at", "content", "status", "completed_at"
)
SELECT
	rf."created_at", rf."updated_at", rf."version", rf."owner_id", c."customer_id", c."id",
	'complaint_follow_up', rf."id",
	(rf."next_follow_up_date"::timestamp + time '09:00') AT TIME ZONE 'Asia/Hong_Kong',
	coalesce(nullif(trim(rf."content"), ''), '跟进客诉'),
	CASE
		WHEN c."status" = 'registered'
			AND rf."sequence_no" = 1
			AND rf."next_follow_up_date" = c."next_follow_up_date" THEN 'pending'
		ELSE 'completed'
	END,
	CASE
		WHEN c."status" = 'registered'
			AND rf."sequence_no" = 1
			AND rf."next_follow_up_date" = c."next_follow_up_date" THEN NULL
		ELSE coalesce(c."resolved_at", rf."occurred_at")
	END
FROM ranked_follow_ups rf
JOIN "complaints" c ON c."id" = rf."complaint_id";--> statement-breakpoint
INSERT INTO "follow_up_actions" (
	"owner_id", "customer_id", "complaint_id", "source_type", "source_id",
	"planned_at", "content", "status", "cancel_reason"
)
SELECT
	c."owner_id", c."customer_id", c."id", 'complaint', c."id",
	(c."next_follow_up_date"::timestamp + time '09:00') AT TIME ZONE 'Asia/Hong_Kong',
	'跟进客诉',
	CASE WHEN c."status" = 'resolved' THEN 'cancelled' ELSE 'pending' END,
	CASE WHEN c."status" = 'resolved' THEN '历史客诉已解决' ELSE NULL END
FROM "complaints" c
WHERE c."next_follow_up_date" IS NOT NULL
AND NOT EXISTS (
	SELECT 1
	FROM "complaint_follow_ups" cf
	WHERE cf."complaint_id" = c."id"
		AND cf."next_follow_up_date" = c."next_follow_up_date"
);--> statement-breakpoint
ALTER TABLE "weekly_plan_items" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "weekly_plan_items" CASCADE;--> statement-breakpoint
DO $$
DECLARE
	historical_deal RECORD;
	new_opportunity_id uuid;
BEGIN
	FOR historical_deal IN
		SELECT d.*
		FROM "deals" d
		WHERE d."source_opportunity_id" IS NULL
			OR EXISTS (
				SELECT 1
				FROM "deals" earlier
				WHERE earlier."source_opportunity_id" = d."source_opportunity_id"
					AND earlier."id" < d."id"
			)
	LOOP
		INSERT INTO "opportunities" (
			"customer_id", "owner_id", "name", "stage", "source", "product_line",
			"amount_type", "estimated_amount", "approximate", "discovered_date",
			"last_follow_up_at", "closed_at", "close_reason", "notes", "entry_source", "entry_ref_id"
		)
		VALUES (
			historical_deal."customer_id", historical_deal."owner_id",
			concat('历史成交迁移', CASE WHEN nullif(trim(historical_deal."note"), '') IS NULL THEN '' ELSE '：' || historical_deal."note" END),
			'ordered', 'history_migration', historical_deal."product_line",
			'quoted', historical_deal."amount", false, historical_deal."occurred_at"::date,
			historical_deal."occurred_at", historical_deal."occurred_at", '由历史成交记录迁移',
			historical_deal."note", historical_deal."entry_source", historical_deal."entry_ref_id"
		)
		RETURNING "id" INTO new_opportunity_id;

		UPDATE "deals"
		SET "source_opportunity_id" = new_opportunity_id
		WHERE "id" = historical_deal."id";
	END LOOP;
END $$;--> statement-breakpoint
UPDATE "deals"
SET
	"amount" = 0,
	"note" = concat_ws(E'\n', nullif("note", ''), '历史迁移：原成交金额为空')
WHERE "amount" IS NULL;--> statement-breakpoint
UPDATE "opportunities" SET "stage" = 'won' WHERE "stage" = 'ordered';--> statement-breakpoint
ALTER TABLE "deals" ALTER COLUMN "amount" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "deals" ALTER COLUMN "source_opportunity_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "source_quote_id" uuid;--> statement-breakpoint
ALTER TABLE "opportunity_events" ADD COLUMN "schema_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "follow_up_actions" ADD CONSTRAINT "follow_up_actions_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_actions" ADD CONSTRAINT "follow_up_actions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_actions" ADD CONSTRAINT "follow_up_actions_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_actions" ADD CONSTRAINT "follow_up_actions_complaint_id_complaints_id_fk" FOREIGN KEY ("complaint_id") REFERENCES "public"."complaints"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_follow_ups" ADD CONSTRAINT "opportunity_follow_ups_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_follow_ups" ADD CONSTRAINT "opportunity_follow_ups_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_follow_ups" ADD CONSTRAINT "opportunity_follow_ups_source_visit_id_visit_records_id_fk" FOREIGN KEY ("source_visit_id") REFERENCES "public"."visit_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_quotes" ADD CONSTRAINT "opportunity_quotes_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_quotes" ADD CONSTRAINT "opportunity_quotes_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_quotes" ADD CONSTRAINT "opportunity_quotes_supersedes_quote_id_opportunity_quotes_id_fk" FOREIGN KEY ("supersedes_quote_id") REFERENCES "public"."opportunity_quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "follow_up_actions_source_uq" ON "follow_up_actions" USING btree ("source_type","source_id") WHERE "follow_up_actions"."source_id" is not null;--> statement-breakpoint
CREATE INDEX "follow_up_actions_owner_status_planned_idx" ON "follow_up_actions" USING btree ("owner_id","status","planned_at");--> statement-breakpoint
CREATE INDEX "follow_up_actions_opportunity_status_idx" ON "follow_up_actions" USING btree ("opportunity_id","status");--> statement-breakpoint
CREATE INDEX "follow_up_actions_complaint_status_idx" ON "follow_up_actions" USING btree ("complaint_id","status");--> statement-breakpoint
CREATE INDEX "follow_up_actions_customer_status_idx" ON "follow_up_actions" USING btree ("customer_id","status");--> statement-breakpoint
CREATE INDEX "opportunity_follow_ups_opp_occurred_idx" ON "opportunity_follow_ups" USING btree ("opportunity_id","occurred_at");--> statement-breakpoint
CREATE INDEX "opportunity_follow_ups_source_visit_idx" ON "opportunity_follow_ups" USING btree ("source_visit_id");--> statement-breakpoint
CREATE INDEX "opportunity_quotes_opp_quoted_idx" ON "opportunity_quotes" USING btree ("opportunity_id","quoted_at");--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_source_quote_id_opportunity_quotes_id_fk" FOREIGN KEY ("source_quote_id") REFERENCES "public"."opportunity_quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "complaints_status_idx" ON "complaints" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "deals_source_opportunity_uq" ON "deals" USING btree ("source_opportunity_id");--> statement-breakpoint
CREATE INDEX "follow_ups_complaint_idx" ON "complaint_follow_ups" USING btree ("complaint_id","occurred_at");--> statement-breakpoint
ALTER TABLE "complaint_follow_ups" DROP COLUMN "updated_at";--> statement-breakpoint
ALTER TABLE "complaint_follow_ups" DROP COLUMN "version";--> statement-breakpoint
ALTER TABLE "complaint_follow_ups" DROP COLUMN "next_follow_up_date";--> statement-breakpoint
ALTER TABLE "complaints" DROP COLUMN "next_follow_up_date";--> statement-breakpoint
ALTER TABLE "opportunities" DROP COLUMN "amount_type";--> statement-breakpoint
ALTER TABLE "opportunities" DROP COLUMN "next_action";--> statement-breakpoint
ALTER TABLE "opportunities" DROP COLUMN "next_follow_up_date";--> statement-breakpoint
ALTER TABLE "opportunity_events" DROP COLUMN "updated_at";--> statement-breakpoint
ALTER TABLE "opportunity_events" DROP COLUMN "version";--> statement-breakpoint
ALTER TABLE "visit_records" DROP COLUMN "updated_at";--> statement-breakpoint
ALTER TABLE "visit_records" DROP COLUMN "version";--> statement-breakpoint
ALTER TABLE "visit_records" DROP COLUMN "next_follow_up_date";--> statement-breakpoint
ALTER TABLE "visit_records" DROP COLUMN "next_follow_up_action";--> statement-breakpoint
ALTER TABLE "management_comments" ADD CONSTRAINT "comments_target_type_check" CHECK ("management_comments"."target_type" in ('weekly_plan','follow_up_action','visit'));--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_stage_check" CHECK ("opportunities"."stage" in ('intent','following','won','lost','demand_disappeared'));

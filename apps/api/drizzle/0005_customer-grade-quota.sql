CREATE TABLE "customer_grade_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"from_grade" text NOT NULL,
	"to_grade" text NOT NULL,
	"changed_by_id" uuid NOT NULL,
	"reason" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_grade_changes_from_check" CHECK ("customer_grade_changes"."from_grade" in ('S','A','B','C')),
	CONSTRAINT "customer_grade_changes_to_check" CHECK ("customer_grade_changes"."to_grade" in ('S','A','B','C')),
	CONSTRAINT "customer_grade_changes_changed_check" CHECK ("customer_grade_changes"."from_grade" <> "customer_grade_changes"."to_grade")
);
--> statement-breakpoint
ALTER TABLE "capacity_config" RENAME TO "customer_grade_quota_defaults";--> statement-breakpoint
ALTER TABLE "user_capacity_overrides" RENAME TO "user_customer_grade_quota_overrides";--> statement-breakpoint
ALTER TABLE "customer_grade_quota_defaults" RENAME COLUMN "level" TO "customer_grade";--> statement-breakpoint
ALTER TABLE "customers" RENAME COLUMN "level" TO "grade";--> statement-breakpoint
ALTER TABLE "user_customer_grade_quota_overrides" RENAME COLUMN "level" TO "customer_grade";--> statement-breakpoint
ALTER TABLE "customer_grade_quota_defaults" DROP CONSTRAINT "capacity_config_level_check";--> statement-breakpoint
ALTER TABLE "customers" DROP CONSTRAINT "customers_level_check";--> statement-breakpoint
ALTER TABLE "user_customer_grade_quota_overrides" DROP CONSTRAINT "user_capacity_overrides_level_check";--> statement-breakpoint
ALTER TABLE "user_customer_grade_quota_overrides" DROP CONSTRAINT "user_capacity_overrides_user_id_users_id_fk";
--> statement-breakpoint
DROP INDEX "customers_normalized_key_uq";--> statement-breakpoint
ALTER TABLE "customer_grade_changes" ADD CONSTRAINT "customer_grade_changes_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_grade_changes" ADD CONSTRAINT "customer_grade_changes_changed_by_id_users_id_fk" FOREIGN KEY ("changed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_grade_changes_customer_occurred_idx" ON "customer_grade_changes" USING btree ("customer_id","occurred_at");--> statement-breakpoint
ALTER TABLE "user_customer_grade_quota_overrides" ADD CONSTRAINT "user_customer_grade_quota_overrides_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customers_normalized_key_idx" ON "customers" USING btree ("normalized_key");--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "user_customer_grade_quota_overrides"
		GROUP BY "user_id", "customer_grade"
		HAVING count(*) > 1
	) THEN
		RAISE EXCEPTION '存在同一负责人、同一客户等级的重复名额覆盖记录，请合并后重试迁移';
	END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX "user_customer_grade_quota_overrides_user_grade_uq" ON "user_customer_grade_quota_overrides" USING btree ("user_id","customer_grade");--> statement-breakpoint
ALTER TABLE "customer_grade_quota_defaults" ADD CONSTRAINT "customer_grade_quota_defaults_grade_check" CHECK ("customer_grade_quota_defaults"."customer_grade" in ('S','A','B','C'));--> statement-breakpoint
ALTER TABLE "customer_grade_quota_defaults" ADD CONSTRAINT "customer_grade_quota_defaults_limit_check" CHECK ("customer_grade_quota_defaults"."default_limit" is null or "customer_grade_quota_defaults"."default_limit" >= 0);--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_grade_check" CHECK ("customers"."grade" in ('S','A','B','C'));--> statement-breakpoint
ALTER TABLE "user_customer_grade_quota_overrides" ADD CONSTRAINT "user_customer_grade_quota_overrides_grade_check" CHECK ("user_customer_grade_quota_overrides"."customer_grade" in ('S','A','B','C'));--> statement-breakpoint
ALTER TABLE "user_customer_grade_quota_overrides" ADD CONSTRAINT "user_customer_grade_quota_overrides_limit_check" CHECK ("user_customer_grade_quota_overrides"."limit" is null or "user_customer_grade_quota_overrides"."limit" >= 0);

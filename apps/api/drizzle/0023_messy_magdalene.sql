ALTER TABLE "deals" RENAME COLUMN "trade_type" TO "trade_types";--> statement-breakpoint
ALTER TABLE "deals" ALTER COLUMN "trade_types" TYPE jsonb USING (
  CASE
    WHEN "trade_types" IS NULL OR btrim("trade_types") = '' THEN '[]'::jsonb
    ELSE jsonb_build_array("trade_types")
  END
);--> statement-breakpoint
ALTER TABLE "deals" ALTER COLUMN "trade_types" SET DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "deals" ALTER COLUMN "trade_types" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "deals" DROP CONSTRAINT "deals_trade_type_check_hidden";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_role_check";--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_check" CHECK ("users"."role" in ('sales','executive','management','assistant','admin'));

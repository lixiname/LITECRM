ALTER TABLE "users" ADD COLUMN "sales_region_id" uuid;--> statement-breakpoint
UPDATE "users" AS u
SET "sales_region_id" = sr."id"
FROM "sales_regions" AS sr
WHERE u."region" IS NOT NULL
  AND (u."region" = sr."name" OR u."region" = sr."code");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_sales_region_id_sales_regions_id_fk" FOREIGN KEY ("sales_region_id") REFERENCES "public"."sales_regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "region";

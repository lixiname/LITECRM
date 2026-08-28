ALTER TABLE "customers" ADD CONSTRAINT "customers_lifecycle_check"
CHECK (
  ("customers"."status" = 'active' AND "customers"."owner_id" IS NOT NULL)
  OR ("customers"."status" IN ('public','invalid') AND "customers"."owner_id" IS NULL)
);

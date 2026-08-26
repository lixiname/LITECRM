ALTER TABLE "customer_dimension_options" ADD COLUMN "label" text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE "customer_dimension_options" SET "label" = "name" WHERE trim("label") = '';

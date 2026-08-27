CREATE TABLE "administrative_divisions" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"level" text NOT NULL,
	"parent_code" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "administrative_divisions_level_check" CHECK ("administrative_divisions"."level" in ('province','city'))
);
--> statement-breakpoint
CREATE TABLE "sales_region_areas" (
	"sales_region_id" uuid NOT NULL,
	"division_code" text NOT NULL,
	CONSTRAINT "sales_region_areas_sales_region_id_division_code_pk" PRIMARY KEY("sales_region_id","division_code")
);
--> statement-breakpoint
CREATE TABLE "sales_regions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "city_code" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "province_code" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "sales_region_id" uuid;--> statement-breakpoint
ALTER TABLE "administrative_divisions" ADD CONSTRAINT "administrative_divisions_parent_code_administrative_divisions_code_fk" FOREIGN KEY ("parent_code") REFERENCES "public"."administrative_divisions"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_region_areas" ADD CONSTRAINT "sales_region_areas_sales_region_id_sales_regions_id_fk" FOREIGN KEY ("sales_region_id") REFERENCES "public"."sales_regions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_region_areas" ADD CONSTRAINT "sales_region_areas_division_code_administrative_divisions_code_fk" FOREIGN KEY ("division_code") REFERENCES "public"."administrative_divisions"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "administrative_divisions_parent_idx" ON "administrative_divisions" USING btree ("parent_code","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_region_areas_division_uq" ON "sales_region_areas" USING btree ("division_code");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_regions_code_uq" ON "sales_regions" USING btree ("code");--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_city_code_administrative_divisions_code_fk" FOREIGN KEY ("city_code") REFERENCES "public"."administrative_divisions"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_province_code_administrative_divisions_code_fk" FOREIGN KEY ("province_code") REFERENCES "public"."administrative_divisions"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_sales_region_id_sales_regions_id_fk" FOREIGN KEY ("sales_region_id") REFERENCES "public"."sales_regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customers_city_code_idx" ON "customers" USING btree ("city_code");--> statement-breakpoint
CREATE INDEX "customers_sales_region_idx" ON "customers" USING btree ("sales_region_id");
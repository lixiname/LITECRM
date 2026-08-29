CREATE TABLE "customer_import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"file_name" text NOT NULL,
	"status" text DEFAULT 'uploaded' NOT NULL,
	"default_relationship" text NOT NULL,
	"data_cutoff_on" date,
	"default_owner_id" uuid,
	"target_status" text DEFAULT 'active' NOT NULL,
	"created_by_id" uuid NOT NULL,
	"total_rows" integer DEFAULT 0 NOT NULL,
	"ready_rows" integer DEFAULT 0 NOT NULL,
	"imported_rows" integer DEFAULT 0 NOT NULL,
	"skipped_rows" integer DEFAULT 0 NOT NULL,
	"failed_rows" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "customer_import_batches_status_check" CHECK ("customer_import_batches"."status" in ('uploaded','previewed','importing','completed','failed')),
	CONSTRAINT "customer_import_batches_relationship_check" CHECK ("customer_import_batches"."default_relationship" in ('pre_crm_existing','prospect','per_row')),
	CONSTRAINT "customer_import_batches_target_status_check" CHECK ("customer_import_batches"."target_status" in ('active','public'))
);
--> statement-breakpoint
CREATE TABLE "customer_import_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"row_number" integer NOT NULL,
	"raw_data" jsonb NOT NULL,
	"normalized_data" jsonb,
	"status" text DEFAULT 'uploaded' NOT NULL,
	"error" text,
	"duplicate_customer_id" uuid,
	"customer_id" uuid,
	CONSTRAINT "customer_import_rows_status_check" CHECK ("customer_import_rows"."status" in ('uploaded','ready','duplicate','invalid','imported','skipped','failed'))
);
--> statement-breakpoint
ALTER TABLE "customer_transfers" ADD COLUMN "event_type" text DEFAULT 'transferred' NOT NULL;--> statement-breakpoint
ALTER TABLE "customer_transfers" ADD COLUMN "from_status" text;--> statement-breakpoint
ALTER TABLE "customer_transfers" ADD COLUMN "to_status" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "pre_crm_deal_confirmed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "pre_crm_sales_amount" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "import_batch_id" uuid;--> statement-breakpoint
ALTER TABLE "customer_import_batches" ADD CONSTRAINT "customer_import_batches_default_owner_id_users_id_fk" FOREIGN KEY ("default_owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_import_batches" ADD CONSTRAINT "customer_import_batches_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_import_rows" ADD CONSTRAINT "customer_import_rows_batch_id_customer_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."customer_import_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_import_rows" ADD CONSTRAINT "customer_import_rows_duplicate_customer_id_customers_id_fk" FOREIGN KEY ("duplicate_customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_import_rows" ADD CONSTRAINT "customer_import_rows_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "customer_import_rows_batch_row_uq" ON "customer_import_rows" USING btree ("batch_id","row_number");--> statement-breakpoint
CREATE INDEX "customer_import_rows_batch_status_idx" ON "customer_import_rows" USING btree ("batch_id","status");--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_import_batch_id_customer_import_batches_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."customer_import_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_transfers" ADD CONSTRAINT "customer_transfers_event_type_check" CHECK ("customer_transfers"."event_type" in ('transferred','released_to_pool','claimed_from_pool','marked_invalid','restored_from_invalid','claim_approved'));--> statement-breakpoint
ALTER TABLE "customer_transfers" ADD CONSTRAINT "customer_transfers_from_status_check" CHECK ("customer_transfers"."from_status" is null or "customer_transfers"."from_status" in ('active','public','invalid'));--> statement-breakpoint
ALTER TABLE "customer_transfers" ADD CONSTRAINT "customer_transfers_to_status_check" CHECK ("customer_transfers"."to_status" is null or "customer_transfers"."to_status" in ('active','public','invalid'));
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"customer_id" uuid NOT NULL,
	"name" text,
	"title" text,
	"phone" text,
	"is_key_contact" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_claim_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"customer_id" uuid NOT NULL,
	"applicant_id" uuid NOT NULL,
	"current_owner_id" uuid,
	"reason" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by_id" uuid,
	"review_comment" text,
	"reviewed_at" timestamp with time zone,
	CONSTRAINT "claims_status_check" CHECK ("customer_claim_requests"."status" in ('pending','approved','rejected','withdrawn'))
);
--> statement-breakpoint
CREATE TABLE "customer_dimension_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"dimension" text NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "dimension_check" CHECK ("customer_dimension_options"."dimension" in ('industry','sub_industry','customer_type','product_line','source'))
);
--> statement-breakpoint
CREATE TABLE "customer_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"customer_id" uuid NOT NULL,
	"from_owner_id" uuid,
	"to_owner_id" uuid,
	"operated_by_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"name" text NOT NULL,
	"normalized_key" text NOT NULL,
	"customer_code" text,
	"unified_social_credit_code" text,
	"alias_names" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"industry" text,
	"sub_industry" text,
	"customer_type" text,
	"product_lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"city" text,
	"province" text,
	"address" text,
	"website" text,
	"parent_customer_id" uuid,
	"source" text,
	"level" text DEFAULT 'C' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"owner_id" uuid,
	"created_by_id" uuid NOT NULL,
	"first_visited_at" timestamp with time zone,
	"first_deal_at" timestamp with time zone,
	"last_activity_at" timestamp with time zone,
	"notes" text,
	"entry_source" text,
	"entry_ref_id" uuid,
	CONSTRAINT "customers_level_check" CHECK ("customers"."level" in ('S','A','B','C')),
	CONSTRAINT "customers_status_check" CHECK ("customers"."status" in ('active','invalid','public'))
);
--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_claim_requests" ADD CONSTRAINT "customer_claim_requests_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_claim_requests" ADD CONSTRAINT "customer_claim_requests_applicant_id_users_id_fk" FOREIGN KEY ("applicant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_claim_requests" ADD CONSTRAINT "customer_claim_requests_current_owner_id_users_id_fk" FOREIGN KEY ("current_owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_claim_requests" ADD CONSTRAINT "customer_claim_requests_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_transfers" ADD CONSTRAINT "customer_transfers_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_transfers" ADD CONSTRAINT "customer_transfers_from_owner_id_users_id_fk" FOREIGN KEY ("from_owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_transfers" ADD CONSTRAINT "customer_transfers_to_owner_id_users_id_fk" FOREIGN KEY ("to_owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_transfers" ADD CONSTRAINT "customer_transfers_operated_by_id_users_id_fk" FOREIGN KEY ("operated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_parent_customer_id_customers_id_fk" FOREIGN KEY ("parent_customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_key_contact_uq" ON "contacts" USING btree ("customer_id","is_key_contact") WHERE "contacts"."is_key_contact";--> statement-breakpoint
CREATE UNIQUE INDEX "claims_pending_uq" ON "customer_claim_requests" USING btree ("customer_id") WHERE "customer_claim_requests"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "dimension_name_uq" ON "customer_dimension_options" USING btree ("dimension","name");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_normalized_key_uq" ON "customers" USING btree ("normalized_key");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_code_uq" ON "customers" USING btree ("customer_code");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_credit_code_uq" ON "customers" USING btree ("unified_social_credit_code");--> statement-breakpoint
CREATE INDEX "customers_name_trgm_idx" ON "customers" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "customers_key_trgm_idx" ON "customers" USING gin ("normalized_key" gin_trgm_ops);
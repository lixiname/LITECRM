CREATE TABLE "visit_entry_rules" (
	"id" text PRIMARY KEY DEFAULT 'company' NOT NULL,
	"business_situation_min_length" integer DEFAULT 0 NOT NULL,
	"next_action_content_min_length" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "visit_entry_rules_singleton_check" CHECK ("visit_entry_rules"."id" = 'company'),
	CONSTRAINT "visit_entry_rules_business_min_check" CHECK ("visit_entry_rules"."business_situation_min_length" between 0 and 1000),
	CONSTRAINT "visit_entry_rules_next_min_check" CHECK ("visit_entry_rules"."next_action_content_min_length" between 0 and 1000)
);

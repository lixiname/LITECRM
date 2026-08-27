CREATE TABLE "opportunity_product_lines" (
	"opportunity_id" uuid NOT NULL,
	"product_line" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "initial_amount_basis" text DEFAULT 'estimate' NOT NULL;--> statement-breakpoint
ALTER TABLE "opportunity_product_lines" ADD CONSTRAINT "opportunity_product_lines_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "opportunity_product_lines_opp_product_uq" ON "opportunity_product_lines" USING btree ("opportunity_id","product_line");--> statement-breakpoint
CREATE INDEX "opportunity_product_lines_product_idx" ON "opportunity_product_lines" USING btree ("product_line");--> statement-breakpoint
ALTER TABLE "opportunities" DROP COLUMN "product_line";--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_initial_amount_basis_check" CHECK ("opportunities"."initial_amount_basis" in ('estimate','oral_quote','formal_quote'));
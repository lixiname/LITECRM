ALTER TABLE "complaints" DROP CONSTRAINT "complaints_type_check";--> statement-breakpoint
ALTER TABLE "customer_dimension_options" DROP CONSTRAINT "dimension_check";--> statement-breakpoint
ALTER TABLE "deals" DROP CONSTRAINT "deals_trade_type_check";--> statement-breakpoint
ALTER TABLE "opportunities" DROP CONSTRAINT "opportunities_source_check";--> statement-breakpoint
ALTER TABLE "visit_records" DROP CONSTRAINT "visits_type_check";--> statement-breakpoint
ALTER TABLE "customer_dimension_options" ADD CONSTRAINT "dimension_check" CHECK ("customer_dimension_options"."dimension" in ('industry','sub_industry','customer_type','product_line','source','complaint_type','trade_type','opportunity_source','visit_type'));--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_trade_type_check_hidden" CHECK (true);
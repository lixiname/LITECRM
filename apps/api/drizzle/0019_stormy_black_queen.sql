ALTER TABLE "audit_logs" ALTER COLUMN "entity_id" SET DATA TYPE text USING "entity_id"::text;

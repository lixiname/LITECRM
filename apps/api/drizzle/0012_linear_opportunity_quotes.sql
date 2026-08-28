WITH ordered_quotes AS (
  SELECT
    id,
    lag(id) OVER (
      PARTITION BY opportunity_id
      ORDER BY created_at ASC, id ASC
    ) AS previous_quote_id,
    row_number() OVER (
      PARTITION BY opportunity_id
      ORDER BY created_at DESC, id DESC
    ) AS newest_rank
  FROM opportunity_quotes
  WHERE status <> 'withdrawn'
), normalized_quotes AS (
  SELECT
    id,
    previous_quote_id,
    CASE WHEN newest_rank = 1 THEN 'active' ELSE 'superseded' END AS normalized_status
  FROM ordered_quotes
)
UPDATE opportunity_quotes AS quote
SET
  status = normalized.normalized_status,
  supersedes_quote_id = normalized.previous_quote_id,
  updated_at = now(),
  version = quote.version + 1
FROM normalized_quotes AS normalized
WHERE quote.id = normalized.id
  AND (
    quote.status IS DISTINCT FROM normalized.normalized_status
    OR quote.supersedes_quote_id IS DISTINCT FROM normalized.previous_quote_id
  );
--> statement-breakpoint
CREATE UNIQUE INDEX "opportunity_quotes_one_active_uq"
  ON "opportunity_quotes" USING btree ("opportunity_id")
  WHERE "opportunity_quotes"."status" = 'active';

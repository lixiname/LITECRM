ALTER TABLE "users" ADD COLUMN "job_title" text;--> statement-breakpoint
UPDATE "users"
SET "job_title" = CASE "role"
  WHEN 'sales' THEN '销售工程师'
  WHEN 'executive' THEN '区域销售经理'
  WHEN 'assistant' THEN '销售内勤'
  WHEN 'admin' THEN '系统管理员'
  ELSE NULL
END
WHERE "job_title" IS NULL;

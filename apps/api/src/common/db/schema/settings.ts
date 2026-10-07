import { sql } from 'drizzle-orm'
import { check, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

// 公司级拜访填报规则。无记录时等同于两个下限均为 0（不附加字数限制）。
export const visitEntryRules = pgTable(
  'visit_entry_rules',
  {
    id: text('id').primaryKey().default('company'),
    businessSituationMinLength: integer('business_situation_min_length').default(0).notNull(),
    nextActionContentMinLength: integer('next_action_content_min_length').default(0).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check('visit_entry_rules_singleton_check', sql`${table.id} = 'company'`),
    check(
      'visit_entry_rules_business_min_check',
      sql`${table.businessSituationMinLength} between 0 and 1000`,
    ),
    check(
      'visit_entry_rules_next_min_check',
      sql`${table.nextActionContentMinLength} between 0 and 1000`,
    ),
  ],
)

import { BadRequestException, Injectable } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { db } from '../common/db/db'
import { auditLogs, visitEntryRules } from '../common/db/schema'
import type { UpdateVisitEntryRulesDto, VisitEntryRulesDto } from './dto/visit-entry-rules.dto'

const COMPANY_RULE_ID = 'company'
const DEFAULT_RULES: VisitEntryRulesDto = {
  businessSituationMinLength: 0,
  nextActionContentMinLength: 0,
}

@Injectable()
export class VisitEntryRulesService {
  async get(): Promise<VisitEntryRulesDto> {
    const [row] = await db
      .select({
        businessSituationMinLength: visitEntryRules.businessSituationMinLength,
        nextActionContentMinLength: visitEntryRules.nextActionContentMinLength,
      })
      .from(visitEntryRules)
      .where(eq(visitEntryRules.id, COMPANY_RULE_ID))
      .limit(1)
    return row ?? { ...DEFAULT_RULES }
  }

  async update(dto: UpdateVisitEntryRulesDto, actorId: string): Promise<VisitEntryRulesDto> {
    await db.transaction(async (tx) => {
      const [previous] = await tx
        .select({
          businessSituationMinLength: visitEntryRules.businessSituationMinLength,
          nextActionContentMinLength: visitEntryRules.nextActionContentMinLength,
        })
        .from(visitEntryRules)
        .where(eq(visitEntryRules.id, COMPANY_RULE_ID))
        .limit(1)
      await tx
        .insert(visitEntryRules)
        .values({ id: COMPANY_RULE_ID, ...dto })
        .onConflictDoUpdate({
          target: visitEntryRules.id,
          set: { ...dto, updatedAt: new Date() },
        })
      await tx.insert(auditLogs).values({
        actorId,
        action: 'visit_entry_rules.updated',
        entityType: 'visit_entry_rules',
        entityId: COMPANY_RULE_ID,
        before: previous ?? DEFAULT_RULES,
        after: dto,
      })
    })
    return this.get()
  }

  async assertSubmission(businessSituation: string | undefined, nextActionContent: string) {
    const rules = await this.get()
    assertVisitEntryText(rules, businessSituation, nextActionContent)
  }
}

// 按去除首尾空白后的 Unicode 字符数计数；只校验新提交，不回写历史事实。
export function assertVisitEntryText(
  rules: VisitEntryRulesDto,
  businessSituation: string | undefined,
  nextActionContent: string,
): void {
  const actualLength = Array.from(businessSituation?.trim() ?? '').length
  if (actualLength < rules.businessSituationMinLength) {
    throw new BadRequestException(
      `本次情况至少填写 ${rules.businessSituationMinLength} 字（当前 ${actualLength} 字）`,
    )
  }
  const nextLength = Array.from(nextActionContent.trim()).length
  if (nextLength === 0) throw new BadRequestException('请填写下次拜访内容')
  if (nextLength < rules.nextActionContentMinLength) {
    throw new BadRequestException(
      `下次拜访内容至少填写 ${rules.nextActionContentMinLength} 字（当前 ${nextLength} 字）`,
    )
  }
}

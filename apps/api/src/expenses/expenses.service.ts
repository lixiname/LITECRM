import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from '../common/db/db'
import { dailyExpenses } from '../common/db/schema'
import type { AuthUser } from '../auth/auth.service'
import type { CreateExpenseDto } from './dto/create-expense.dto'

/**
 * 每日费用（§8.8：轻量统计，非报销）：每人每天一条 upsert；三态 draft/submitted/voided。
 * 作废=剔除统计但留痕（不改金额，状态置 voided）。
 */
@Injectable()
export class ExpensesService {
  // 保存（§8.8：upsert 每人每天一条；已提交/作废不可改）
  async upsert(dto: CreateExpenseDto, actor: AuthUser) {
    const [existing] = await db
      .select()
      .from(dailyExpenses)
      .where(
        and(eq(dailyExpenses.ownerId, actor.id), eq(dailyExpenses.expenseDate, dto.expenseDate)),
      )
      .limit(1)
    const values = {
      tobaccoAlcohol: String(dto.tobaccoAlcohol ?? 0),
      gifts: String(dto.gifts ?? 0),
      dining: String(dto.dining ?? 0),
      entertainment: String(dto.entertainment ?? 0),
      lodging: String(dto.lodging ?? 0),
      notes: dto.notes ?? null,
    }
    if (existing) {
      if (existing.status !== 'draft') throw new ConflictException('已提交/作废的费用不可修改')
      const [updated] = await db
        .update(dailyExpenses)
        .set(values)
        .where(eq(dailyExpenses.id, existing.id))
        .returning()
      return updated
    }
    const [created] = await db
      .insert(dailyExpenses)
      .values({ ownerId: actor.id, expenseDate: dto.expenseDate, ...values })
      .returning()
    return created
  }

  // 提交（§8.8：draft → submitted，计入统计）
  async submit(id: string, actor: AuthUser) {
    const exp = await this.getOwned(id, actor)
    if (exp.status !== 'draft') throw new ConflictException('仅草稿可提交')
    const [updated] = await db
      .update(dailyExpenses)
      .set({ status: 'submitted', submittedAt: new Date() })
      .where(eq(dailyExpenses.id, id))
      .returning()
    return updated
  }

  // 作废（§8.8：剔除统计，留痕）
  async void(id: string, actor: AuthUser) {
    const exp = await this.getOwned(id, actor)
    if (exp.status === 'voided') throw new ConflictException('费用已作废')
    const [updated] = await db
      .update(dailyExpenses)
      .set({ status: 'voided' })
      .where(eq(dailyExpenses.id, id))
      .returning()
    return updated
  }

  // 我的费用（可按月筛选 YYYY-MM）
  async list(actor: AuthUser, month?: string) {
    const conditions = [eq(dailyExpenses.ownerId, actor.id)]
    if (month) conditions.push(sql`to_char(${dailyExpenses.expenseDate}, 'YYYY-MM') = ${month}`)
    return db
      .select()
      .from(dailyExpenses)
      .where(and(...conditions))
      .orderBy(desc(dailyExpenses.expenseDate))
  }

  private async getOwned(id: string, actor: AuthUser) {
    const [exp] = await db
      .select()
      .from(dailyExpenses)
      .where(and(eq(dailyExpenses.id, id), eq(dailyExpenses.ownerId, actor.id)))
      .limit(1)
    if (!exp) throw new NotFoundException('费用不存在')
    return exp
  }
}

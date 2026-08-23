import { Injectable, NotFoundException } from '@nestjs/common'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { db } from '../common/db/db'
import { customers, visitRecords } from '../common/db/schema'
import { AccessService } from '../access/access.service'
import type { AuthUser } from '../auth/auth.service'
import type { CreateVisitDto } from './dto/create-visit.dto'

// 拜访登记（§8.4）：客户可维护权限 + 归属快照；nextFollowUpDate 联动周计划项（M4 接入）
@Injectable()
export class VisitsService {
  constructor(private readonly accessService: AccessService) {}

  async create(dto: CreateVisitDto, actor: AuthUser) {
    const customer = await this.findCustomer(dto.customerId, actor)
    await this.accessService.assertCanContributeCustomer(customer.ownerId, actor)

    const [visit] = await db
      .insert(visitRecords)
      .values({
        customerId: dto.customerId,
        ownerId: actor.id, // 创建时归属快照（填报人）
        occurredAt: dto.occurredAt,
        method: dto.method,
        visitType: dto.visitType ?? null,
        businessSituation: dto.businessSituation ?? null,
        equipmentSituation: dto.equipmentSituation ?? null,
        personnelChanges: dto.personnelChanges ?? null,
        nextFollowUpDate: dto.nextFollowUpDate ?? null,
        nextFollowUpAction: dto.nextFollowUpAction ?? null,
      })
      .returning()
    // TODO(M4)：nextFollowUpDate → 强一致生成周计划项（§8.4 联动）
    return visit
  }

  // 客户拜访时间线（数据范围可见 + 归属快照）
  async listByCustomer(customerId: string, actor: AuthUser) {
    const visibleIds = await this.accessService.getVisibleUserIds(actor)
    const [customer] = await db
      .select({ id: customers.id, ownerId: customers.ownerId })
      .from(customers)
      .where(and(eq(customers.id, customerId), inArray(customers.ownerId, visibleIds)))
      .limit(1)
    if (!customer) throw new NotFoundException('客户不存在')
    return db
      .select()
      .from(visitRecords)
      .where(eq(visitRecords.customerId, customerId))
      .orderBy(desc(visitRecords.occurredAt))
  }

  private async findCustomer(id: string, actor: AuthUser) {
    const visibleIds = await this.accessService.getVisibleUserIds(actor)
    const [customer] = await db
      .select({ id: customers.id, ownerId: customers.ownerId })
      .from(customers)
      .where(and(eq(customers.id, id), inArray(customers.ownerId, visibleIds)))
      .limit(1)
    if (!customer) throw new NotFoundException('客户不存在')
    return customer
  }
}

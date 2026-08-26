import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { db } from '../common/db/db'
import { customers, visitRecords } from '../common/db/schema'
import { AccessService } from '../access/access.service'
import { FollowUpActionsService } from '../follow-up-actions/follow-up-actions.service'
import { CatalogService } from '../catalog/catalog.service'
import type { AuthUser } from '../auth/auth.service'
import type { CreateVisitDto } from './dto/create-visit.dto'
import { touchCustomerActivity } from '../customers/customer-activity-projection'

// 拜访保存已发生事实；可选下一行动写入 follow_up_actions，不复制进拜访或周计划项。
@Injectable()
export class VisitsService {
  constructor(
    private readonly accessService: AccessService,
    private readonly actionsService: FollowUpActionsService,
    private readonly catalogService: CatalogService,
  ) {}

  async create(dto: CreateVisitDto, actor: AuthUser) {
    if (dto.visitType) await this.catalogService.assertDimensionValue('visit_type', dto.visitType)
    if (!!dto.nextActionAt !== !!dto.nextActionContent?.trim()) {
      throw new BadRequestException('下一行动时间和内容必须同时填写')
    }
    const customer = await this.findCustomer(dto.customerId, actor)
    await this.accessService.assertCanContributeCustomer(customer.ownerId, actor)

    return db.transaction(async (tx) => {
      const occurredAt = new Date(dto.occurredAt)
      const [visit] = await tx
        .insert(visitRecords)
        .values({
          customerId: dto.customerId,
          ownerId: actor.id, // 创建时归属快照（填报人）
          occurredAt,
          method: dto.method,
          visitType: dto.visitType ?? null,
          businessSituation: dto.businessSituation ?? null,
          equipmentSituation: dto.equipmentSituation ?? null,
          personnelChanges: dto.personnelChanges ?? null,
        })
        .returning()

      if (dto.nextActionAt && dto.nextActionContent) {
        await this.actionsService.createLinked(tx, {
          ownerId: customer.ownerId ?? actor.id,
          customerId: dto.customerId,
          sourceType: 'visit',
          sourceId: visit.id,
          plannedAt: new Date(dto.nextActionAt),
          content: dto.nextActionContent,
        })
      }
      await touchCustomerActivity(tx, dto.customerId, occurredAt, 'visit')
      return visit
    })
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
      .select({ id: customers.id, name: customers.name, ownerId: customers.ownerId })
      .from(customers)
      .where(and(eq(customers.id, id), inArray(customers.ownerId, visibleIds)))
      .limit(1)
    if (!customer) throw new NotFoundException('客户不存在')
    return customer
  }
}

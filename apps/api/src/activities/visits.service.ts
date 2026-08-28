import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { db } from '../common/db/db'
import { customers, visitRecords } from '../common/db/schema'
import { AccessService } from '../access/access.service'
import { SalesPlansService } from '../follow-up-actions/follow-up-actions.service'
import { CatalogService } from '../catalog/catalog.service'
import type { AuthUser } from '../auth/auth.service'
import type { CreateVisitDto } from './dto/create-visit.dto'
import { touchCustomerActivity } from '../customers/customer-activity-projection'

// 拜访保存已发生事实；来源计划与下一次拜访计划在同一事务闭环，不复制进拜访事实。
@Injectable()
export class VisitsService {
  constructor(
    private readonly accessService: AccessService,
    private readonly actionsService: SalesPlansService,
    private readonly catalogService: CatalogService,
  ) {}

  async create(dto: CreateVisitDto, actor: AuthUser) {
    if (dto.visitType) await this.catalogService.assertDimensionValue('visit_type', dto.visitType)
    if (dto.sourcePlanId && dto.keepExistingPlan)
      throw new BadRequestException('执行来源计划时不能同时保留该计划')
    if (!dto.keepExistingPlan && (!dto.nextActionAt || !dto.nextActionContent?.trim()))
      throw new BadRequestException('请安排下次拜访，或明确保留当前计划')
    const customer = await this.findCustomer(dto.customerId, actor)
    if (customer.status !== 'active') throw new ConflictException('仅在案客户可登记拜访')
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
          sourcePlanId: dto.sourcePlanId ?? null,
        })
        .returning()

      await this.actionsService.fulfillLinked(tx, dto.sourcePlanId, {
        planKind: 'customer_visit',
        customerId: dto.customerId,
      })
      if (dto.keepExistingPlan) {
        await this.actionsService.assertPendingExists(tx, {
          planKind: 'customer_visit',
          customerId: dto.customerId,
        })
      } else {
        await this.actionsService.createLinked(tx, {
          ownerId: customer.ownerId ?? actor.id,
          customerId: dto.customerId,
          planKind: 'customer_visit',
          originType: 'visit',
          sourceId: visit.id,
          plannedAt: new Date(dto.nextActionAt!),
          content: dto.nextActionContent!,
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

  private async findCustomer(id: string, _actor: AuthUser) {
    const [customer] = await db
      .select({
        id: customers.id,
        name: customers.name,
        ownerId: customers.ownerId,
        status: customers.status,
      })
      .from(customers)
      .where(eq(customers.id, id))
      .limit(1)
    if (!customer) throw new NotFoundException('客户不存在')
    return customer
  }
}

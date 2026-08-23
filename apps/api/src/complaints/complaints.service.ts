import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { and, desc, eq, getTableColumns, inArray } from 'drizzle-orm'
import { db } from '../common/db/db'
import { complaintFollowUps, complaints, customers } from '../common/db/schema'
import { AccessService } from '../access/access.service'
import { CatalogService } from '../catalog/catalog.service'
import type { AuthUser } from '../auth/auth.service'
import type { CreateComplaintDto } from './dto/create-complaint.dto'
import type { FollowUpComplaintDto } from './dto/follow-up-complaint.dto'

/**
 * 客诉闭环（§8.6 两态）：registered → resolved（终态禁止跟进）。
 * 跟进事件只追加；outcome=resolved 时主记录迁移终态。
 * 客户当前归属 JOIN 推导可见性；风险告警 M5 接入。
 */
@Injectable()
export class ComplaintsService {
  constructor(
    private readonly accessService: AccessService,
    private readonly catalogService: CatalogService,
  ) {}

  // 登记（§8.6）：status=registered + 触发客户风险告警（M5）
  async create(dto: CreateComplaintDto, actor: AuthUser) {
    await this.catalogService.assertDimensionValue('complaint_type', dto.type)
    const customer = await this.findCustomer(dto.customerId, actor)
    await this.accessService.assertCanContributeCustomer(customer.ownerId, actor)

    const [complaint] = await db
      .insert(complaints)
      .values({
        customerId: dto.customerId,
        ownerId: actor.id, // 创建时归属快照
        occurredAt: dto.occurredAt,
        type: dto.type,
        description: dto.description,
        nextFollowUpDate: dto.nextFollowUpDate,
      })
      .returning()
    // TODO(M5)：触发客户风险告警（event-emitter 弱一致，失败不阻塞）
    return complaint
  }

  // 跟进 / 确认解决（§8.6）
  async followUp(id: string, dto: FollowUpComplaintDto, actor: AuthUser) {
    const complaint = await this.getEditable(id, actor)
    if (complaint.status === 'resolved') throw new ConflictException('客诉已解决，禁止跟进')

    // 分支校验（§8.6 图外规则）
    if (dto.outcome === 'followed_up' && !dto.nextFollowUpDate) {
      throw new BadRequestException('跟进后需填写下次确认日期')
    }
    if (dto.outcome === 'resolved' && !dto.resolution?.trim()) {
      throw new BadRequestException('确认解决需填写解决结果')
    }

    return db.transaction(async (tx) => {
      await tx.insert(complaintFollowUps).values({
        complaintId: id,
        ownerId: actor.id,
        occurredAt: new Date(),
        content: dto.content,
        nextFollowUpDate: dto.nextFollowUpDate ?? null,
        outcome: dto.outcome,
        resolution: dto.resolution ?? null,
      })
      if (dto.outcome === 'resolved') {
        await tx
          .update(complaints)
          .set({ status: 'resolved', resolution: dto.resolution, resolvedAt: new Date() })
          .where(eq(complaints.id, id))
      } else {
        await tx
          .update(complaints)
          .set({ nextFollowUpDate: dto.nextFollowUpDate })
          .where(eq(complaints.id, id))
      }
      const [updated] = await tx.select().from(complaints).where(eq(complaints.id, id)).limit(1)
      return updated
    })
  }

  // 列表（按客户，可见性 JOIN 客户当前归属）
  async list(actor: AuthUser, customerId?: string) {
    const visibleIds = await this.accessService.getVisibleUserIds(actor)
    const conditions = [inArray(customers.ownerId, visibleIds)]
    if (customerId) conditions.push(eq(complaints.customerId, customerId))
    return db
      .select({ ...getTableColumns(complaints) })
      .from(complaints)
      .innerJoin(customers, eq(complaints.customerId, customers.id))
      .where(and(...conditions))
      .orderBy(desc(complaints.occurredAt))
  }

  // 详情（含跟进事件）
  async findOne(id: string, actor: AuthUser) {
    const complaint = await this.getEditable(id, actor)
    const followUps = await db
      .select()
      .from(complaintFollowUps)
      .where(eq(complaintFollowUps.complaintId, id))
      .orderBy(desc(complaintFollowUps.occurredAt))
    return { ...complaint, followUps }
  }

  // ===== 内部工具 =====

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

  private async getEditable(id: string, actor: AuthUser) {
    const visibleIds = await this.accessService.getVisibleUserIds(actor)
    const [complaint] = await db
      .select({ ...getTableColumns(complaints), currentOwnerId: customers.ownerId })
      .from(complaints)
      .innerJoin(customers, eq(complaints.customerId, customers.id))
      .where(and(eq(complaints.id, id), inArray(customers.ownerId, visibleIds)))
      .limit(1)
    if (!complaint) throw new NotFoundException('客诉不存在')
    await this.accessService.assertCanContributeCustomer(complaint.currentOwnerId, actor)
    return complaint
  }
}

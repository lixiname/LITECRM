import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { and, asc, desc, eq, getTableColumns, inArray, sql } from 'drizzle-orm'
import { AccessService } from '../access/access.service'
import type { AuthUser } from '../auth/auth.service'
import { CatalogService } from '../catalog/catalog.service'
import { db } from '../common/db/db'
import { complaintFollowUps, complaints, customers, followUpActions } from '../common/db/schema'
import { SalesPlansService } from '../follow-up-actions/follow-up-actions.service'
import type { CreateComplaintDto } from './dto/create-complaint.dto'
import type { FollowUpComplaintDto } from './dto/follow-up-complaint.dto'
import { touchCustomerActivity } from '../customers/customer-activity-projection'

@Injectable()
export class ComplaintsService {
  constructor(
    private readonly accessService: AccessService,
    private readonly catalogService: CatalogService,
    private readonly actionsService: SalesPlansService,
  ) {}

  async create(dto: CreateComplaintDto, actor: AuthUser) {
    await this.catalogService.assertDimensionValue('complaint_type', dto.type)
    const customer = await this.findCustomer(dto.customerId, actor)
    await this.accessService.assertCanContributeCustomer(customer.ownerId, actor)

    return db.transaction(async (tx) => {
      const occurredAt = new Date(dto.occurredAt)
      const [complaint] = await tx
        .insert(complaints)
        .values({
          customerId: dto.customerId,
          ownerId: actor.id,
          occurredAt,
          type: dto.type,
          description: dto.description,
        })
        .returning()
      await this.actionsService.createLinked(tx, {
        ownerId: customer.ownerId ?? actor.id,
        customerId: dto.customerId,
        complaintId: complaint.id,
        planKind: 'complaint_follow_up',
        originType: 'complaint',
        sourceId: complaint.id,
        plannedAt: new Date(dto.firstActionAt),
        content: dto.firstActionContent,
      })
      await touchCustomerActivity(tx, dto.customerId, occurredAt)
      return complaint
    })
  }

  async followUp(id: string, dto: FollowUpComplaintDto, actor: AuthUser) {
    const complaint = await this.getEditable(id, actor)
    if (complaint.status === 'resolved') throw new ConflictException('客诉已解决，禁止跟进')
    if (dto.outcome === 'followed_up' && (!dto.nextActionAt || !dto.nextActionContent?.trim())) {
      throw new BadRequestException('继续跟进必须填写下一处理行动和时间')
    }
    if (dto.outcome === 'resolved' && !dto.resolution?.trim()) {
      throw new BadRequestException('确认解决需填写解决结果')
    }

    return db.transaction(async (tx) => {
      const occurredAt = new Date()
      const [followUp] = await tx
        .insert(complaintFollowUps)
        .values({
          complaintId: id,
          ownerId: actor.id,
          occurredAt,
          content: dto.content,
          outcome: dto.outcome,
          resolution: dto.resolution?.trim() || null,
          sourcePlanId: dto.sourcePlanId ?? null,
        })
        .returning()
      await this.actionsService.fulfillLinked(tx, dto.sourcePlanId, {
        planKind: 'complaint_follow_up',
        customerId: complaint.customerId,
        complaintId: id,
      })

      const values =
        dto.outcome === 'resolved'
          ? {
              status: 'resolved',
              resolution: dto.resolution!.trim(),
              resolvedAt: occurredAt,
              updatedAt: new Date(),
              version: sql`${complaints.version} + 1`,
            }
          : {
              updatedAt: new Date(),
              version: sql`${complaints.version} + 1`,
            }
      const [updated] = await tx
        .update(complaints)
        .set(values)
        .where(and(eq(complaints.id, id), eq(complaints.version, dto.version)))
        .returning()
      if (!updated) throw new ConflictException('客诉已被更新，请刷新后重试')

      if (dto.outcome === 'resolved') {
        await this.actionsService.cancelPendingForComplaint(tx, id, '客诉已解决')
      } else {
        await this.actionsService.createLinked(tx, {
          ownerId: complaint.currentOwnerId ?? actor.id,
          customerId: complaint.customerId,
          complaintId: id,
          planKind: 'complaint_follow_up',
          originType: 'complaint_follow_up',
          sourceId: followUp.id,
          plannedAt: new Date(dto.nextActionAt!),
          content: dto.nextActionContent!,
        })
      }
      await touchCustomerActivity(tx, complaint.customerId, occurredAt)
      return updated
    })
  }

  async list(actor: AuthUser, customerId?: string) {
    const visibleIds = await this.accessService.getVisibleUserIds(actor)
    const conditions = [inArray(customers.ownerId, visibleIds)]
    if (customerId) conditions.push(eq(complaints.customerId, customerId))
    const rows = await db
      .select({ ...getTableColumns(complaints) })
      .from(complaints)
      .innerJoin(customers, eq(complaints.customerId, customers.id))
      .where(and(...conditions))
      .orderBy(desc(complaints.occurredAt))
    if (rows.length === 0) return []
    const actions = await db
      .select()
      .from(followUpActions)
      .where(
        and(
          inArray(
            followUpActions.complaintId,
            rows.map((row) => row.id),
          ),
          eq(followUpActions.status, 'pending'),
        ),
      )
      .orderBy(asc(followUpActions.plannedAt))
    return rows.map((row) => ({
      ...row,
      currentAction: actions.find((action) => action.complaintId === row.id) ?? null,
    }))
  }

  async findOne(id: string, actor: AuthUser) {
    const complaint = await this.getEditable(id, actor)
    const [followUps, actions] = await Promise.all([
      db
        .select()
        .from(complaintFollowUps)
        .where(eq(complaintFollowUps.complaintId, id))
        .orderBy(desc(complaintFollowUps.occurredAt)),
      this.actionsService.listPendingForComplaint(id),
    ])
    return { ...complaint, followUps, actions }
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

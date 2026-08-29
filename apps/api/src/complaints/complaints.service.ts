import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { and, asc, desc, eq, getTableColumns, inArray, sql, type SQL } from 'drizzle-orm'
import { AccessService } from '../access/access.service'
import type { AuthUser } from '../auth/auth.service'
import { CatalogService } from '../catalog/catalog.service'
import { db } from '../common/db/db'
import {
  complaintFollowUps,
  complaints,
  customers,
  followUpActions,
  users,
} from '../common/db/schema'
import { SalesPlansService } from '../follow-up-actions/follow-up-actions.service'
import type { CreateComplaintDto } from './dto/create-complaint.dto'
import type { FollowUpComplaintDto } from './dto/follow-up-complaint.dto'
import { touchCustomerActivity } from '../customers/customer-activity-projection'
import type { ComplaintQueryDto } from './dto/complaint-query.dto'
import { businessDate, todayBusinessDate } from '../common/business-date'

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
    if (customer.status !== 'active') throw new ConflictException('仅在案客户可登记客诉')
    await this.accessService.assertCanContributeCustomer(customer.ownerId, actor)

    return db.transaction(async (tx) => {
      const occurredAt = businessDate(dto.occurredAt)
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
        plannedAt: businessDate(dto.firstActionAt),
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
      const occurredAt = todayBusinessDate()
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
        await this.actionsService.fulfillLinked(tx, dto.sourcePlanId, {
          planKind: 'complaint_follow_up',
          customerId: complaint.customerId,
          complaintId: id,
        })
        await this.actionsService.cancelPendingForComplaint(tx, id, '客诉已解决')
      } else {
        await this.actionsService.continueWithNext(
          tx,
          dto.sourcePlanId,
          {
            planKind: 'complaint_follow_up',
            customerId: complaint.customerId,
            complaintId: id,
          },
          {
            ownerId: complaint.currentOwnerId ?? actor.id,
            changedById: actor.id,
            customerId: complaint.customerId,
            complaintId: id,
            planKind: 'complaint_follow_up',
            originType: 'complaint_follow_up',
            sourceId: followUp.id,
            plannedAt: businessDate(dto.nextActionAt!),
            content: dto.nextActionContent!,
          },
        )
      }
      await touchCustomerActivity(tx, complaint.customerId, occurredAt)
      return updated
    })
  }

  async list(query: ComplaintQueryDto, actor: AuthUser) {
    const visibleIds = await this.accessService.getVisibleUserIds(actor)
    const conditions: SQL[] = [inArray(customers.ownerId, visibleIds)]
    if (query.customerId) conditions.push(eq(complaints.customerId, query.customerId))
    if (query.status) conditions.push(eq(complaints.status, query.status))
    const keyword = query.keyword?.trim()
    if (keyword) {
      conditions.push(
        sql`(${complaints.description} ILIKE ${`%${keyword}%`} OR ${customers.name} ILIKE ${`%${keyword}%`})`,
      )
    }
    if (query.overdue !== undefined) {
      const isOverdue = sql`${complaints.status} = 'registered' AND ${followUpActions.plannedAt} < current_date`
      conditions.push(query.overdue ? isOverdue : sql`not (${isOverdue})`)
    }
    const pendingJoin = and(
      eq(followUpActions.complaintId, complaints.id),
      eq(followUpActions.status, 'pending'),
    )
    const where = and(...conditions)
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20
    const [totalRows, rows] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(complaints)
        .innerJoin(customers, eq(complaints.customerId, customers.id))
        .leftJoin(followUpActions, pendingJoin)
        .where(where),
      db
        .select({
          ...getTableColumns(complaints),
          customerName: customers.name,
          currentOwnerId: customers.ownerId,
        })
        .from(complaints)
        .innerJoin(customers, eq(complaints.customerId, customers.id))
        .leftJoin(followUpActions, pendingJoin)
        .where(where)
        .orderBy(
          asc(sql`case
            when ${complaints.status} = 'registered' and ${followUpActions.plannedAt} < current_date then 0
            when ${complaints.status} = 'registered' then 1
            else 2
          end`),
          asc(followUpActions.plannedAt),
          desc(complaints.occurredAt),
        )
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    ])
    if (rows.length === 0) return { items: [], total: totalRows[0]?.count ?? 0, page, pageSize }
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
    return {
      items: rows.map((row) => ({
        ...row,
        currentAction: actions.find((action) => action.complaintId === row.id) ?? null,
      })),
      total: totalRows[0]?.count ?? 0,
      page,
      pageSize,
    }
  }

  async findOne(id: string, actor: AuthUser) {
    const complaint = await this.getVisible(id, actor)
    const [followUps, actions] = await Promise.all([
      db
        .select()
        .from(complaintFollowUps)
        .where(eq(complaintFollowUps.complaintId, id))
        .orderBy(desc(complaintFollowUps.occurredAt)),
      this.actionsService.listPendingForComplaint(id),
    ])
    const actorIds = [...new Set([complaint.ownerId, ...followUps.map((item) => item.ownerId)])]
    const actorRows = await db
      .select({ id: users.id, displayName: users.displayName })
      .from(users)
      .where(inArray(users.id, actorIds))
    const actorName = (id: string) => actorRows.find((item) => item.id === id)?.displayName ?? null
    const timeline = [
      ...(complaint.status === 'resolved' && complaint.resolvedAt
        ? [
            {
              id: `${complaint.id}:resolved`,
              type: 'resolved' as const,
              timestamp: complaint.resolvedAt,
              title: '客诉已解决',
              content: complaint.resolution ?? '已确认解决',
              actorName: actorName(
                followUps.find((item) => item.outcome === 'resolved')?.ownerId ?? complaint.ownerId,
              ),
              status: 'resolved' as const,
            },
          ]
        : actions.slice(0, 1).map((action) => ({
            id: action.id,
            type: 'pending_action' as const,
            timestamp: action.plannedAt,
            title: action.plannedAt < todayBusinessDate() ? '待处理（已逾期）' : '下一处理行动',
            content: action.content,
            actorName: null,
            status:
              action.plannedAt < todayBusinessDate() ? ('overdue' as const) : ('pending' as const),
          }))),
      ...followUps.map((item) => ({
        id: item.id,
        type: 'follow_up' as const,
        timestamp: item.occurredAt,
        title: item.outcome === 'resolved' ? '完成最后处理' : '客诉处理',
        content: item.content,
        actorName: actorName(item.ownerId),
        status: 'completed' as const,
        outcome: item.outcome,
      })),
      {
        id: complaint.id,
        type: 'registered' as const,
        timestamp: complaint.occurredAt,
        title: '客诉登记',
        content: complaint.description,
        actorName: actorName(complaint.ownerId),
        status: 'completed' as const,
      },
    ]
    return { ...complaint, followUps, actions, timeline }
  }

  private async findCustomer(id: string, _actor: AuthUser) {
    const [customer] = await db
      .select({ id: customers.id, ownerId: customers.ownerId, status: customers.status })
      .from(customers)
      .where(eq(customers.id, id))
      .limit(1)
    if (!customer) throw new NotFoundException('客户不存在')
    return customer
  }

  private async getEditable(id: string, actor: AuthUser) {
    const complaint = await this.getVisible(id, actor)
    await this.accessService.assertCanContributeCustomer(complaint.currentOwnerId, actor)
    return complaint
  }

  private async getVisible(id: string, actor: AuthUser) {
    const visibleIds = await this.accessService.getVisibleUserIds(actor)
    const [complaint] = await db
      .select({
        ...getTableColumns(complaints),
        customerName: customers.name,
        currentOwnerId: customers.ownerId,
      })
      .from(complaints)
      .innerJoin(customers, eq(complaints.customerId, customers.id))
      .where(and(eq(complaints.id, id), inArray(customers.ownerId, visibleIds)))
      .limit(1)
    if (!complaint) throw new NotFoundException('客诉不存在')
    return complaint
  }
}

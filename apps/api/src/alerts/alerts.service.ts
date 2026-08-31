import { Injectable, NotFoundException } from '@nestjs/common'
import { and, desc, eq, inArray, isNotNull, isNull, lt, ne, sql } from 'drizzle-orm'
import { AccessService } from '../access/access.service'
import type { AuthUser } from '../auth/auth.service'
import { todayBusinessDate } from '../common/business-date'
import { db } from '../common/db/db'
import {
  alertReads,
  customerClaimRequests,
  customers,
  followUpActions,
  managementComments,
  users,
} from '../common/db/schema'

export type AlertType = 'overdue_action' | 'claim_review' | 'claim_result' | 'management_comment'

export interface AlertItem {
  key: string
  type: AlertType
  title: string
  summary: string
  occurredAt: string
  severity: 'info' | 'warning' | 'danger'
  targetId: string
  customerId?: string
  read: boolean
}

@Injectable()
export class AlertsService {
  constructor(private readonly accessService: AccessService) {}

  async list(actor: AuthUser): Promise<{ items: AlertItem[]; unreadCount: number }> {
    const [overdue, claimResults, comments, claimReviews] = await Promise.all([
      this.listOverdue(actor),
      this.listClaimResults(actor),
      this.listComments(actor),
      this.listClaimReviews(actor),
    ])
    const items = [...overdue, ...claimResults, ...comments, ...claimReviews]
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
      .slice(0, 60)
    const readKeys = items.length
      ? await this.readKeys(
          actor.id,
          items.map((item) => item.key),
        )
      : []
    const readSet = new Set(readKeys)
    const withRead = items.map((item) => ({ ...item, read: readSet.has(item.key) }))
    return { items: withRead, unreadCount: withRead.filter((item) => !item.read).length }
  }

  async markRead(key: string, actor: AuthUser) {
    const current = await this.list(actor)
    const alert = current.items.find((item) => item.key === key)
    if (!alert) throw new NotFoundException('提醒不存在或已失效')

    await db
      .insert(alertReads)
      .values({ userId: actor.id, alertKey: key })
      .onConflictDoUpdate({
        target: [alertReads.userId, alertReads.alertKey],
        set: { readAt: new Date(), updatedAt: new Date(), version: sql`${alertReads.version} + 1` },
      })

    if (alert.type === 'management_comment') {
      const commentId = key.slice('management-comment:'.length)
      await db
        .update(managementComments)
        .set({
          readAt: new Date(),
          updatedAt: new Date(),
          version: sql`${managementComments.version} + 1`,
        })
        .where(
          and(
            eq(managementComments.id, commentId),
            eq(managementComments.ownerId, actor.id),
            isNull(managementComments.readAt),
          ),
        )
    }
    return { key, read: true }
  }

  private async listOverdue(actor: AuthUser): Promise<Omit<AlertItem, 'read'>[]> {
    const rows = await db
      .select({ action: followUpActions, customerName: customers.name })
      .from(followUpActions)
      .leftJoin(customers, eq(followUpActions.customerId, customers.id))
      .where(
        and(
          eq(followUpActions.ownerId, actor.id),
          eq(followUpActions.status, 'pending'),
          lt(followUpActions.plannedAt, todayBusinessDate()),
        ),
      )
      .orderBy(followUpActions.plannedAt)
      .limit(30)
    return rows.map(({ action, customerName }) => ({
      key: `overdue-action:${action.id}`,
      type: 'overdue_action',
      title: `逾期计划 · ${customerName ?? '客户'}`,
      summary: `${action.plannedAt} · ${action.content}`,
      occurredAt: `${action.plannedAt}T00:00:00.000Z`,
      severity: 'danger',
      targetId: action.id,
      customerId: action.customerId ?? undefined,
    }))
  }

  private async listClaimResults(actor: AuthUser): Promise<Omit<AlertItem, 'read'>[]> {
    const rows = await db
      .select({ claim: customerClaimRequests, customerName: customers.name })
      .from(customerClaimRequests)
      .innerJoin(customers, eq(customerClaimRequests.customerId, customers.id))
      .where(
        and(
          eq(customerClaimRequests.applicantId, actor.id),
          ne(customerClaimRequests.status, 'pending'),
          isNotNull(customerClaimRequests.reviewedAt),
        ),
      )
      .orderBy(desc(customerClaimRequests.reviewedAt))
      .limit(20)
    return rows.map(({ claim, customerName }) => ({
      key: `claim-result:${claim.id}:${claim.status}`,
      type: 'claim_result',
      title: claim.status === 'approved' ? '接管申请已通过' : '接管申请状态更新',
      summary: `${customerName} · ${claim.reviewComment || claim.reason}`,
      occurredAt: claim.reviewedAt!.toISOString(),
      severity: claim.status === 'approved' ? 'info' : 'warning',
      targetId: claim.id,
      customerId: claim.customerId,
    }))
  }

  private async listComments(actor: AuthUser): Promise<Omit<AlertItem, 'read'>[]> {
    const rows = await db
      .select({
        comment: managementComments,
        authorName: users.displayName,
        customerId: followUpActions.customerId,
      })
      .from(managementComments)
      .innerJoin(users, eq(managementComments.authorId, users.id))
      .innerJoin(
        followUpActions,
        and(
          eq(managementComments.targetType, 'follow_up_action'),
          eq(managementComments.targetId, followUpActions.id),
        ),
      )
      .where(eq(managementComments.ownerId, actor.id))
      .orderBy(desc(managementComments.createdAt))
      .limit(20)
    return rows.map(({ comment, authorName, customerId }) => ({
      key: `management-comment:${comment.id}`,
      type: 'management_comment',
      title: `计划指导 · ${authorName}`,
      summary: comment.content,
      occurredAt: comment.createdAt.toISOString(),
      severity: 'info',
      targetId: comment.targetId,
      customerId: customerId ?? undefined,
    }))
  }

  private async listClaimReviews(actor: AuthUser): Promise<Omit<AlertItem, 'read'>[]> {
    if (!this.accessService.can(actor.role, 'approve.claim')) return []
    const visibleOwners = await this.accessService.getVisibleUserIds(actor)
    if (!visibleOwners.length) return []
    const rows = await db
      .select({
        claim: customerClaimRequests,
        customerName: customers.name,
        applicantName: users.displayName,
      })
      .from(customerClaimRequests)
      .innerJoin(customers, eq(customerClaimRequests.customerId, customers.id))
      .innerJoin(users, eq(customerClaimRequests.applicantId, users.id))
      .where(
        and(
          eq(customerClaimRequests.status, 'pending'),
          inArray(customerClaimRequests.currentOwnerId, visibleOwners),
          ne(customerClaimRequests.applicantId, actor.id),
        ),
      )
      .orderBy(desc(customerClaimRequests.createdAt))
      .limit(20)
    return rows.map(({ claim, customerName, applicantName }) => ({
      key: `claim-review:${claim.id}`,
      type: 'claim_review',
      title: '待审批接管申请',
      summary: `${applicantName}申请接管${customerName} · ${claim.reason}`,
      occurredAt: claim.createdAt.toISOString(),
      severity: 'warning',
      targetId: claim.id,
      customerId: claim.customerId,
    }))
  }

  private async readKeys(userId: string, keys: string[]): Promise<string[]> {
    const rows = await db
      .select({ key: alertReads.alertKey })
      .from(alertReads)
      .where(and(eq(alertReads.userId, userId), inArray(alertReads.alertKey, keys)))
    return rows.map((row) => row.key)
  }
}

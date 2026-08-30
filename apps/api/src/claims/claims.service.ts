import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from '../common/db/db'
import { customerClaimRequests, customerTransfers, customers, users } from '../common/db/schema'
import { AccessService } from '../access/access.service'
import { GradeQuotaService } from '../customers/grade-quota.service'
import { SalesPlansService } from '../follow-up-actions/follow-up-actions.service'
import type { AuthUser } from '../auth/auth.service'
import type { CreateClaimDto } from './dto/create-claim.dto'
import type { ReviewClaimDto } from './dto/review-claim.dto'

/**
 * 接管审批流（§8.3）：申请 → 单点审批（approved/rejected）/ 撤回。
 * 审批候选池 = 当前 owner + 管理链 + admin，排除申请人（防自我审批），owner 同意让出允许。
 * 并发防护：同客户仅一条 pending（部分唯一索引）+ 归属快照校验。
 */
@Injectable()
export class ClaimsService {
  constructor(
    private readonly accessService: AccessService,
    private readonly gradeQuotaService: GradeQuotaService,
    private readonly actionsService: SalesPlansService,
  ) {}

  // 发起接管申请（§8.3）
  async create(customerId: string, dto: CreateClaimDto, actor: AuthUser) {
    if (actor.role === 'admin' || actor.role === 'assistant') {
      throw new ForbiddenException('该角色不能发起接管')
    }
    const customer = await this.getCustomer(customerId)
    if (customer.status !== 'active') throw new ConflictException('仅 active 客户可申请接管')
    if (customer.ownerId === actor.id) throw new ConflictException('不能接管自己名下的客户')

    const [pending] = await db
      .select()
      .from(customerClaimRequests)
      .where(
        and(
          eq(customerClaimRequests.customerId, customerId),
          eq(customerClaimRequests.status, 'pending'),
        ),
      )
      .limit(1)
    if (pending) throw new ConflictException('该客户已有待审批的接管申请')

    const [created] = await db
      .insert(customerClaimRequests)
      .values({
        customerId,
        applicantId: actor.id,
        currentOwnerId: customer.ownerId,
        reason: dto.reason,
      })
      .returning()
    return created
  }

  // 审批通过：名额校验、客户归属、移交历史和审批终态在同一事务内完成。
  async approve(id: string, dto: ReviewClaimDto, actor: AuthUser) {
    const claim = await this.getPending(id)
    const customer = await this.getCustomer(claim.customerId)
    if (claim.currentOwnerId !== customer.ownerId) {
      throw new ConflictException('客户归属已变化，请重新申请')
    }
    await this.assertReviewer(claim, customer, actor)
    await db.transaction(async (tx) => {
      await this.gradeQuotaService.assertSlotAvailable(tx, claim.applicantId, customer.grade)
      const [updatedCustomer] = await tx
        .update(customers)
        .set({
          ownerId: claim.applicantId,
          updatedAt: new Date(),
          version: sql`${customers.version} + 1`,
        })
        .where(and(eq(customers.id, customer.id), eq(customers.version, customer.version)))
        .returning({ id: customers.id })
      if (!updatedCustomer) throw new ConflictException('客户归属已变化，请重新申请')

      await tx.insert(customerTransfers).values({
        customerId: customer.id,
        fromOwnerId: customer.ownerId,
        toOwnerId: claim.applicantId,
        operatedById: actor.id,
        reason: `接管审批通过：${claim.reason}`,
        eventType: 'claim_approved',
        fromStatus: customer.status,
        toStatus: 'active',
      })
      await this.actionsService.reassignPendingForCustomer(tx, customer.id, claim.applicantId)

      const [reviewed] = await tx
        .update(customerClaimRequests)
        .set({
          status: 'approved',
          reviewedById: actor.id,
          reviewComment: dto.comment ?? null,
          reviewedAt: new Date(),
          updatedAt: new Date(),
          version: sql`${customerClaimRequests.version} + 1`,
        })
        .where(
          and(
            eq(customerClaimRequests.id, id),
            eq(customerClaimRequests.status, 'pending'),
            eq(customerClaimRequests.version, claim.version),
          ),
        )
        .returning({ id: customerClaimRequests.id })
      if (!reviewed) throw new ConflictException('申请已被处理，请刷新后重试')
    })
    return { id: claim.id, status: 'approved' }
  }

  // 拒绝（§8.3：comment 必填）
  async reject(id: string, dto: ReviewClaimDto, actor: AuthUser) {
    const claim = await this.getPending(id)
    const customer = await this.getCustomer(claim.customerId)
    await this.assertReviewer(claim, customer, actor)
    if (!dto.comment?.trim()) throw new BadRequestException('拒绝必须填写意见')
    await this.markReviewed(id, 'rejected', actor, dto.comment, claim.version)
    return { id: claim.id, status: 'rejected' }
  }

  // 撤回（§8.3：仅申请人本人）
  async withdraw(id: string, actor: AuthUser) {
    const claim = await this.getPending(id)
    if (claim.applicantId !== actor.id && actor.role !== 'admin') {
      throw new ForbiddenException('仅申请人可撤回')
    }
    const [withdrawn] = await db
      .update(customerClaimRequests)
      .set({
        status: 'withdrawn',
        updatedAt: new Date(),
        version: sql`${customerClaimRequests.version} + 1`,
      })
      .where(
        and(
          eq(customerClaimRequests.id, id),
          eq(customerClaimRequests.status, 'pending'),
          eq(customerClaimRequests.version, claim.version),
        ),
      )
      .returning({ id: customerClaimRequests.id })
    if (!withdrawn) throw new ConflictException('申请已被处理，请刷新后重试')
    return { id: claim.id, status: 'withdrawn' }
  }

  // 待审批列表（§8.3 审批入口）：executive/admin 可见，附带客户名/申请人名；审批时仍校验候选池
  async listPending(actor: AuthUser) {
    if (actor.role !== 'executive' && actor.role !== 'admin') {
      throw new ForbiddenException('无权查看接管审批')
    }
    return db
      .select({
        id: customerClaimRequests.id,
        customerId: customerClaimRequests.customerId,
        customerName: customers.name,
        applicantId: customerClaimRequests.applicantId,
        applicantName: users.displayName,
        currentOwnerId: customerClaimRequests.currentOwnerId,
        reason: customerClaimRequests.reason,
        status: customerClaimRequests.status,
        createdAt: customerClaimRequests.createdAt,
      })
      .from(customerClaimRequests)
      .innerJoin(customers, eq(customerClaimRequests.customerId, customers.id))
      .innerJoin(users, eq(customerClaimRequests.applicantId, users.id))
      .where(eq(customerClaimRequests.status, 'pending'))
      .orderBy(desc(customerClaimRequests.createdAt))
  }

  // ===== 内部工具 =====

  private async getCustomer(customerId: string) {
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, customerId))
      .limit(1)
    if (!customer) throw new NotFoundException('客户不存在')
    return customer
  }

  private async getPending(id: string) {
    const [claim] = await db
      .select()
      .from(customerClaimRequests)
      .where(and(eq(customerClaimRequests.id, id), eq(customerClaimRequests.status, 'pending')))
      .limit(1)
    if (!claim) throw new NotFoundException('待审批申请不存在')
    return claim
  }

  // 审批候选池（§8.3）：当前 owner + 管理链 + admin；排除申请人（防自我审批）
  private async assertReviewer(
    claim: typeof customerClaimRequests.$inferSelect,
    customer: typeof customers.$inferSelect,
    actor: AuthUser,
  ) {
    if (actor.id === claim.applicantId) throw new ForbiddenException('禁止审批自己的申请')
    if (actor.role === 'admin') return
    if (actor.id === customer.ownerId) return // 被接管方确认让出，允许
    const isManager = await this.accessService.isManagerOf(actor.id, customer.ownerId)
    if (isManager) return
    throw new ForbiddenException('无权审批该接管申请')
  }

  private async markReviewed(
    id: string,
    status: 'approved' | 'rejected',
    actor: AuthUser,
    comment: string | null,
    version: number,
  ) {
    const [reviewed] = await db
      .update(customerClaimRequests)
      .set({
        status,
        reviewedById: actor.id,
        reviewComment: comment,
        reviewedAt: new Date(),
        updatedAt: new Date(),
        version: sql`${customerClaimRequests.version} + 1`,
      })
      .where(
        and(
          eq(customerClaimRequests.id, id),
          eq(customerClaimRequests.status, 'pending'),
          eq(customerClaimRequests.version, version),
        ),
      )
      .returning({ id: customerClaimRequests.id })
    if (!reviewed) throw new ConflictException('申请已被处理，请刷新后重试')
  }
}

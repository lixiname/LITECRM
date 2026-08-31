import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { and, eq, inArray, or, sql } from 'drizzle-orm'
import { db } from '../common/db/db'
import {
  complaints,
  customerTransfers,
  customers,
  opportunities,
  salesRegions,
  users,
} from '../common/db/schema'
import { AccessService } from '../access/access.service'
import { GradeQuotaService } from './grade-quota.service'
import { SalesPlansService } from '../follow-up-actions/follow-up-actions.service'
import type { AuthUser } from '../auth/auth.service'
import type { TransferCustomerDto } from './dto/transfer-customer.dto'
import type { ReleaseCustomerDto } from './dto/release-customer.dto'
import type { RestoreCustomerDto } from './dto/restore-customer.dto'
import { CustomerAssigneeService } from './customer-assignee.service'

/**
 * 归属治理（§8.3）：所有权转移 / 主动释放 / 公海认领，均走客户分级名额校验。
 * 归属单一事实源在 customers.owner_id；商机/客诉子实体当前归属 JOIN 客户自动跟随（M3 建表后无需同步）。
 */
@Injectable()
export class OwnershipService {
  constructor(
    private readonly accessService: AccessService,
    private readonly gradeQuotaService: GradeQuotaService,
    private readonly actionsService: SalesPlansService,
    private readonly assigneeService: CustomerAssigneeService,
  ) {}

  // 所有权转移（§8.3）：owner/管理链/admin 发起，同事务改归属 + 写 customer_transfers
  async transfer(customerId: string, dto: TransferCustomerDto, actor: AuthUser) {
    const customer = await this.findOwned(customerId, actor)
    await this.assertCanContribute(customer, actor)
    if (customer.ownerId === dto.toOwnerId) throw new ConflictException('不能移交给当前负责人')
    if (customer.status !== 'active') throw new ConflictException('仅 active 客户可移交')

    return db.transaction(async (tx) => {
      await this.assigneeService.assertAssignable(tx, dto.toOwnerId)
      await this.gradeQuotaService.assertSlotAvailable(tx, dto.toOwnerId, customer.grade)
      const [updated] = await tx
        .update(customers)
        .set({
          ownerId: dto.toOwnerId,
          updatedAt: new Date(),
          version: sql`${customers.version} + 1`,
        })
        .where(and(eq(customers.id, customer.id), eq(customers.version, customer.version)))
        .returning({ id: customers.id, ownerId: customers.ownerId })
      if (!updated) throw new ConflictException('客户归属已变化，请刷新后重试')
      await tx.insert(customerTransfers).values({
        customerId: customer.id,
        fromOwnerId: customer.ownerId,
        toOwnerId: dto.toOwnerId,
        operatedById: actor.id,
        reason: dto.reason,
        eventType: 'transferred',
        fromStatus: 'active',
        toStatus: 'active',
      })
      await this.actionsService.reassignPendingForCustomer(tx, customer.id, dto.toOwnerId)
      // TODO(M3)：商机/客诉当前归属 JOIN 客户自动跟随，无需同步（§7.2 归属语义）
      return updated
    })
  }

  // 主动释放（§8.3）：owner 本人发起；pool=公海 / invalid=无效；未解决客诉拦截
  async release(customerId: string, dto: ReleaseCustomerDto, actor: AuthUser) {
    const customer = await this.findOwned(customerId, actor)
    await this.assertCanContribute(customer, actor)
    if (customer.status !== 'active') throw new ConflictException('仅在案客户可释放')
    if (dto.target === 'invalid' && !this.accessService.can(actor.role, 'customer.invalidate')) {
      throw new ForbiddenException('标记无效需由区域负责人或管理员处理')
    }
    const [openOpportunity] = await db
      .select({ id: opportunities.id })
      .from(opportunities)
      .where(
        and(
          eq(opportunities.customerId, customer.id),
          inArray(opportunities.stage, ['intent', 'following']),
        ),
      )
      .limit(1)
    if (openOpportunity) {
      throw new ConflictException('客户存在开放商机，请先结案商机或移交客户')
    }
    // §8.3 客诉拦截：未解决客诉 → 禁止释放（先解决/转交）
    const [openComplaint] = await db
      .select({ id: complaints.id })
      .from(complaints)
      .where(and(eq(complaints.customerId, customer.id), eq(complaints.status, 'registered')))
      .limit(1)
    if (openComplaint) throw new ConflictException('存在未解决客诉，请先处理')

    const nextStatus = dto.target === 'pool' ? 'public' : 'invalid'
    return db.transaction(async (tx) => {
      const [updated] = await tx
        .update(customers)
        .set({
          ownerId: null,
          status: nextStatus,
          updatedAt: new Date(),
          version: sql`${customers.version} + 1`,
        })
        .where(and(eq(customers.id, customer.id), eq(customers.version, customer.version)))
        .returning({ id: customers.id, status: customers.status, ownerId: customers.ownerId })
      if (!updated) throw new ConflictException('客户归属已变化，请刷新后重试')
      await tx.insert(customerTransfers).values({
        customerId: customer.id,
        fromOwnerId: customer.ownerId,
        toOwnerId: null,
        operatedById: actor.id,
        reason: dto.reason,
        eventType: dto.target === 'pool' ? 'released_to_pool' : 'marked_invalid',
        fromStatus: 'active',
        toStatus: nextStatus,
      })
      await this.actionsService.cancelPendingCustomerVisits(
        tx,
        customer.id,
        dto.target === 'pool' ? '客户已放入公海' : '客户已标记无效',
      )
      return updated
    })
  }

  // 公海认领（§8.3）：status=public 客户，分级名额校验，owner→本人 status→active
  async claim(customerId: string, actor: AuthUser) {
    const [customer] = await db
      .select()
      .from(customers)
      .where(and(eq(customers.id, customerId), eq(customers.status, 'public')))
      .limit(1)
    if (!customer) throw new NotFoundException('公海客户不存在')
    await this.assertRegionAccessible(customer.salesRegionId, actor)

    return db.transaction(async (tx) => {
      await this.assigneeService.assertAssignable(tx, actor.id)
      await this.gradeQuotaService.assertSlotAvailable(tx, actor.id, customer.grade)
      const [updated] = await tx
        .update(customers)
        .set({
          ownerId: actor.id,
          status: 'active',
          updatedAt: new Date(),
          version: sql`${customers.version} + 1`,
        })
        .where(
          and(
            eq(customers.id, customer.id),
            eq(customers.version, customer.version),
            eq(customers.status, 'public'),
          ),
        )
        .returning({ id: customers.id, status: customers.status, ownerId: customers.ownerId })
      if (!updated) throw new ConflictException('客户已被他人认领或状态已变化')
      await tx.insert(customerTransfers).values({
        customerId: customer.id,
        fromOwnerId: null,
        toOwnerId: actor.id,
        operatedById: actor.id,
        reason: '公海认领',
        eventType: 'claimed_from_pool',
        fromStatus: 'public',
        toStatus: 'active',
      })
      await this.actionsService.reassignPendingForCustomer(tx, customer.id, actor.id)
      return updated
    })
  }

  // 无效档案恢复：仅区域负责人/管理员；重新指定负责人并重新占用客户等级名额。
  async restore(customerId: string, dto: RestoreCustomerDto, actor: AuthUser) {
    if (!this.accessService.can(actor.role, 'customer.restore')) {
      throw new ForbiddenException('仅区域负责人或管理员可恢复无效客户')
    }
    const [customer] = await db
      .select()
      .from(customers)
      .where(and(eq(customers.id, customerId), eq(customers.status, 'invalid')))
      .limit(1)
    if (!customer) throw new NotFoundException('无效客户不存在')
    await this.assertRegionAccessible(customer.salesRegionId, actor)

    if (actor.role === 'executive') {
      const visibleIds = await this.accessService.getVisibleUserIds(actor)
      if (!visibleIds.includes(dto.toOwnerId))
        throw new ForbiddenException('只能恢复给本团队负责人')
    }

    return db.transaction(async (tx) => {
      await this.assigneeService.assertAssignable(tx, dto.toOwnerId)
      await this.assertAssigneeRegion(tx, customer.salesRegionId, dto.toOwnerId)
      await this.gradeQuotaService.assertSlotAvailable(tx, dto.toOwnerId, customer.grade)
      const [updated] = await tx
        .update(customers)
        .set({
          ownerId: dto.toOwnerId,
          status: 'active',
          updatedAt: new Date(),
          version: sql`${customers.version} + 1`,
        })
        .where(
          and(
            eq(customers.id, customer.id),
            eq(customers.version, customer.version),
            eq(customers.status, 'invalid'),
          ),
        )
        .returning({ id: customers.id, status: customers.status, ownerId: customers.ownerId })
      if (!updated) throw new ConflictException('客户状态已变化，请刷新后重试')
      await tx.insert(customerTransfers).values({
        customerId: customer.id,
        fromOwnerId: null,
        toOwnerId: dto.toOwnerId,
        operatedById: actor.id,
        reason: `恢复无效客户：${dto.reason.trim()}`,
        eventType: 'restored_from_invalid',
        fromStatus: 'invalid',
        toStatus: 'active',
      })
      return updated
    })
  }

  // ===== 内部工具 =====

  // 查询有归属的客户（owner 在数据范围可见集）
  private async findOwned(id: string, actor: AuthUser) {
    const visibleIds = await this.accessService.getVisibleUserIds(actor)
    const [customer] = await db
      .select()
      .from(customers)
      .where(and(eq(customers.id, id), inArray(customers.ownerId, visibleIds)))
      .limit(1)
    if (!customer) throw new NotFoundException('客户不存在')
    return customer
  }

  // 可维护权限（§8.3）：owner / 管理链 / admin
  private async assertCanContribute(customer: typeof customers.$inferSelect, actor: AuthUser) {
    if (customer.ownerId === actor.id) return
    if (actor.role === 'admin') return
    const isManager = await this.accessService.isManagerOf(actor.id, customer.ownerId)
    if (isManager) return
    throw new ForbiddenException('无权维护该客户')
  }

  private async assertRegionAccessible(salesRegionId: string | null, actor: AuthUser) {
    if (actor.role === 'admin' || !salesRegionId) return
    if (actor.role !== 'sales' && actor.role !== 'executive') {
      throw new ForbiddenException('无权访问该客户池')
    }
    const [match] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, actor.id), eq(users.salesRegionId, salesRegionId)))
      .limit(1)
    if (!match) throw new ForbiddenException('该客户不在你的销售区域')
  }

  private async assertAssigneeRegion(
    client: Parameters<CustomerAssigneeService['assertAssignable']>[0],
    salesRegionId: string | null,
    assigneeId: string,
  ) {
    if (!salesRegionId) return
    const [match] = await client
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, assigneeId), eq(users.salesRegionId, salesRegionId)))
      .limit(1)
    if (!match) throw new ConflictException('负责人所属区域与客户销售区域不一致')
  }
}

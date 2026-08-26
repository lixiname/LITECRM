import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { and, eq, getTableColumns, inArray } from 'drizzle-orm'
import { AccessService } from '../access/access.service'
import type { AuthUser } from '../auth/auth.service'
import { db } from '../common/db/db'
import { customers, opportunities } from '../common/db/schema'

/** 商机命令共用的可见性、维护权限与开放状态规则。 */
@Injectable()
export class OpportunityAccessService {
  constructor(private readonly accessService: AccessService) {}

  async findCustomer(id: string, actor: AuthUser) {
    const visibleIds = await this.accessService.getVisibleUserIds(actor)
    const [customer] = await db
      .select({ id: customers.id, ownerId: customers.ownerId })
      .from(customers)
      .where(and(eq(customers.id, id), inArray(customers.ownerId, visibleIds)))
      .limit(1)
    if (!customer) throw new NotFoundException('客户不存在')
    return customer
  }

  async getVisible(id: string, actor: AuthUser) {
    const visibleIds = await this.accessService.getVisibleUserIds(actor)
    const [opportunity] = await db
      .select({
        ...getTableColumns(opportunities),
        customerName: customers.name,
        currentOwnerId: customers.ownerId,
      })
      .from(opportunities)
      .innerJoin(customers, eq(opportunities.customerId, customers.id))
      .where(and(eq(opportunities.id, id), inArray(customers.ownerId, visibleIds)))
      .limit(1)
    if (!opportunity) throw new NotFoundException('商机不存在')
    return opportunity
  }

  async getEditable(id: string, actor: AuthUser) {
    const opportunity = await this.getVisible(id, actor)
    await this.accessService.assertCanContributeCustomer(opportunity.currentOwnerId, actor)
    return opportunity
  }

  assertOpen(stage: string) {
    if (stage !== 'intent' && stage !== 'following') {
      throw new ConflictException('商机已结案，不能继续操作')
    }
  }
}

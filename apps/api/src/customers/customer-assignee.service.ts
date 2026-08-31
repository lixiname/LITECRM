import { BadRequestException, Injectable } from '@nestjs/common'
import { and, eq, inArray } from 'drizzle-orm'
import { db, type DbClient } from '../common/db/db'
import { salesRegions, users } from '../common/db/schema'

type QueryClient = typeof db | DbClient

/** 客户归属候选人的唯一业务规则：仅在职销售与经理可以承担客户。 */
@Injectable()
export class CustomerAssigneeService {
  async list() {
    return db
      .select({
        id: users.id,
        displayName: users.displayName,
        role: users.role,
        region: salesRegions.name,
      })
      .from(users)
      .leftJoin(salesRegions, eq(users.salesRegionId, salesRegions.id))
      .where(and(eq(users.isActive, true), inArray(users.role, ['sales', 'executive'])))
      .orderBy(salesRegions.sortOrder, users.displayName)
  }

  async assertAssignable(client: QueryClient, userId: string) {
    const [assignee] = await client
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.id, userId),
          eq(users.isActive, true),
          inArray(users.role, ['sales', 'executive']),
        ),
      )
      .limit(1)
    if (!assignee) throw new BadRequestException('负责人必须是在职销售或经理')
  }
}

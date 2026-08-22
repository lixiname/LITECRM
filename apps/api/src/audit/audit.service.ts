import { Injectable } from '@nestjs/common'
import { db } from '../common/db/db'
import { auditLogs } from '../common/db/schema'

export interface AuditLogParams {
  actorId?: string | null
  action: string
  entityType: string
  entityId: string
  before?: unknown
  after?: unknown
}

// 审计日志（§8.10）：append-only，不可改不可删，业务回溯（红线 14）
@Injectable()
export class AuditService {
  async log(params: AuditLogParams): Promise<void> {
    await db.insert(auditLogs).values({
      actorId: params.actorId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      before: params.before ?? null,
      after: params.after ?? null,
    })
  }
}

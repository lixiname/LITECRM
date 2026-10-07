import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { eq, inArray } from 'drizzle-orm'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { seedAccounts } from '../../../scripts/seed'
import { AppModule } from '../../app.module'
import { db } from '../../common/db/db'
import { auditLogs, visitEntryRules } from '../../common/db/schema'

describe('拜访填报规则接口', () => {
  let app: INestApplication
  let adminToken: string
  let salesToken: string
  let originalRules: typeof visitEntryRules.$inferSelect | undefined
  let originalAuditIds: Set<string>

  beforeAll(async () => {
    await seedAccounts()
    ;[originalRules] = await db.select().from(visitEntryRules)
    originalAuditIds = new Set(
      (
        await db
          .select({ id: auditLogs.id })
          .from(auditLogs)
          .where(eq(auditLogs.action, 'visit_entry_rules.updated'))
      ).map((row) => row.id),
    )

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api')
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    await app.init()

    adminToken = await login('admin', 'Admin@123456')
    salesToken = await login('sales1', 'Crm@123456')
  })

  afterAll(async () => {
    if (originalRules) {
      await db
        .update(visitEntryRules)
        .set({
          businessSituationMinLength: originalRules.businessSituationMinLength,
          nextActionContentMinLength: originalRules.nextActionContentMinLength,
          updatedAt: originalRules.updatedAt,
        })
        .where(eq(visitEntryRules.id, 'company'))
    } else {
      await db.delete(visitEntryRules).where(eq(visitEntryRules.id, 'company'))
    }
    const newAuditIds = (
      await db
        .select({ id: auditLogs.id })
        .from(auditLogs)
        .where(eq(auditLogs.action, 'visit_entry_rules.updated'))
    )
      .map((row) => row.id)
      .filter((id) => !originalAuditIds.has(id))
    if (newAuditIds.length) await db.delete(auditLogs).where(inArray(auditLogs.id, newAuditIds))
    await app?.close()
  })

  async function login(username: string, password: string) {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username, password })
    expect(response.status).toBe(200)
    return (response.body as { accessToken: string }).accessToken
  }

  it('普通销售可读取规则，但只有管理员可修改', async () => {
    const read = await request(app.getHttpServer())
      .get('/api/visits/rules')
      .set('Authorization', `Bearer ${salesToken}`)
    expect(read.status).toBe(200)
    expect(read.body).toEqual({
      businessSituationMinLength: originalRules?.businessSituationMinLength ?? 0,
      nextActionContentMinLength: originalRules?.nextActionContentMinLength ?? 0,
    })

    const forbidden = await request(app.getHttpServer())
      .patch('/api/visits/rules')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ businessSituationMinLength: 4, nextActionContentMinLength: 5 })
    expect(forbidden.status).toBe(403)

    const updated = await request(app.getHttpServer())
      .patch('/api/visits/rules')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ businessSituationMinLength: 4, nextActionContentMinLength: 5 })
    expect(updated.status).toBe(200)
    expect(updated.body).toEqual({ businessSituationMinLength: 4, nextActionContentMinLength: 5 })
  })

  it('服务端在写拜访前拦截不足字数，且拒绝不合法配置', async () => {
    const invalidRules = await request(app.getHttpServer())
      .patch('/api/visits/rules')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ businessSituationMinLength: -1, nextActionContentMinLength: 1.5 })
    expect(invalidRules.status).toBe(400)

    const shortVisit = await request(app.getHttpServer())
      .post('/api/visits')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        customerId: '00000000-0000-4000-8000-000000000001',
        occurredAt: '2026-10-07',
        method: 'offline_visit',
        businessSituation: '短',
        nextActionAt: '2026-10-08',
        nextActionContent: '下次拜访客户',
      })
    expect(shortVisit.status).toBe(400)
    expect(shortVisit.body.message).toContain('本次情况至少填写 4 字')

    const shortNext = await request(app.getHttpServer())
      .post('/api/visits')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        customerId: '00000000-0000-4000-8000-000000000001',
        occurredAt: '2026-10-07',
        method: 'offline_visit',
        businessSituation: '客户准备扩建产线',
        nextActionAt: '2026-10-08',
        nextActionContent: '  下周去  ',
      })
    expect(shortNext.status).toBe(400)
    expect(shortNext.body.message).toContain('下次拜访内容至少填写 5 字')
  })
})

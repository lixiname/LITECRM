import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { eq, inArray } from 'drizzle-orm'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { seedAccounts } from '../../../scripts/seed'
import { AppModule } from '../../app.module'
import { db } from '../../common/db/db'
import {
  auditLogs,
  customerGradeQuotaDefaults,
  userCustomerGradeQuotaOverrides,
  users,
} from '../../common/db/schema'

describe('客户分级名额管理', () => {
  let app: INestApplication
  let adminToken: string
  let salesToken: string
  let sales1Id: string
  let originalDefaults: (typeof customerGradeQuotaDefaults.$inferSelect)[]
  let originalOverrides: (typeof userCustomerGradeQuotaOverrides.$inferSelect)[]

  beforeAll(async () => {
    await seedAccounts()
    const [sales1] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, 'sales1'))
      .limit(1)
    sales1Id = sales1.id
    originalDefaults = await db.select().from(customerGradeQuotaDefaults)
    originalOverrides = await db
      .select()
      .from(userCustomerGradeQuotaOverrides)
      .where(eq(userCustomerGradeQuotaOverrides.userId, sales1Id))

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api')
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    await app.init()
    adminToken = await login('admin', 'Admin@123456')
    salesToken = await login('sales1', 'Crm@123456')
  })

  afterAll(async () => {
    await db.delete(customerGradeQuotaDefaults)
    if (originalDefaults.length)
      await db.insert(customerGradeQuotaDefaults).values(originalDefaults)
    await db
      .delete(userCustomerGradeQuotaOverrides)
      .where(eq(userCustomerGradeQuotaOverrides.userId, sales1Id))
    if (originalOverrides.length) {
      await db.insert(userCustomerGradeQuotaOverrides).values(originalOverrides)
    }
    await db
      .delete(auditLogs)
      .where(
        inArray(auditLogs.action, [
          'customer_grade_quota_defaults.updated',
          'user_customer_grade_quotas.updated',
        ]),
      )
    await app?.close()
  })

  async function login(username: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username, password })
    expect(response.status).toBe(200)
    return (response.body as { accessToken: string }).accessToken
  }

  it('只有系统管理员可查看与配置名额', async () => {
    const forbidden = await request(app.getHttpServer())
      .get('/api/customer-grade-quotas')
      .set('Authorization', `Bearer ${salesToken}`)
    expect(forbidden.status).toBe(403)

    const allowed = await request(app.getHttpServer())
      .get('/api/customer-grade-quotas')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(allowed.status).toBe(200)
    expect(allowed.body.defaults.map((item: { grade: string }) => item.grade)).toEqual([
      'S',
      'A',
      'B',
      'C',
    ])
    expect(allowed.body.users).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: sales1Id, role: 'sales' }),
        expect.objectContaining({ role: 'executive' }),
      ]),
    )
    expect(allowed.body.users).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ role: 'assistant' })]),
    )
  })

  it('保存公司四级默认值，并区分有限与不限', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/customer-grade-quotas/defaults')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [
          { grade: 'S', limit: 5 },
          { grade: 'A', limit: 15 },
          { grade: 'B', limit: 30 },
          { grade: 'C', limit: null },
        ],
      })

    expect(response.status).toBe(200)
    expect(response.body.defaults).toEqual([
      { grade: 'S', limit: 5 },
      { grade: 'A', limit: 15 },
      { grade: 'B', limit: 30 },
      { grade: 'C', limit: null },
    ])
  })

  it('个人规则可区分继承、自定义上限和明确不限', async () => {
    const response = await request(app.getHttpServer())
      .put(`/api/customer-grade-quotas/users/${sales1Id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [
          { grade: 'S', mode: 'unlimited' },
          { grade: 'A', mode: 'limited', limit: 3 },
          { grade: 'B', mode: 'inherit' },
          { grade: 'C', mode: 'inherit' },
        ],
      })

    expect(response.status).toBe(200)
    const user = response.body.users.find((item: { userId: string }) => item.userId === sales1Id)
    expect(user.quotas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ grade: 'S', mode: 'unlimited', effectiveLimit: null }),
        expect.objectContaining({ grade: 'A', mode: 'limited', effectiveLimit: 3 }),
        expect.objectContaining({ grade: 'B', mode: 'inherit', effectiveLimit: 30 }),
        expect.objectContaining({ grade: 'C', mode: 'inherit', effectiveLimit: null }),
      ]),
    )
  })

  it('拒绝缺失或重复等级的部分配置，避免只更新一半', async () => {
    const response = await request(app.getHttpServer())
      .put(`/api/customer-grade-quotas/users/${sales1Id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [
          { grade: 'S', mode: 'inherit' },
          { grade: 'S', mode: 'inherit' },
          { grade: 'B', mode: 'inherit' },
          { grade: 'C', mode: 'inherit' },
        ],
      })

    expect(response.status).toBe(400)
    expect(response.body.message).toContain('必须且只能提交 S/A/B/C 四个客户等级')
  })
})

import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { sql } from 'drizzle-orm'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { AppModule } from '../../app.module'
import { seedAccounts } from '../../../scripts/seed'
import { db } from '../../common/db/db'
import { weeklyPlanItems, weeklyPlans } from '../../common/db/schema'

// M4 验收（里程碑：周计划联动、费用作废不改总额 单测绿）
describe('M4 计划费用域（§8.7/§8.8）', () => {
  let app: INestApplication

  beforeAll(async () => {
    await seedAccounts()
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api')
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    await app.init()
  })

  beforeEach(async () => {
    await cleanup()
  })

  afterAll(async () => {
    await cleanup()
    await app?.close()
  })

  async function login(username: string, password: string) {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username, password })
    expect(res.status).toBe(200)
    return res.body as { accessToken: string }
  }

  async function createCustomer(token: string, name: string) {
    const res = await request(app.getHttpServer())
      .post('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name, contacts: [{ name: '测试', phone: '13800000005' }] })
    expect(res.status).toBe(201)
    return res.body as { id: string }
  }

  async function cleanup() {
    await db.execute(sql`DELETE FROM management_comments`).catch(() => {})
    await db
      .execute(sql`DELETE FROM weekly_plan_items WHERE plan_id IN (SELECT id FROM weekly_plans)`)
      .catch(() => {})
    await db.execute(sql`DELETE FROM weekly_plans`).catch(() => {})
    await db.execute(sql`DELETE FROM business_weeks`).catch(() => {})
    await db.execute(sql`DELETE FROM daily_expenses`).catch(() => {})
    await db
      .execute(
        sql`DELETE FROM visit_records WHERE customer_id IN (SELECT id FROM customers WHERE name LIKE 'M4_%')`,
      )
      .catch(() => {})
    await db.execute(sql`DELETE FROM customers WHERE name LIKE 'M4_%'`).catch(() => {})
  }

  it('拜访联动：nextFollowUpDate → 同事务生成业务周 + 周计划 + 计划项', async () => {
    const sales1 = await login('sales1', 'Crm@123456')
    const customer = await createCustomer(sales1.accessToken, 'M4_联动客户')

    const res = await request(app.getHttpServer())
      .post('/api/visits')
      .set('Authorization', `Bearer ${sales1.accessToken}`)
      .send({
        customerId: customer.id,
        occurredAt: new Date().toISOString(),
        method: 'offline_visit',
        nextFollowUpDate: '2026-09-02',
      })
    expect(res.status).toBe(201)

    const [item] = await db
      .select({
        id: weeklyPlanItems.id,
        action: weeklyPlanItems.action,
        planId: weeklyPlanItems.planId,
      })
      .from(weeklyPlanItems)
      .where(sql`action LIKE '拜访客户%'`)
    expect(item).toBeDefined()
    expect(item.action).toContain('拜访客户')

    const [plan] = await db
      .select()
      .from(weeklyPlans)
      .where(sql`id = ${item.planId}`)
    expect(plan).toBeDefined()
  })

  it('费用作废不改总额：draft → submitted → voided（剔除统计留痕）', async () => {
    const sales1 = await login('sales1', 'Crm@123456')

    const create = await request(app.getHttpServer())
      .post('/api/expenses')
      .set('Authorization', `Bearer ${sales1.accessToken}`)
      .send({ expenseDate: '2026-08-20', dining: 200, gifts: 100 })
    expect(create.status).toBe(201)
    expect(create.body.status).toBe('draft')
    const expId = create.body.id as string

    const submit = await request(app.getHttpServer())
      .post(`/api/expenses/${expId}/submit`)
      .set('Authorization', `Bearer ${sales1.accessToken}`)
    expect(submit.status).toBe(201)
    expect(submit.body.status).toBe('submitted')

    const update = await request(app.getHttpServer())
      .post('/api/expenses')
      .set('Authorization', `Bearer ${sales1.accessToken}`)
      .send({ expenseDate: '2026-08-20', dining: 300 })
    expect(update.status).toBe(409)

    const v = await request(app.getHttpServer())
      .post(`/api/expenses/${expId}/void`)
      .set('Authorization', `Bearer ${sales1.accessToken}`)
    expect(v.status).toBe(201)
    expect(v.body.status).toBe('voided')

    const list = await request(app.getHttpServer())
      .get('/api/expenses')
      .set('Authorization', `Bearer ${sales1.accessToken}`)
    expect(list.body[0].status).toBe('voided')
    expect(Number(list.body[0].dining)).toBe(200)
  })

  it('指导意见：上级可发、下属未读红点、标记已读', async () => {
    const manager = await login('manager', 'Crm@123456')
    const sales1 = await login('sales1', 'Crm@123456')
    const sales1Id = (
      (await db.execute(sql`SELECT id FROM users WHERE username='sales1'`)).rows[0] as {
        id: string
      }
    ).id
    const customer = await createCustomer(sales1.accessToken, 'M4_意见客户')
    const visitRes = await request(app.getHttpServer())
      .post('/api/visits')
      .set('Authorization', `Bearer ${sales1.accessToken}`)
      .send({ customerId: customer.id, occurredAt: new Date().toISOString(), method: 'remote' })
    const visitId = visitRes.body.id

    const comment = await request(app.getHttpServer())
      .post('/api/comments')
      .set('Authorization', `Bearer ${manager.accessToken}`)
      .send({ targetType: 'visit', targetId: visitId, ownerId: sales1Id, content: '记得跟进报价' })
    expect(comment.status).toBe(201)

    const unread = await request(app.getHttpServer())
      .get('/api/comments/unread')
      .set('Authorization', `Bearer ${sales1.accessToken}`)
    expect(unread.body).toHaveLength(1)

    const read = await request(app.getHttpServer())
      .post(`/api/comments/${comment.body.id}/read`)
      .set('Authorization', `Bearer ${sales1.accessToken}`)
    expect(read.status).toBe(201)
    const unread2 = await request(app.getHttpServer())
      .get('/api/comments/unread')
      .set('Authorization', `Bearer ${sales1.accessToken}`)
    expect(unread2.body).toHaveLength(0)
  })
})

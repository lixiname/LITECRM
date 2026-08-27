import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { sql } from 'drizzle-orm'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { AppModule } from '../../app.module'
import { seedAccounts } from '../../../scripts/seed'
import { db } from '../../common/db/db'
import { followUpActions } from '../../common/db/schema'

// M4 验收（里程碑：统一行动周视图、费用作废不改总额）
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
      .execute(
        sql`DELETE FROM follow_up_actions WHERE customer_id IN (SELECT id FROM customers WHERE name LIKE 'M4_%')`,
      )
      .catch(() => {})
    await db.execute(sql`DELETE FROM weekly_plans`).catch(() => {})
    await db.execute(sql`DELETE FROM business_weeks`).catch(() => {})
    await db.execute(sql`DELETE FROM daily_expenses`).catch(() => {})
    await db
      .execute(
        sql`DELETE FROM visit_records WHERE customer_id IN (SELECT id FROM customers WHERE name LIKE 'M4_%')`,
      )
      .catch(() => {})
    await db
      .execute(
        sql`DELETE FROM customer_grade_changes WHERE customer_id IN (SELECT id FROM customers WHERE name LIKE 'M4_%')`,
      )
      .catch(() => {})
    await db
      .execute(
        sql`DELETE FROM contacts WHERE customer_id IN (SELECT id FROM customers WHERE name LIKE 'M4_%')`,
      )
      .catch(() => {})
    await db.execute(sql`DELETE FROM customers WHERE name LIKE 'M4_%'`).catch(() => {})
  }

  it('拜访联动：拜访事实与下一计划同事务写入，周视图同时汇集计划与实际', async () => {
    const sales1 = await login('sales1', 'Crm@123456')
    const customer = await createCustomer(sales1.accessToken, 'M4_联动客户')

    const res = await request(app.getHttpServer())
      .post('/api/visits')
      .set('Authorization', `Bearer ${sales1.accessToken}`)
      .send({
        customerId: customer.id,
        occurredAt: '2026-09-02T08:30:00+08:00',
        method: 'offline_visit',
        nextActionAt: '2026-09-02T09:00:00+08:00',
        nextActionContent: '确认过滤设备选型参数',
      })
    expect(res.status).toBe(201)

    const [action] = await db
      .select()
      .from(followUpActions)
      .where(
        sql`${followUpActions.originType} = 'visit' AND ${followUpActions.sourceId} = ${res.body.id}`,
      )
    expect(action).toBeDefined()
    expect(action.content).toBe('确认过滤设备选型参数')

    const week = await request(app.getHttpServer())
      .get('/api/week-view?start=2026-09-01&end=2026-09-07')
      .set('Authorization', `Bearer ${sales1.accessToken}`)
    expect(week.status).toBe(200)
    expect(week.body.plans.some((item: { id: string }) => item.id === action.id)).toBe(true)
    expect(week.body.businessRecords.some((item: { id: string }) => item.id === res.body.id)).toBe(
      true,
    )
  })

  it('周视图手工安排拜访计划，执行时保留原计划并接续下一次拜访', async () => {
    const sales1 = await login('sales1', 'Crm@123456')
    const customer = await createCustomer(sales1.accessToken, 'M4_计划闭环客户')
    const plan = await request(app.getHttpServer())
      .post('/api/sales-plans')
      .set('Authorization', `Bearer ${sales1.accessToken}`)
      .send({
        planKind: 'customer_visit',
        customerId: customer.id,
        plannedAt: '2026-09-08T09:00:00+08:00',
        content: '了解过滤设备运行情况',
      })
    expect(plan.status).toBe(201)

    const visit = await request(app.getHttpServer())
      .post('/api/visits')
      .set('Authorization', `Bearer ${sales1.accessToken}`)
      .send({
        customerId: customer.id,
        sourcePlanId: plan.body.id,
        occurredAt: '2026-09-08T10:00:00+08:00',
        method: 'offline_visit',
        businessSituation: '现场实际改为了解明年扩产计划',
        nextActionAt: '2026-10-08T09:00:00+08:00',
        nextActionContent: '确认扩产预算是否获批',
      })
    expect(visit.status).toBe(201)
    expect(visit.body.sourcePlanId).toBe(plan.body.id)

    const rows = await db
      .select()
      .from(followUpActions)
      .where(sql`${followUpActions.customerId} = ${customer.id}`)
    expect(rows.find((item) => item.id === plan.body.id)?.status).toBe('completed')
    const next = rows.find((item) => item.status === 'pending')
    expect(next?.planKind).toBe('customer_visit')
    expect(next?.content).toBe('确认扩产预算是否获批')

    const week = await request(app.getHttpServer())
      .get('/api/week-view?start=2026-09-07&end=2026-09-13')
      .set('Authorization', `Bearer ${sales1.accessToken}`)
    expect(week.body.plans.find((item: { id: string }) => item.id === plan.body.id)?.status).toBe(
      'completed',
    )
    expect(
      week.body.businessRecords.find(
        (item: { sourcePlanId: string }) => item.sourcePlanId === plan.body.id,
      )?.type,
    ).toBe('customer_visit')
  })

  it('临时拜访可保留已有计划；计划替换必须原子地产生新计划', async () => {
    const sales1 = await login('sales1', 'Crm@123456')
    const customer = await createCustomer(sales1.accessToken, 'M4_临时拜访客户')
    const plan = await request(app.getHttpServer())
      .post('/api/sales-plans')
      .set('Authorization', `Bearer ${sales1.accessToken}`)
      .send({
        planKind: 'customer_visit',
        customerId: customer.id,
        plannedAt: '2026-09-15T09:00:00+08:00',
        content: '原定客户拜访',
      })

    const unplanned = await request(app.getHttpServer())
      .post('/api/visits')
      .set('Authorization', `Bearer ${sales1.accessToken}`)
      .send({
        customerId: customer.id,
        occurredAt: '2026-09-10T10:00:00+08:00',
        method: 'offline_visit',
        keepExistingPlan: true,
      })
    expect(unplanned.status).toBe(201)
    expect(unplanned.body.sourcePlanId).toBeNull()

    const replacement = await request(app.getHttpServer())
      .post(`/api/sales-plans/${plan.body.id}/replace`)
      .set('Authorization', `Bearer ${sales1.accessToken}`)
      .send({
        version: plan.body.version,
        plannedAt: '2026-09-18T14:00:00+08:00',
        content: '改为拜访技术负责人',
        reason: '客户联系人调整',
      })
    expect(replacement.status).toBe(201)
    expect(replacement.body.replaced.status).toBe('cancelled')
    expect(replacement.body.replacement.status).toBe('pending')
    expect(replacement.body.replacement.content).toBe('改为拜访技术负责人')
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
      .send({
        customerId: customer.id,
        occurredAt: new Date().toISOString(),
        method: 'remote',
        nextActionAt: '2026-09-10T09:00:00+08:00',
        nextActionContent: '再次拜访客户',
      })
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

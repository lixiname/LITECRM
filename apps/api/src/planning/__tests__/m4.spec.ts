import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { sql } from 'drizzle-orm'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { AppModule } from '../../app.module'
import { seedAccounts } from '../../../scripts/seed'
import { db } from '../../common/db/db'
import { followUpActions, salesPlanReschedules } from '../../common/db/schema'
import { businessDate, todayBusinessDate } from '../../common/business-date'

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
        sql`DELETE FROM sales_plan_reschedules WHERE sales_plan_id IN (SELECT id FROM follow_up_actions WHERE customer_id IN (SELECT id FROM customers WHERE name LIKE 'M4_%'))`,
      )
      .catch(() => {})
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
        sql`DELETE FROM opportunity_quotes WHERE opportunity_id IN (SELECT id FROM opportunities WHERE customer_id IN (SELECT id FROM customers WHERE name LIKE 'M4_%'))`,
      )
      .catch(() => {})
    await db
      .execute(
        sql`DELETE FROM opportunity_follow_ups WHERE opportunity_id IN (SELECT id FROM opportunities WHERE customer_id IN (SELECT id FROM customers WHERE name LIKE 'M4_%'))`,
      )
      .catch(() => {})
    await db
      .execute(
        sql`DELETE FROM opportunity_events WHERE customer_id IN (SELECT id FROM customers WHERE name LIKE 'M4_%')`,
      )
      .catch(() => {})
    await db
      .execute(
        sql`DELETE FROM opportunities WHERE customer_id IN (SELECT id FROM customers WHERE name LIKE 'M4_%')`,
      )
      .catch(() => {})
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
        occurredAt: '2026-09-02',
        method: 'offline_visit',
        nextActionAt: '2026-09-02',
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

  it('周视图手工安排拜访计划，执行时完成原计划并接续下一次拜访', async () => {
    const sales1 = await login('sales1', 'Crm@123456')
    const customer = await createCustomer(sales1.accessToken, 'M4_计划闭环客户')
    const plan = await request(app.getHttpServer())
      .post('/api/sales-plans')
      .set('Authorization', `Bearer ${sales1.accessToken}`)
      .send({
        planKind: 'customer_visit',
        customerId: customer.id,
        plannedAt: '2026-09-08',
        content: '了解过滤设备运行情况',
      })
    expect(plan.status).toBe(201)

    const visit = await request(app.getHttpServer())
      .post('/api/visits')
      .set('Authorization', `Bearer ${sales1.accessToken}`)
      .send({
        customerId: customer.id,
        sourcePlanId: plan.body.id,
        occurredAt: '2026-09-08',
        method: 'offline_visit',
        businessSituation: '现场实际改为了解明年扩产计划',
        nextActionAt: '2026-10-08',
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

  it('计划改期保持同一计划并追加不可变的日期、原因与操作人历史', async () => {
    const sales1 = await login('sales1', 'Crm@123456')
    const customer = await createCustomer(sales1.accessToken, 'M4_改期留痕客户')
    const plan = await request(app.getHttpServer())
      .post('/api/sales-plans')
      .set('Authorization', `Bearer ${sales1.accessToken}`)
      .send({
        planKind: 'customer_visit',
        customerId: customer.id,
        plannedAt: '2026-09-15',
        content: '拜访设备负责人',
      })
    expect(plan.status).toBe(201)

    const rescheduled = await request(app.getHttpServer())
      .post(`/api/sales-plans/${plan.body.id}/reschedule`)
      .set('Authorization', `Bearer ${sales1.accessToken}`)
      .send({
        version: plan.body.version,
        plannedAt: '2026-09-18',
        reason: '客户临时安排设备检修',
      })
    expect(rescheduled.status).toBe(201)
    expect(rescheduled.body.id).toBe(plan.body.id)
    expect(rescheduled.body.content).toBe('拜访设备负责人')
    expect(rescheduled.body.plannedAt).toBe('2026-09-18')

    const history = await request(app.getHttpServer())
      .get(`/api/sales-plans/${plan.body.id}/reschedules`)
      .set('Authorization', `Bearer ${sales1.accessToken}`)
    expect(history.status).toBe(200)
    expect(history.body).toHaveLength(1)
    expect(history.body[0]).toMatchObject({
      salesPlanId: plan.body.id,
      reason: '客户临时安排设备检修',
      changedByName: '销售甲',
    })
    expect(await db.select().from(salesPlanReschedules)).toEqual(
      expect.arrayContaining([expect.objectContaining({ salesPlanId: plan.body.id })]),
    )

    const sameDay = await request(app.getHttpServer())
      .post(`/api/sales-plans/${plan.body.id}/reschedule`)
      .set('Authorization', `Bearer ${sales1.accessToken}`)
      .send({
        version: rescheduled.body.version,
        plannedAt: '2026-09-18',
        reason: '只修改同一天的时刻',
      })
    expect(sameDay.status).toBe(409)
  })

  it('周视图将本周已经过去的待执行计划同时归入逾期队列', async () => {
    const sales1 = await login('sales1', 'Crm@123456')
    const customer = await createCustomer(sales1.accessToken, 'M4_本周逾期客户')
    const yesterday = businessDate(new Date(Date.now() - 86_400_000))
    const rangeStart = businessDate(new Date(Date.now() - 3 * 86_400_000))
    const rangeEnd = businessDate(new Date(Date.now() + 3 * 86_400_000))
    const plan = await request(app.getHttpServer())
      .post('/api/sales-plans')
      .set('Authorization', `Bearer ${sales1.accessToken}`)
      .send({
        planKind: 'customer_visit',
        customerId: customer.id,
        plannedAt: yesterday,
        content: '处理本周已经逾期的计划',
      })
    expect(plan.status).toBe(201)

    const view = await request(app.getHttpServer())
      .get(`/api/week-view?start=${rangeStart}&end=${rangeEnd}`)
      .set('Authorization', `Bearer ${sales1.accessToken}`)
    expect(view.status).toBe(200)
    expect(view.body.plans).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: plan.body.id })]),
    )
    expect(view.body.overdue).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: plan.body.id })]),
    )
  })

  it('改期只允许今天或未来日期', async () => {
    const sales1 = await login('sales1', 'Crm@123456')
    const customer = await createCustomer(sales1.accessToken, 'M4_改期日期约束客户')
    const tomorrow = businessDate(new Date(Date.now() + 86_400_000))
    const yesterday = businessDate(new Date(Date.now() - 86_400_000))
    const plan = await request(app.getHttpServer())
      .post('/api/sales-plans')
      .set('Authorization', `Bearer ${sales1.accessToken}`)
      .send({
        planKind: 'customer_visit',
        customerId: customer.id,
        plannedAt: tomorrow,
        content: '等待改期',
      })

    const rejected = await request(app.getHttpServer())
      .post(`/api/sales-plans/${plan.body.id}/reschedule`)
      .set('Authorization', `Bearer ${sales1.accessToken}`)
      .send({ version: plan.body.version, plannedAt: yesterday, reason: '错误地改到过去' })
    expect(rejected.status).toBe(400)
    expect(rejected.body.message).toBe('改期日期不能早于今天')

    const accepted = await request(app.getHttpServer())
      .post(`/api/sales-plans/${plan.body.id}/reschedule`)
      .set('Authorization', `Bearer ${sales1.accessToken}`)
      .send({ version: plan.body.version, plannedAt: todayBusinessDate(), reason: '调整到今天' })
    expect(accepted.status).toBe(201)
  })

  it('直接登记不执行已有计划；下一安排相同则沿用，变化则留痕调整', async () => {
    const sales1 = await login('sales1', 'Crm@123456')
    const customer = await createCustomer(sales1.accessToken, 'M4_临时拜访客户')
    const plan = await request(app.getHttpServer())
      .post('/api/sales-plans')
      .set('Authorization', `Bearer ${sales1.accessToken}`)
      .send({
        planKind: 'customer_visit',
        customerId: customer.id,
        plannedAt: '2026-09-15',
        content: '原定客户拜访',
      })

    const unplanned = await request(app.getHttpServer())
      .post('/api/visits')
      .set('Authorization', `Bearer ${sales1.accessToken}`)
      .send({
        customerId: customer.id,
        occurredAt: '2026-09-10',
        method: 'offline_visit',
        nextActionAt: '2026-09-15',
        nextActionContent: '原定客户拜访',
      })
    expect(unplanned.status).toBe(201)
    expect(unplanned.body.sourcePlanId).toBeNull()

    const [unchanged] = await db
      .select()
      .from(followUpActions)
      .where(sql`${followUpActions.customerId} = ${customer.id}`)
    expect(unchanged.id).toBe(plan.body.id)
    expect(unchanged.status).toBe('pending')

    const adjustedVisit = await request(app.getHttpServer())
      .post('/api/visits')
      .set('Authorization', `Bearer ${sales1.accessToken}`)
      .send({
        customerId: customer.id,
        occurredAt: '2026-09-11',
        method: 'remote',
        nextActionAt: '2026-09-18',
        nextActionContent: '改为拜访技术负责人',
      })
    expect(adjustedVisit.status).toBe(201)

    const rows = await db
      .select()
      .from(followUpActions)
      .where(sql`${followUpActions.customerId} = ${customer.id}`)
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe(plan.body.id)
    expect(rows[0].status).toBe('pending')
    expect(rows[0].plannedAt).toBe('2026-09-18')
    expect(rows[0].content).toBe('改为拜访技术负责人')

    const history = await request(app.getHttpServer())
      .get(`/api/sales-plans/${plan.body.id}/reschedules`)
      .set('Authorization', `Bearer ${sales1.accessToken}`)
    expect(history.status).toBe(200)
    expect(history.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fromPlannedAt: '2026-09-15',
          toPlannedAt: '2026-09-18',
          fromContent: '原定客户拜访',
          toContent: '改为拜访技术负责人',
          reason: '记录计划外事实后调整下一安排',
        }),
      ]),
    )
  })

  it('商机推进可原子记录报价，周视图只显示一条组合事实', async () => {
    const sales1 = await login('sales1', 'Crm@123456')
    const customer = await createCustomer(sales1.accessToken, 'M4_推进报价客户')
    const created = await request(app.getHttpServer())
      .post('/api/opportunities')
      .set('Authorization', `Bearer ${sales1.accessToken}`)
      .send({
        customerId: customer.id,
        name: '过滤系统改造',
        source: 'referral',
        initialAmountBasis: 'estimate',
        initialAmount: 260000,
        discoveredDate: '2026-09-21',
        firstActionAt: '2026-09-22',
        firstActionContent: '确认过滤精度参数',
      })
    expect(created.status).toBe(201)

    const before = await request(app.getHttpServer())
      .get(`/api/opportunities/${created.body.id}`)
      .set('Authorization', `Bearer ${sales1.accessToken}`)
    const progressed = await request(app.getHttpServer())
      .post(`/api/opportunities/${created.body.id}/follow-ups`)
      .set('Authorization', `Bearer ${sales1.accessToken}`)
      .send({
        version: before.body.version,
        occurredAt: '2026-09-22',
        conclusion: '客户确认参数，本次给出口头报价',
        method: 'offline_visit',
        quote: { kind: 'oral', amount: 255000, note: '按当前配置估算' },
        sourcePlanId: before.body.actions[0].id,
        nextActionAt: '2026-09-29',
        nextActionContent: '确认客户对报价的反馈',
      })
    expect(progressed.status).toBe(201)

    const detail = await request(app.getHttpServer())
      .get(`/api/opportunities/${created.body.id}`)
      .set('Authorization', `Bearer ${sales1.accessToken}`)
    expect(detail.body.followUps).toHaveLength(1)
    expect(detail.body.quotes).toHaveLength(1)
    expect(detail.body.quotes[0].followUpId).toBe(detail.body.followUps[0].id)

    const week = await request(app.getHttpServer())
      .get('/api/week-view?start=2026-09-21&end=2026-09-27')
      .set('Authorization', `Bearer ${sales1.accessToken}`)
    const related = week.body.businessRecords.filter(
      (item: { opportunityId?: string }) => item.opportunityId === created.body.id,
    )
    expect(
      related.filter((item: { type: string }) => item.type === 'opportunity_follow_up'),
    ).toHaveLength(1)
    expect(
      related.filter((item: { type: string }) => item.type === 'opportunity_quote'),
    ).toHaveLength(0)
    expect(
      related.find((item: { type: string }) => item.type === 'opportunity_follow_up').summary,
    ).toContain('口头报价')
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

    const concurrentSubmit = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/expenses/${expId}/submit`)
        .set('Authorization', `Bearer ${sales1.accessToken}`)
        .send({ version: create.body.version }),
      request(app.getHttpServer())
        .post(`/api/expenses/${expId}/submit`)
        .set('Authorization', `Bearer ${sales1.accessToken}`)
        .send({ version: create.body.version }),
    ])
    expect(concurrentSubmit.map((response) => response.status).sort()).toEqual([201, 409])
    const submit = concurrentSubmit.find((response) => response.status === 201)!
    expect(submit.body.status).toBe('submitted')

    const update = await request(app.getHttpServer())
      .post('/api/expenses')
      .set('Authorization', `Bearer ${sales1.accessToken}`)
      .send({ expenseDate: '2026-08-20', dining: 300 })
    expect(update.status).toBe(409)

    const v = await request(app.getHttpServer())
      .post(`/api/expenses/${expId}/void`)
      .set('Authorization', `Bearer ${sales1.accessToken}`)
      .send({ version: submit.body.version })
    expect(v.status).toBe(201)
    expect(v.body.status).toBe('voided')

    const list = await request(app.getHttpServer())
      .get('/api/expenses')
      .set('Authorization', `Bearer ${sales1.accessToken}`)
    expect(list.body[0].status).toBe('voided')
    expect(Number(list.body[0].dining)).toBe(200)
  })

  it('计划指导：上级可留言、负责人可查看并批量标记已读，管理员不能越过汇报树', async () => {
    const manager = await login('manager', 'Crm@123456')
    const sales1 = await login('sales1', 'Crm@123456')
    const sales2 = await login('sales2', 'Crm@123456')
    const admin = await login('admin', 'Admin@123456')
    const customer = await createCustomer(sales1.accessToken, 'M4_意见客户')
    await request(app.getHttpServer())
      .post('/api/visits')
      .set('Authorization', `Bearer ${sales1.accessToken}`)
      .send({
        customerId: customer.id,
        occurredAt: new Date().toISOString().slice(0, 10),
        method: 'remote',
        nextActionAt: '2026-09-10',
        nextActionContent: '再次拜访客户',
      })
    const [plan] = await db
      .select()
      .from(followUpActions)
      .where(sql`${followUpActions.customerId} = ${customer.id}`)
      .limit(1)

    const comment = await request(app.getHttpServer())
      .post(`/api/sales-plans/${plan.id}/comments`)
      .set('Authorization', `Bearer ${manager.accessToken}`)
      .send({ content: '记得跟进报价' })
    expect(comment.status).toBe(201)
    expect(comment.body).toMatchObject({
      targetType: 'follow_up_action',
      targetId: plan.id,
      ownerId: plan.ownerId,
      content: '记得跟进报价',
    })

    const [peerComment, adminComment] = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/sales-plans/${plan.id}/comments`)
        .set('Authorization', `Bearer ${sales2.accessToken}`)
        .send({ content: '同级不能留言' }),
      request(app.getHttpServer())
        .post(`/api/sales-plans/${plan.id}/comments`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ content: '管理员不能发布业务指导' }),
    ])
    expect(peerComment.status).toBe(404)
    expect(adminComment.status).toBe(403)

    const comments = await request(app.getHttpServer())
      .get(`/api/sales-plans/${plan.id}/comments`)
      .set('Authorization', `Bearer ${sales1.accessToken}`)
    expect(comments.status).toBe(200)
    expect(comments.body).toEqual([
      expect.objectContaining({ authorName: '华东销售经理', readAt: null }),
    ])

    const week = await request(app.getHttpServer())
      .get('/api/week-view?start=2026-09-07&end=2026-09-13')
      .set('Authorization', `Bearer ${sales1.accessToken}`)
    expect(week.body.plans[0]).toMatchObject({ guidanceCount: 1, unreadGuidanceCount: 1 })

    const read = await request(app.getHttpServer())
      .post(`/api/sales-plans/${plan.id}/comments/read`)
      .set('Authorization', `Bearer ${sales1.accessToken}`)
    expect(read.status).toBe(201)
    expect(read.body).toEqual({ readCount: 1 })
    const commentsAfterRead = await request(app.getHttpServer())
      .get(`/api/sales-plans/${plan.id}/comments`)
      .set('Authorization', `Bearer ${sales1.accessToken}`)
    expect(commentsAfterRead.body[0].readAt).not.toBeNull()

    await db
      .update(followUpActions)
      .set({ status: 'completed', completedAt: new Date() })
      .where(sql`${followUpActions.id} = ${plan.id}`)
    const closedComment = await request(app.getHttpServer())
      .post(`/api/sales-plans/${plan.id}/comments`)
      .set('Authorization', `Bearer ${manager.accessToken}`)
      .send({ content: '结束后不能新增' })
    expect(closedComment.status).toBe(409)
  })
})

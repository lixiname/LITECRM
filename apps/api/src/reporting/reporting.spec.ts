import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { eq, sql } from 'drizzle-orm'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { seedAccounts } from '../../scripts/seed'
import { AppModule } from '../app.module'
import { db } from '../common/db/db'
import {
  complaints,
  customers,
  dailyExpenses,
  deals,
  followUpActions,
  opportunities,
  opportunityEvents,
  opportunityQuotes,
  salesRegions,
  users,
  visitRecords,
} from '../common/db/schema'

const ids = {
  reportSales: '90000000-0000-4000-8000-000000000001',
  salesRegion: '90000000-0000-4000-8000-000000000002',
  customer: '91000000-0000-4000-8000-000000000001',
  openOpportunity: '92000000-0000-4000-8000-000000000001',
  wonOpportunity: '92000000-0000-4000-8000-000000000002',
  supersededQuote: '93000000-0000-4000-8000-000000000001',
  activeQuote: '93000000-0000-4000-8000-000000000002',
  wonQuote: '93000000-0000-4000-8000-000000000003',
  deal: '94000000-0000-4000-8000-000000000001',
  action: '95000000-0000-4000-8000-000000000001',
  visit: '96000000-0000-4000-8000-000000000001',
  complaint: '97000000-0000-4000-8000-000000000001',
  submittedExpense: '98000000-0000-4000-8000-000000000001',
  draftExpense: '98000000-0000-4000-8000-000000000002',
} as const

describe('管理看板 reporting 域', () => {
  let app: INestApplication
  let managerId: string
  let assistantId: string
  let managerPasswordHash: string

  beforeAll(async () => {
    await seedAccounts()
    const rows = await db
      .select({ id: users.id, username: users.username, passwordHash: users.passwordHash })
      .from(users)
      .where(sql`${users.username} in ('manager','assistant')`)
    managerId = rows.find((item) => item.username === 'manager')!.id
    managerPasswordHash = rows.find((item) => item.username === 'manager')!.passwordHash
    assistantId = rows.find((item) => item.username === 'assistant')!.id

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api')
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    await app.init()
  })

  beforeEach(async () => {
    await cleanup()
    await seedReportingFacts()
  })

  afterAll(async () => {
    await cleanup()
    await app?.close()
  })

  async function login(username: string) {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username, password: 'Crm@123456' })
    expect(response.status).toBe(200)
    return response.body.accessToken as string
  }

  async function cleanup() {
    await db.transaction(async (tx) => {
      await tx.delete(followUpActions).where(eq(followUpActions.id, ids.action))
      await tx.delete(complaints).where(eq(complaints.id, ids.complaint))
      await tx.delete(deals).where(eq(deals.id, ids.deal))
      await tx
        .delete(opportunityEvents)
        .where(
          sql`${opportunityEvents.opportunityId} in (${ids.openOpportunity}, ${ids.wonOpportunity})`,
        )
      await tx
        .delete(opportunityQuotes)
        .where(
          sql`${opportunityQuotes.id} in (${ids.supersededQuote}, ${ids.activeQuote}, ${ids.wonQuote})`,
        )
      await tx
        .delete(opportunities)
        .where(sql`${opportunities.id} in (${ids.openOpportunity}, ${ids.wonOpportunity})`)
      await tx.delete(visitRecords).where(eq(visitRecords.id, ids.visit))
      await tx
        .delete(dailyExpenses)
        .where(sql`${dailyExpenses.id} in (${ids.submittedExpense}, ${ids.draftExpense})`)
      await tx.delete(customers).where(eq(customers.id, ids.customer))
      await tx.delete(users).where(eq(users.id, ids.reportSales))
      await tx.delete(salesRegions).where(eq(salesRegions.id, ids.salesRegion))
    })
  }

  async function seedReportingFacts() {
    const now = new Date()
    const tenDaysAgo = new Date(now.getTime() - 10 * 86_400_000)
    const yesterday = new Date(now.getTime() - 86_400_000)
    const today = businessDate(now)
    await db.transaction(async (tx) => {
      await tx.insert(salesRegions).values({
        id: ids.salesRegion,
        code: 'REPORT_EAST',
        name: 'REPORT_华东大区',
        sortOrder: 1,
      })
      await tx.insert(users).values({
        id: ids.reportSales,
        username: 'report_sales',
        displayName: '看板测试销售',
        passwordHash: managerPasswordHash,
        role: 'sales',
        reportsToId: managerId,
        salesRegionId: ids.salesRegion,
      })
      await tx.insert(customers).values({
        id: ids.customer,
        name: 'REPORT_重点客户',
        normalizedKey: 'report重点客户',
        grade: 'S',
        status: 'active',
        ownerId: ids.reportSales,
        createdById: ids.reportSales,
        lastActivityAt: today,
      })
      await tx.insert(opportunities).values([
        {
          id: ids.openOpportunity,
          customerId: ids.customer,
          ownerId: ids.reportSales,
          name: 'REPORT_开放报价商机',
          stage: 'following',
          source: 'referral',
          estimatedAmount: '100000',
          createdAt: tenDaysAgo,
          expectedCloseDate: today,
        },
        {
          id: ids.wonOpportunity,
          customerId: ids.customer,
          ownerId: ids.reportSales,
          name: 'REPORT_成交商机',
          stage: 'won',
          source: 'referral',
          estimatedAmount: '180000',
          createdAt: tenDaysAgo,
          closedAt: today,
          closeReason: '客户明确下单',
        },
      ])
      await tx.insert(opportunityEvents).values([
        {
          opportunityId: ids.openOpportunity,
          customerId: ids.customer,
          actorId: ids.reportSales,
          occurredAt: businessDate(tenDaysAgo),
          type: 'created',
          payload: { initialAmount: 90000 },
        },
        {
          opportunityId: ids.wonOpportunity,
          customerId: ids.customer,
          actorId: ids.reportSales,
          occurredAt: businessDate(tenDaysAgo),
          type: 'created',
          payload: { initialAmount: 180000 },
        },
      ])
      await tx.insert(opportunityQuotes).values([
        {
          id: ids.supersededQuote,
          opportunityId: ids.openOpportunity,
          actorId: ids.reportSales,
          kind: 'oral',
          quotedAt: businessDate(tenDaysAgo),
          amount: '110000',
          status: 'superseded',
        },
        {
          id: ids.activeQuote,
          opportunityId: ids.openOpportunity,
          actorId: ids.reportSales,
          kind: 'formal',
          quotedAt: today,
          amount: '125000',
          status: 'active',
        },
        {
          id: ids.wonQuote,
          opportunityId: ids.wonOpportunity,
          actorId: ids.reportSales,
          kind: 'formal',
          quotedAt: businessDate(yesterday),
          amount: '200000',
          status: 'active',
        },
      ])
      await tx.insert(deals).values({
        id: ids.deal,
        customerId: ids.customer,
        ownerId: ids.reportSales,
        occurredAt: today,
        amount: '200000',
        sourceOpportunityId: ids.wonOpportunity,
        sourceQuoteId: ids.wonQuote,
      })
      await tx.insert(followUpActions).values({
        id: ids.action,
        ownerId: ids.reportSales,
        customerId: ids.customer,
        opportunityId: ids.openOpportunity,
        planKind: 'opportunity_follow_up',
        originType: 'manual',
        plannedAt: businessDate(yesterday),
        content: 'REPORT_逾期确认正式报价反馈',
        status: 'pending',
      })
      await tx.insert(visitRecords).values({
        id: ids.visit,
        customerId: ids.customer,
        ownerId: ids.reportSales,
        occurredAt: today,
        method: 'offline_visit',
        businessSituation: 'REPORT_现场复核',
      })
      await tx.insert(complaints).values({
        id: ids.complaint,
        customerId: ids.customer,
        ownerId: ids.reportSales,
        occurredAt: today,
        type: 'service',
        status: 'registered',
        description: 'REPORT_未解决客诉',
      })
      await tx.insert(dailyExpenses).values([
        {
          id: ids.submittedExpense,
          ownerId: ids.reportSales,
          expenseDate: today,
          dining: '500',
          status: 'submitted',
          submittedAt: now,
        },
        {
          id: ids.draftExpense,
          ownerId: ids.reportSales,
          expenseDate: businessDate(yesterday),
          gifts: '999',
          status: 'draft',
        },
      ])
    })
  }

  it('管理者看到可信报价池、期间成交、团队活动、S/A 风险和已提交费用', async () => {
    const token = await login('manager')
    const end = businessDate(new Date())
    const start = businessDate(new Date(Date.now() - 30 * 86_400_000))
    const auth = { Authorization: `Bearer ${token}` }

    const pipeline = await request(app.getHttpServer())
      .get(`/api/reporting/pipeline?start=${start}&end=${end}&ownerId=${ids.reportSales}`)
      .set(auth)
    expect(pipeline.status).toBe(200)
    expect(pipeline.body.pool.totalCount).toBe(1)
    expect(pipeline.body.pool.totalAmount).toBe(125000)
    expect(pipeline.body.pool.health).toMatchObject({
      stagnantCount: 1,
      stagnantAmount: 125000,
      overdueActionCount: 1,
      noNextActionCount: 0,
    })
    expect(
      pipeline.body.pool.buckets.find((item: { key: string }) => item.key === 'formal_quote'),
    ).toMatchObject({
      count: 1,
      amount: 125000,
    })
    expect(pipeline.body.flow.won).toEqual({ count: 1, amount: 200000 })
    expect(pipeline.body.byRegion).toEqual([
      expect.objectContaining({
        salesRegionId: ids.salesRegion,
        salesRegionName: 'REPORT_华东大区',
        memberCount: 1,
        openAmount: 125000,
        wonAmount: 200000,
      }),
    ])
    expect(pipeline.body.byOwner[0]).toMatchObject({
      ownerId: ids.reportSales,
      salesRegionId: ids.salesRegion,
    })

    const team = await request(app.getHttpServer())
      .get(`/api/reporting/team?start=${start}&end=${end}&ownerId=${ids.reportSales}`)
      .set(auth)
    const sales1 = team.body.members.find(
      (item: { ownerId: string }) => item.ownerId === ids.reportSales,
    )
    expect(sales1.visits).toBe(1)
    expect(sales1.overdueCount).toBe(1)
    expect(sales1.salesRegionName).toBe('REPORT_华东大区')
    expect(sales1.topPlans).toEqual([
      expect.objectContaining({ id: ids.action, customerName: 'REPORT_重点客户' }),
    ])

    const regionFiltered = await request(app.getHttpServer())
      .get(`/api/reporting/team?start=${start}&end=${end}&salesRegionId=${ids.salesRegion}`)
      .set(auth)
    expect(regionFiltered.body.members).toEqual(
      expect.arrayContaining([expect.objectContaining({ ownerId: ids.reportSales })]),
    )

    const keyCustomers = await request(app.getHttpServer())
      .get(`/api/reporting/key-customers?start=${start}&end=${end}&ownerId=${ids.reportSales}`)
      .set(auth)
    expect(keyCustomers.body.attentionCount).toBe(1)
    expect(keyCustomers.body.items[0].reasons).toEqual(
      expect.arrayContaining(['unresolved_complaint', 'overdue_action', 'action_overdue']),
    )

    const expenses = await request(app.getHttpServer())
      .get(`/api/reporting/expenses?start=${start}&end=${end}&ownerId=${ids.reportSales}`)
      .set(auth)
    expect(expenses.body.total.amount).toBe(500)
    expect(expenses.body.total.draftDays).toBe(1)
  })

  it('新增读取创建事件金额，重新报价和结案不改写新增，切期间不改变当前池子', async () => {
    const token = await login('manager')
    const auth = { Authorization: `Bearer ${token}` }
    const end = businessDate(new Date())
    const start = businessDate(new Date(Date.now() - 20 * 86_400_000))
    const url = `/api/reporting/pipeline?start=${start}&end=${end}&ownerId=${ids.reportSales}`
    const initial = await request(app.getHttpServer()).get(url).set(auth)
    expect(initial.status).toBe(200)
    expect(initial.body.flow.created).toEqual({ count: 2, amount: 270000, missingAmountCount: 0 })
    const todayOnly = await request(app.getHttpServer())
      .get(`/api/reporting/pipeline?start=${end}&end=${end}&ownerId=${ids.reportSales}`)
      .set(auth)
    expect(todayOnly.body.flow.created.count).toBe(0)
    expect(todayOnly.body.pool).toEqual(initial.body.pool)
    await db
      .update(opportunityQuotes)
      .set({ amount: '160000' })
      .where(eq(opportunityQuotes.id, ids.activeQuote))
    const repriced = await request(app.getHttpServer()).get(url).set(auth)
    expect(repriced.body.pool.totalAmount).toBe(160000)
    expect(repriced.body.flow.created).toEqual(initial.body.flow.created)
    await db
      .update(opportunities)
      .set({ stage: 'lost', closedAt: end })
      .where(eq(opportunities.id, ids.openOpportunity))
    const closed = await request(app.getHttpServer()).get(url).set(auth)
    expect(closed.body.pool.totalCount).toBe(0)
    expect(closed.body.flow.created).toEqual(initial.body.flow.created)
    const overview = await request(app.getHttpServer())
      .get(`/api/reporting/overview?start=${start}&end=${end}&ownerId=${ids.reportSales}`)
      .set(auth)
    expect(overview.body.pipeline.created).toEqual(initial.body.flow.created)
  })

  it('销售无经营看板权限；管理者单人周视图不混入整支团队', async () => {
    const salesToken = await login('sales1')
    expect(
      (
        await request(app.getHttpServer())
          .get('/api/reporting/pipeline')
          .set('Authorization', `Bearer ${salesToken}`)
      ).status,
    ).toBe(403)

    const managerToken = await login('manager')
    const end = businessDate(new Date())
    const start = businessDate(new Date(Date.now() - 7 * 86_400_000))
    const selected = await request(app.getHttpServer())
      .get(`/api/week-view?start=${start}&end=${end}&ownerId=${ids.reportSales}`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(selected.status).toBe(200)
    expect(selected.body.ownerId).toBe(ids.reportSales)
    expect(selected.body.businessRecords).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: ids.visit })]),
    )

    const defaultView = await request(app.getHttpServer())
      .get(`/api/week-view?start=${start}&end=${end}`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(
      defaultView.body.businessRecords.some((item: { id: string }) => item.id === ids.visit),
    ).toBe(false)

    const outsideScope = await request(app.getHttpServer())
      .get(`/api/week-view?start=${start}&end=${end}&ownerId=${assistantId}`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(outsideScope.status).toBe(403)
  })

  it('销售可读取强制本人范围的商机摘要，但不能借此访问管理看板', async () => {
    const token = await login('report_sales')
    const auth = { Authorization: `Bearer ${token}` }

    const summary = await request(app.getHttpServer()).get('/api/reporting/my-pipeline').set(auth)
    expect(summary.status).toBe(200)
    expect(summary.body.pool.totalAmount).toBe(125000)
    expect(summary.body.pool.buckets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'formal_quote', count: 1, amount: 125000 }),
      ]),
    )
    expect(summary.body.pool.health.overdueActionCount).toBe(1)

    const management = await request(app.getHttpServer()).get('/api/reporting/pipeline').set(auth)
    expect(management.status).toBe(403)
  })
})

function businessDate(value: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value)
}

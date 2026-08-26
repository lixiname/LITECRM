import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { eq, sql } from 'drizzle-orm'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { AppModule } from '../../app.module'
import { seedAccounts, seedDimensions } from '../../../scripts/seed'
import { db } from '../../common/db/db'
import {
  deals,
  followUpActions,
  opportunities,
  opportunityFollowUps,
  opportunityQuotes,
} from '../../common/db/schema'

// M3 主链路 e2e（§10 测试基线：登录→建客户→拜访→商机推进→成交）
describe('M3 主链路（登录→建客户→拜访→商机→成交）', () => {
  let app: INestApplication

  beforeAll(async () => {
    await seedAccounts()
    await seedDimensions() // 初始化基础字典（visit_type/opportunity_source/complaint_type 等）
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
      .send({ name, contacts: [{ name: '测试', phone: '13800000004' }] })
    expect(res.status).toBe(201)
    return res.body as { id: string }
  }

  async function cleanup() {
    const inM3 = `customer_id IN (SELECT id FROM customers WHERE name LIKE 'M3_%')`
    await db.execute(sql`DELETE FROM follow_up_actions WHERE ${sql.raw(inM3)}`).catch(() => {})
    await db
      .execute(
        sql`DELETE FROM complaint_follow_ups WHERE complaint_id IN (SELECT id FROM complaints WHERE customer_id IN (SELECT id FROM customers WHERE name LIKE 'M3_%'))`,
      )
      .catch(() => {})
    await db.execute(sql`DELETE FROM complaints WHERE ${sql.raw(inM3)}`).catch(() => {})
    await db.execute(sql`DELETE FROM opportunity_events WHERE ${sql.raw(inM3)}`).catch(() => {})
    await db.execute(sql`DELETE FROM deals WHERE ${sql.raw(inM3)}`).catch(() => {})
    await db.execute(sql`DELETE FROM opportunity_quotes WHERE ${sql.raw(inM3)}`).catch(() => {})
    await db
      .execute(
        sql`DELETE FROM opportunity_follow_ups WHERE opportunity_id IN (SELECT id FROM opportunities WHERE ${sql.raw(inM3)})`,
      )
      .catch(() => {})
    await db.execute(sql`DELETE FROM opportunities WHERE ${sql.raw(inM3)}`).catch(() => {})
    await db.execute(sql`DELETE FROM visit_records WHERE ${sql.raw(inM3)}`).catch(() => {})
    // 归属治理子表 + 联系人（客户有 contacts 时直接删客户会撞外键，须先删）
    await db
      .execute(sql`DELETE FROM customer_claim_requests WHERE ${sql.raw(inM3)}`)
      .catch(() => {})
    await db.execute(sql`DELETE FROM customer_transfers WHERE ${sql.raw(inM3)}`).catch(() => {})
    await db.execute(sql`DELETE FROM customer_grade_changes WHERE ${sql.raw(inM3)}`).catch(() => {})
    await db.execute(sql`DELETE FROM contacts WHERE ${sql.raw(inM3)}`).catch(() => {})
    await db.execute(sql`DELETE FROM customers WHERE name LIKE 'M3_%'`).catch(() => {})
  }

  it('主链路：拜访事实 → 商机跟进 → 口头/正式报价 → 明确成交，估算与成交金额解耦', async () => {
    const sales1 = await login('sales1', 'Crm@123456')

    // 1. 建客户
    const customer = await createCustomer(sales1.accessToken, 'M3_主链路客户')

    // 2. 登记拜访（§8.4：必填 customerId/occurredAt/method）
    const visitRes = await request(app.getHttpServer())
      .post('/api/visits')
      .set('Authorization', `Bearer ${sales1.accessToken}`)
      .send({
        customerId: customer.id,
        occurredAt: new Date().toISOString(),
        method: 'offline_visit',
        visitType: 'existing_maintenance',
        businessSituation: '生意稳定',
        nextActionAt: '2026-09-01T09:00:00+08:00',
        nextActionContent: '联系设备负责人确认运行参数',
      })
    expect(visitRes.status).toBe(201)
    expect(visitRes.body.ownerId).toBeDefined()
    const visitId = visitRes.body.id as string

    const [visitAction] = await db
      .select()
      .from(followUpActions)
      .where(eq(followUpActions.sourceId, visitId))
      .limit(1)
    expect(visitAction.sourceType).toBe('visit')
    expect(visitAction.content).toBe('联系设备负责人确认运行参数')

    // 3. 新建商机：意向规模 50 万，不等同于任何一次报价
    const oppRes = await request(app.getHttpServer())
      .post('/api/opportunities')
      .set('Authorization', `Bearer ${sales1.accessToken}`)
      .send({
        customerId: customer.id,
        name: '设备升级项目',
        source: 'referral',
        estimatedAmount: 500000,
        firstActionContent: '约见技术负责人',
        firstActionAt: '2026-08-30T09:00:00+08:00',
      })
    expect(oppRes.status).toBe(201)
    expect(oppRes.body.stage).toBe('intent')
    expect(Number(oppRes.body.estimatedAmount)).toBe(500000)
    const oppId = oppRes.body.id as string
    const [firstAction] = await db
      .select()
      .from(followUpActions)
      .where(eq(followUpActions.opportunityId, oppId))
      .limit(1)

    // 4. 跟进是已发生事实；完成旧行动，同时生成唯一的新行动
    const followUp = await request(app.getHttpServer())
      .post(`/api/opportunities/${oppId}/follow-ups`)
      .set('Authorization', `Bearer ${sales1.accessToken}`)
      .send({
        version: 1,
        conclusion: '已确认需求',
        sourceVisitId: visitId,
        sourceActionId: firstAction.id,
        nextActionContent: '准备口头报价',
        nextActionAt: '2026-08-31T09:00:00+08:00',
      })
    expect(followUp.status).toBe(201)
    expect(followUp.body.stage).toBe('following')

    const followUps = await db
      .select()
      .from(opportunityFollowUps)
      .where(eq(opportunityFollowUps.opportunityId, oppId))
    expect(followUps).toHaveLength(1)

    const [quotePreparationAction] = await db
      .select()
      .from(followUpActions)
      .where(
        sql`${followUpActions.opportunityId} = ${oppId} AND ${followUpActions.status} = 'pending'`,
      )
      .limit(1)

    // 5. 口头报价、正式报价均独立留痕；每次报价都接续一个客户反馈行动
    const oralQuote = await request(app.getHttpServer())
      .post(`/api/opportunities/${oppId}/quotes`)
      .set('Authorization', `Bearer ${sales1.accessToken}`)
      .send({
        version: followUp.body.version,
        kind: 'oral',
        quotedAt: '2026-09-01T10:00:00+08:00',
        amount: 600000,
        sourceActionId: quotePreparationAction.id,
        nextActionContent: '确认客户对口头报价的反馈',
        nextActionAt: '2026-09-03T09:00:00+08:00',
      })
    expect(oralQuote.status).toBe(201)

    const afterOral = await request(app.getHttpServer())
      .get(`/api/opportunities/${oppId}`)
      .set('Authorization', `Bearer ${sales1.accessToken}`)
    const formalQuote = await request(app.getHttpServer())
      .post(`/api/opportunities/${oppId}/quotes`)
      .set('Authorization', `Bearer ${sales1.accessToken}`)
      .send({
        version: afterOral.body.version,
        kind: 'formal',
        quotedAt: '2026-09-02T10:00:00+08:00',
        amount: 620000,
        quoteNo: 'Q-M3-001',
        supersedesQuoteId: oralQuote.body.id,
        sourceActionId: afterOral.body.actions[0].id,
        nextActionContent: '确认客户对正式报价的反馈',
        nextActionAt: '2026-09-05T09:00:00+08:00',
      })
    expect(formalQuote.status).toBe(201)

    // 6. 只有明确下单命令才生成 Deal；报价本身不成交
    const afterQuote = await request(app.getHttpServer())
      .get(`/api/opportunities/${oppId}`)
      .set('Authorization', `Bearer ${sales1.accessToken}`)
    expect(afterQuote.body.deal).toBeNull()
    const won = await request(app.getHttpServer())
      .post(`/api/opportunities/${oppId}/win`)
      .set('Authorization', `Bearer ${sales1.accessToken}`)
      .send({
        version: afterQuote.body.version,
        occurredAt: '2026-09-03T10:00:00+08:00',
        amount: 620000,
        acceptedQuoteId: formalQuote.body.id,
      })
    expect(won.status).toBe(201)
    expect(won.body.opportunity.stage).toBe('won')

    // 断言：成交金额 62 万，商机估算仍 50 万；两次报价也都保留
    const [deal] = await db
      .select()
      .from(deals)
      .where(eq(deals.sourceOpportunityId, oppId))
      .limit(1)
    expect(deal).toBeDefined()
    expect(Number(deal.amount)).toBe(620000)
    expect(deal.sourceQuoteId).toBe(formalQuote.body.id)

    const [opp] = await db.select().from(opportunities).where(eq(opportunities.id, oppId)).limit(1)
    expect(Number(opp.estimatedAmount)).toBe(500000)
    expect(opp.stage).toBe('won')
    const quotes = await db
      .select()
      .from(opportunityQuotes)
      .where(eq(opportunityQuotes.opportunityId, oppId))
    expect(quotes).toHaveLength(2)
    expect(quotes.find((quote) => quote.id === oralQuote.body.id)?.status).toBe('superseded')
    const pendingAfterWin = await db
      .select()
      .from(followUpActions)
      .where(
        sql`${followUpActions.opportunityId} = ${oppId} AND ${followUpActions.status} = 'pending'`,
      )
    expect(pendingAfterWin).toHaveLength(0)

    // 7. 重复确认成交被拒绝，数据库唯一约束保证仍只有一个 Deal
    const duplicate = await request(app.getHttpServer())
      .post(`/api/opportunities/${oppId}/win`)
      .set('Authorization', `Bearer ${sales1.accessToken}`)
      .send({
        version: won.body.opportunity.version,
        occurredAt: '2026-09-03T10:00:00+08:00',
        amount: 620000,
      })
    expect(duplicate.status).toBe(409)
    const dealsCount = await db.select().from(deals).where(eq(deals.sourceOpportunityId, oppId))
    expect(dealsCount).toHaveLength(1)
  })

  it('客诉登记→确认解决（§8.6 两态闭环）', async () => {
    const sales1 = await login('sales1', 'Crm@123456')
    const customer = await createCustomer(sales1.accessToken, 'M3_客诉客户')

    const createRes = await request(app.getHttpServer())
      .post('/api/complaints')
      .set('Authorization', `Bearer ${sales1.accessToken}`)
      .send({
        customerId: customer.id,
        occurredAt: new Date().toISOString(),
        type: 'product_quality',
        description: '设备异响',
        firstActionAt: '2026-08-29T09:00:00+08:00',
        firstActionContent: '联系客户确认异响工况',
      })
    expect(createRes.status).toBe(201)
    expect(createRes.body.status).toBe('registered')
    const complaintId = createRes.body.id as string
    const [firstAction] = await db
      .select()
      .from(followUpActions)
      .where(eq(followUpActions.complaintId, complaintId))
      .limit(1)

    // 跟进确认解决（§8.6：RESOLVED → 必填解决结果）
    const resolved = await request(app.getHttpServer())
      .post(`/api/complaints/${complaintId}/follow-up`)
      .set('Authorization', `Bearer ${sales1.accessToken}`)
      .send({
        version: createRes.body.version,
        sourceActionId: firstAction.id,
        content: '更换轴承后解决',
        outcome: 'resolved',
        resolution: '更换轴承',
      })
    expect(resolved.status).toBe(201)
    expect(resolved.body.status).toBe('resolved')

    // 已解决后禁止再跟进
    const again = await request(app.getHttpServer())
      .post(`/api/complaints/${complaintId}/follow-up`)
      .set('Authorization', `Bearer ${sales1.accessToken}`)
      .send({
        version: resolved.body.version,
        content: '再跟',
        outcome: 'followed_up',
        nextActionAt: '2026-09-01T09:00:00+08:00',
        nextActionContent: '再次联系客户',
      })
    expect(again.status).toBe(409)
  })

  it('释放时未解决客诉拦截 → 409（§8.3 M3 接入）', async () => {
    const sales1 = await login('sales1', 'Crm@123456')
    const customer = await createCustomer(sales1.accessToken, 'M3_拦截客户')
    await request(app.getHttpServer())
      .post('/api/complaints')
      .set('Authorization', `Bearer ${sales1.accessToken}`)
      .send({
        customerId: customer.id,
        occurredAt: new Date().toISOString(),
        type: 'service',
        description: '售后未处理',
        firstActionAt: '2026-08-28T09:00:00+08:00',
        firstActionContent: '联系售后确认处理人',
      })

    const release = await request(app.getHttpServer())
      .post(`/api/customers/${customer.id}/release`)
      .set('Authorization', `Bearer ${sales1.accessToken}`)
      .send({ target: 'pool', reason: '想释放' })
    expect(release.status).toBe(409)
  })
})

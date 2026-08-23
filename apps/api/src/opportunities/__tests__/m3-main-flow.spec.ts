import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { eq, sql } from 'drizzle-orm'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { AppModule } from '../../app.module'
import { seedAccounts } from '../../../scripts/seed'
import { db } from '../../common/db/db'
import { deals, opportunities } from '../../common/db/schema'

// M3 主链路 e2e（§10 测试基线：登录→建客户→拜访→商机推进→成交）
describe('M3 主链路（登录→建客户→拜访→商机→成交）', () => {
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
      .send({ name, contacts: [{ name: '测试', phone: '13800000004' }] })
    expect(res.status).toBe(201)
    return res.body as { id: string }
  }

  async function cleanup() {
    const inM3 = `customer_id IN (SELECT id FROM customers WHERE name LIKE 'M3_%')`
    await db
      .execute(
        sql`DELETE FROM complaint_follow_ups WHERE complaint_id IN (SELECT id FROM complaints WHERE customer_id IN (SELECT id FROM customers WHERE name LIKE 'M3_%'))`,
      )
      .catch(() => {})
    await db.execute(sql`DELETE FROM complaints WHERE ${sql.raw(inM3)}`).catch(() => {})
    await db.execute(sql`DELETE FROM opportunity_events WHERE ${sql.raw(inM3)}`).catch(() => {})
    await db.execute(sql`DELETE FROM deals WHERE ${sql.raw(inM3)}`).catch(() => {})
    await db.execute(sql`DELETE FROM visit_records WHERE ${sql.raw(inM3)}`).catch(() => {})
    await db.execute(sql`DELETE FROM opportunities WHERE ${sql.raw(inM3)}`).catch(() => {})
    await db.execute(sql`DELETE FROM customers WHERE name LIKE 'M3_%'`).catch(() => {})
  }

  it('主链路：建客户 → 拜访 → 商机(意向50万) → 推进 → 转成交(62万) → 金额解耦', async () => {
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
        nextFollowUpDate: '2026-09-01',
      })
    expect(visitRes.status).toBe(201)
    expect(visitRes.body.ownerId).toBeDefined()

    // 3. 新建商机：意向金额 50 万（口头）
    const oppRes = await request(app.getHttpServer())
      .post('/api/opportunities')
      .set('Authorization', `Bearer ${sales1.accessToken}`)
      .send({
        customerId: customer.id,
        name: '设备升级项目',
        source: 'referral',
        amountType: 'oral',
        amount: 500000,
        nextAction: '约见技术负责人',
        nextFollowUpDate: '2026-08-30',
      })
    expect(oppRes.status).toBe(201)
    expect(oppRes.body.stage).toBe('intent')
    expect(Number(oppRes.body.amount)).toBe(500000)
    const oppId = oppRes.body.id as string

    // 4. 推进（无报价金额 → following）
    const adv1 = await request(app.getHttpServer())
      .post(`/api/opportunities/${oppId}/advance`)
      .set('Authorization', `Bearer ${sales1.accessToken}`)
      .send({ conclusion: '已确认需求', nextAction: '出报价', nextFollowUpDate: '2026-08-31' })
    expect(adv1.status).toBe(201)
    expect(adv1.body.stage).toBe('following')

    // 5. 转成交：报价 62 万（意向 50 → 成交 62，金额解耦）
    const adv2 = await request(app.getHttpServer())
      .post(`/api/opportunities/${oppId}/advance`)
      .set('Authorization', `Bearer ${sales1.accessToken}`)
      .send({ conclusion: '客户确认下单', quoteAmount: 620000 })
    expect(adv2.status).toBe(201)
    expect(adv2.body.stage).toBe('ordered')

    // 断言：Deal 成交金额 62 万，机会意向金额仍 50 万（不互相覆盖）
    const [deal] = await db
      .select()
      .from(deals)
      .where(eq(deals.sourceOpportunityId, oppId))
      .limit(1)
    expect(deal).toBeDefined()
    expect(Number(deal.amount)).toBe(620000)

    const [opp] = await db.select().from(opportunities).where(eq(opportunities.id, oppId)).limit(1)
    expect(Number(opp.amount)).toBe(500000)
    expect(opp.stage).toBe('ordered')

    // 6. 幂等：重复转成交不再生成第二个 Deal
    await request(app.getHttpServer())
      .post(`/api/opportunities/${oppId}/advance`)
      .set('Authorization', `Bearer ${sales1.accessToken}`)
      .send({ quoteAmount: 620000 })
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
        nextFollowUpDate: '2026-08-29',
      })
    expect(createRes.status).toBe(201)
    expect(createRes.body.status).toBe('registered')
    const complaintId = createRes.body.id as string

    // 跟进确认解决（§8.6：RESOLVED → 必填解决结果）
    const resolved = await request(app.getHttpServer())
      .post(`/api/complaints/${complaintId}/follow-up`)
      .set('Authorization', `Bearer ${sales1.accessToken}`)
      .send({ content: '更换轴承后解决', outcome: 'resolved', resolution: '更换轴承' })
    expect(resolved.status).toBe(201)
    expect(resolved.body.status).toBe('resolved')

    // 已解决后禁止再跟进
    const again = await request(app.getHttpServer())
      .post(`/api/complaints/${complaintId}/follow-up`)
      .set('Authorization', `Bearer ${sales1.accessToken}`)
      .send({ content: '再跟', outcome: 'followed_up', nextFollowUpDate: '2026-09-01' })
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
        nextFollowUpDate: '2026-08-28',
      })

    const release = await request(app.getHttpServer())
      .post(`/api/customers/${customer.id}/release`)
      .set('Authorization', `Bearer ${sales1.accessToken}`)
      .send({ target: 'pool', reason: '想释放' })
    expect(release.status).toBe(409)
  })
})

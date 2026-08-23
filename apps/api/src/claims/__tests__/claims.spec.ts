import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { and, eq, sql } from 'drizzle-orm'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { AppModule } from '../../app.module'
import { seedAccounts } from '../../../scripts/seed'
import { db } from '../../common/db/db'
import { customerClaimRequests, customerTransfers, customers } from '../../common/db/schema'

// 接管审批流（§8.3）：申请 → 单点审批/拒绝/撤回，候选池 + 并发防护
describe('接管审批流（§8.3）', () => {
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

  async function getUserId(username: string): Promise<string> {
    const rows = await db.execute(sql`SELECT id FROM users WHERE username = ${username}`)
    return (rows.rows[0] as { id: string }).id
  }

  async function createCustomer(token: string, name: string) {
    const res = await request(app.getHttpServer())
      .post('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name, contacts: [{ name: '测试', phone: '13800000003' }] })
    expect(res.status).toBe(201)
    return res.body as { id: string }
  }

  async function cleanup() {
    await db.execute(
      sql`DELETE FROM customer_claim_requests WHERE customer_id IN (SELECT id FROM customers WHERE name LIKE 'CLAIM_%')`,
    )
    await db.execute(
      sql`DELETE FROM customer_transfers WHERE customer_id IN (SELECT id FROM customers WHERE name LIKE 'CLAIM_%')`,
    )
    await db.execute(
      sql`DELETE FROM contacts WHERE customer_id IN (SELECT id FROM customers WHERE name LIKE 'CLAIM_%')`,
    )
    await db.execute(sql`DELETE FROM customers WHERE name LIKE 'CLAIM_%'`)
  }

  describe('发起申请', () => {
    it('sales1 对 sales2 的客户发起 → pending + 归属快照', async () => {
      const sales2 = await login('sales2', 'Crm@123456')
      const customer = await createCustomer(sales2.accessToken, 'CLAIM_目标客户')
      const sales2Id = await getUserId('sales2')

      const res = await request(app.getHttpServer())
        .post(`/api/claims/customer/${customer.id}`)
        .set('Authorization', `Bearer ${(await login('sales1', 'Crm@123456')).accessToken}`)
        .send({ reason: '该客户一直由我对接' })

      expect(res.status).toBe(201)
      expect(res.body.status).toBe('pending')
      expect(res.body.currentOwnerId).toBe(sales2Id)

      const [row] = await db
        .select()
        .from(customerClaimRequests)
        .where(eq(customerClaimRequests.id, res.body.id))
        .limit(1)
      expect(row.status).toBe('pending')
      expect(row.applicantId).toBe(await getUserId('sales1'))
    })

    it('同客户已有 pending → 409（并发防护）', async () => {
      const sales2 = await login('sales2', 'Crm@123456')
      const customer = await createCustomer(sales2.accessToken, 'CLAIM_并发客户')
      const sales1 = await login('sales1', 'Crm@123456')
      await request(app.getHttpServer())
        .post(`/api/claims/customer/${customer.id}`)
        .set('Authorization', `Bearer ${sales1.accessToken}`)
        .send({ reason: 'x' })

      const res = await request(app.getHttpServer())
        .post(`/api/claims/customer/${customer.id}`)
        .set('Authorization', `Bearer ${sales1.accessToken}`)
        .send({ reason: 'y' })
      expect(res.status).toBe(409)
    })

    it('对自己名下的客户发起 → 409', async () => {
      const sales1 = await login('sales1', 'Crm@123456')
      const customer = await createCustomer(sales1.accessToken, 'CLAIM_自己的')
      const res = await request(app.getHttpServer())
        .post(`/api/claims/customer/${customer.id}`)
        .set('Authorization', `Bearer ${sales1.accessToken}`)
        .send({ reason: 'x' })
      expect(res.status).toBe(409)
    })
  })
  describe('审批/拒绝/撤回', () => {
    it('管理链审批通过：owner 变更 + 移交历史 + 申请置 approved', async () => {
      const sales2 = await login('sales2', 'Crm@123456')
      const customer = await createCustomer(sales2.accessToken, 'CLAIM_审批客户')
      const sales1 = await login('sales1', 'Crm@123456')
      const manager = await login('manager', 'Crm@123456')
      const claimRes = await request(app.getHttpServer())
        .post(`/api/claims/customer/${customer.id}`)
        .set('Authorization', `Bearer ${sales1.accessToken}`)
        .send({ reason: 'x' })

      const res = await request(app.getHttpServer())
        .post(`/api/claims/${claimRes.body.id}/approve`)
        .set('Authorization', `Bearer ${manager.accessToken}`)
        .send({ comment: '同意' })
      expect(res.status).toBe(201)
      expect(res.body.status).toBe('approved')

      const [cust] = await db.select().from(customers).where(eq(customers.id, customer.id)).limit(1)
      expect(cust.ownerId).toBe(await getUserId('sales1'))

      const transfers = await db
        .select()
        .from(customerTransfers)
        .where(eq(customerTransfers.customerId, customer.id))
      expect(transfers).toHaveLength(1)
      expect(transfers[0].toOwnerId).toBe(await getUserId('sales1'))
    })

    it('非候选池人员审批 → 403', async () => {
      const sales2 = await login('sales2', 'Crm@123456')
      const customer = await createCustomer(sales2.accessToken, 'CLAIM_越权审批')
      const sales1 = await login('sales1', 'Crm@123456')
      const claimRes = await request(app.getHttpServer())
        .post(`/api/claims/customer/${customer.id}`)
        .set('Authorization', `Bearer ${sales1.accessToken}`)
        .send({ reason: 'x' })

      // assistant 不在候选池（非 owner/非管理链/非 admin）→ 403
      const assistant = await login('assistant', 'Crm@123456')
      const res = await request(app.getHttpServer())
        .post(`/api/claims/${claimRes.body.id}/approve`)
        .set('Authorization', `Bearer ${assistant.accessToken}`)
        .send({ comment: 'x' })
      expect(res.status).toBe(403)
    })

    it('防自我审批：申请人审批自己的申请 → 403', async () => {
      const sales2 = await login('sales2', 'Crm@123456')
      const customer = await createCustomer(sales2.accessToken, 'CLAIM_自审')
      const sales1 = await login('sales1', 'Crm@123456')
      const claimRes = await request(app.getHttpServer())
        .post(`/api/claims/customer/${customer.id}`)
        .set('Authorization', `Bearer ${sales1.accessToken}`)
        .send({ reason: 'x' })

      const res = await request(app.getHttpServer())
        .post(`/api/claims/${claimRes.body.id}/approve`)
        .set('Authorization', `Bearer ${sales1.accessToken}`)
        .send({})
      expect(res.status).toBe(403)
    })

    it('拒绝必填意见：无 comment → 400', async () => {
      const sales2 = await login('sales2', 'Crm@123456')
      const customer = await createCustomer(sales2.accessToken, 'CLAIM_拒绝')
      const sales1 = await login('sales1', 'Crm@123456')
      const manager = await login('manager', 'Crm@123456')
      const claimRes = await request(app.getHttpServer())
        .post(`/api/claims/customer/${customer.id}`)
        .set('Authorization', `Bearer ${sales1.accessToken}`)
        .send({ reason: 'x' })

      const res = await request(app.getHttpServer())
        .post(`/api/claims/${claimRes.body.id}/reject`)
        .set('Authorization', `Bearer ${manager.accessToken}`)
        .send({})
      expect(res.status).toBe(400)
    })

    it('撤回：非申请人 → 403；申请人 → withdrawn', async () => {
      const sales2 = await login('sales2', 'Crm@123456')
      const customer = await createCustomer(sales2.accessToken, 'CLAIM_撤回')
      const sales1 = await login('sales1', 'Crm@123456')
      const claimRes = await request(app.getHttpServer())
        .post(`/api/claims/customer/${customer.id}`)
        .set('Authorization', `Bearer ${sales1.accessToken}`)
        .send({ reason: 'x' })

      // sales2（非申请人）撤回 → 403
      const res2 = await request(app.getHttpServer())
        .post(`/api/claims/${claimRes.body.id}/withdraw`)
        .set('Authorization', `Bearer ${sales2.accessToken}`)
      expect(res2.status).toBe(403)

      // sales1（申请人）撤回 → withdrawn
      const res = await request(app.getHttpServer())
        .post(`/api/claims/${claimRes.body.id}/withdraw`)
        .set('Authorization', `Bearer ${sales1.accessToken}`)
      expect(res.status).toBe(201)
      expect(res.body.status).toBe('withdrawn')
    })
  })
})
